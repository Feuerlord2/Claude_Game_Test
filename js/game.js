// Game state machine: piece queue, merging, chains, black holes, lose condition.

import { PHYSICS, WORLD, RULES, TIERS, BLACKHOLE_TIER } from './config.js';
import { Physics, Body } from './physics.js';
import { mulberry32, weightedPick } from './rng.js';

export class Game {
  constructor() {
    this.physics = new Physics();
    this.events = [];        // drained by main loop each frame (fx, audio, ui)
    this.reset('endless', Math.floor(Math.random() * 0xffffffff));
  }

  reset(mode, seed) {
    this.physics.clear();
    this.mode = mode;                    // 'endless' | 'daily'
    this.seed = seed >>> 0;
    this.rand = mulberry32(this.seed);
    this.score = 0;
    this.merges = 0;
    this.bestTier = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.time = 0;
    this.accumulator = 0;
    this.over = false;
    this.paused = false;
    this.dropCooldown = 0;
    this.dropsMade = 0;
    this.dangerLevel = 0;
    this.reviveUsed = false;
    this.aimAngle = -Math.PI / 2;        // top of the arena
    this.currentTier = this.pickPiece();
    this.nextTier = this.pickPiece();
    this.events.length = 0;
  }

  pickPiece() {
    return weightedPick(this.rand, RULES.DROP_WEIGHTS);
  }

  chainMult() {
    if (this.chain <= 1) return 1;
    return Math.min(RULES.CHAIN_MAX_MULT, 1 + RULES.CHAIN_STEP * (this.chain - 1));
  }

  drop(angle) {
    if (this.over || this.paused || this.dropCooldown > 0) return false;
    const tier = this.currentTier;
    const spec = TIERS[tier];
    const x = Math.cos(angle) * WORLD.SPAWN_R;
    const y = Math.sin(angle) * WORLD.SPAWN_R;
    const b = new Body(x, y, tier, spec.r, spec.density);
    // Aim straight at the gravity well.
    b.setVelocity(-Math.cos(angle) * PHYSICS.DROP_SPEED, -Math.sin(angle) * PHYSICS.DROP_SPEED, PHYSICS.DT);
    b.mergeGrace = PHYSICS.MERGE_GRACE;
    this.physics.add(b);

    this.currentTier = this.nextTier;
    this.nextTier = this.pickPiece();
    this.dropCooldown = RULES.DROP_COOLDOWN;
    this.dropsMade++;
    this.events.push({ type: 'drop', tier, x, y });
    return true;
  }

  update(dt) {
    if (this.over || this.paused) return;
    // Clamp long frames (tab switch) so the sim never explodes.
    this.accumulator += Math.min(dt, 0.1);
    let steps = 0;
    while (this.accumulator >= PHYSICS.DT && steps < PHYSICS.MAX_STEPS) {
      this.fixedStep(PHYSICS.DT);
      this.accumulator -= PHYSICS.DT;
      steps++;
      if (this.over) break;
    }
    // Drop whatever we couldn't simulate — prevents spiral-of-death.
    if (this.accumulator >= PHYSICS.DT) this.accumulator = 0;
  }

  fixedStep(dt) {
    this.time += dt;
    if (this.dropCooldown > 0) this.dropCooldown -= dt;
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
    }

    this.applyBlackHoles(dt);
    this.physics.step(dt);
    this.processMerges();
    this.updateBlackHoles(dt);
    this.updateDanger(dt);
  }

  processMerges() {
    const consumed = new Set();
    for (const { a, b } of this.physics.contacts) {
      if (a.dead || b.dead || consumed.has(a.id) || consumed.has(b.id)) continue;
      if (a.tier !== b.tier) continue;
      if (a.tier >= BLACKHOLE_TIER) continue;
      if (a.mergeGrace > 0 || b.mergeGrace > 0) continue;
      if (a.eaten > 0 || b.eaten > 0) continue;

      consumed.add(a.id);
      consumed.add(b.id);
      this.merge(a, b);
    }
  }

  merge(a, b) {
    const t = a.tier + 1;
    const spec = TIERS[t];
    const mSum = a.mass + b.mass;
    const x = (a.x * a.mass + b.x * b.mass) / mSum;
    const y = (a.y * a.mass + b.y * b.mass) / mSum;
    const vx = (a.vx * a.mass + b.vx * b.mass) / mSum;
    const vy = (a.vy * a.mass + b.vy * b.mass) / mSum;

    this.physics.remove(a);
    this.physics.remove(b);

    const nb = new Body(x, y, t, spec.r, spec.density);
    nb.px = x - vx;
    nb.py = y - vy;
    nb.mergeGrace = PHYSICS.MERGE_GRACE;
    nb.hadContact = true;
    nb.happyUntil = this.time + 0.9; // freshly merged bodies beam for a moment
    this.physics.add(nb);

    this.chain++;
    this.chainTimer = RULES.CHAIN_WINDOW;
    const points = Math.round(spec.score * this.chainMult());
    this.score += points;
    this.merges++;
    if (t > this.bestTier) this.bestTier = t;

    if (t === BLACKHOLE_TIER) {
      nb.bhBirth = this.time;
      nb.bhFed = 0;
    }

    this.events.push({ type: 'merge', tier: t, x, y, points, chain: this.chain });
  }

  applyBlackHoles(dt) {
    for (const bh of this.physics.bodies) {
      if (bh.tier !== BLACKHOLE_TIER || bh.bhBirth === undefined) continue;
      if (this.time - bh.bhBirth > RULES.BLACKHOLE_FEED_TIME) continue;
      for (const b of this.physics.bodies) {
        if (b === bh || b.tier === BLACKHOLE_TIER) continue;
        const dx = bh.x - b.x;
        const dy = bh.y - b.y;
        const d = Math.hypot(dx, dy);
        const reach = bh.r + b.r + RULES.BLACKHOLE_PULL_RADIUS;
        if (d > reach || d < 0.001) continue;
        const pull = 1400 * (1 - d / reach);
        b.ax += (dx / d) * pull;
        b.ay += (dy / d) * pull;
      }
    }
  }

  updateBlackHoles(dt) {
    const toRemove = [];
    for (const bh of this.physics.bodies) {
      if (bh.tier !== BLACKHOLE_TIER || bh.bhBirth === undefined) continue;
      const alive = this.time - bh.bhBirth;

      if (alive <= RULES.BLACKHOLE_FEED_TIME) {
        // Consume anything overlapping the event horizon. Each victim is
        // bound to ONE hole via eatenBy so two concurrent holes can neither
        // double the eat rate nor double-award the score.
        for (const b of this.physics.bodies) {
          if (b === bh || b.tier === BLACKHOLE_TIER || b.dead) continue;
          if (b.eatenBy !== undefined && b.eatenBy !== bh.id) continue;
          const d = Math.hypot(bh.x - b.x, bh.y - b.y);
          if (b.eatenBy === bh.id || d < bh.r + b.r * 0.35) {
            b.eatenBy = bh.id;
            b.eaten += dt * 2.6;
            // Devoured bodies stop colliding (see physics.js); pull them
            // into the horizon and kill their velocity so they sink cleanly.
            b.x += (bh.x - b.x) * Math.min(1, dt * 5);
            b.y += (bh.y - b.y) * Math.min(1, dt * 5);
            b.px = b.x;
            b.py = b.y;
            if (b.eaten >= 1) {
              b.dead = true; // claim now — no other hole may re-award this step
              toRemove.push(b);
              bh.bhFed++;
              this.score += RULES.BLACKHOLE_EAT_SCORE;
              this.events.push({ type: 'bh-eat', x: b.x, y: b.y, tier: b.tier, points: RULES.BLACKHOLE_EAT_SCORE });
            }
          }
        }
      } else {
        // Hawking evaporation: the finale clears the singularity itself.
        toRemove.push(bh);
        this.score += RULES.BLACKHOLE_FINALE_SCORE;
        this.events.push({ type: 'bh-finale', x: bh.x, y: bh.y, fed: bh.bhFed, points: RULES.BLACKHOLE_FINALE_SCORE });
        for (const b of this.physics.bodies) {
          if (b === bh) continue;
          // Release half-eaten victims — otherwise they stay shrunken,
          // unmergeable and exempt from the lose condition forever.
          if (b.eatenBy === bh.id) {
            b.eatenBy = undefined;
            b.eaten = 0;
          }
          // Gentle outward shove so the remaining pile breathes.
          const dx = b.x - bh.x;
          const dy = b.y - bh.y;
          const d = Math.hypot(dx, dy) || 1;
          const kick = Math.max(0, 1 - d / 70) * 2.2;
          b.px -= (dx / d) * kick;
          b.py -= (dy / d) * kick;
        }
      }
    }
    for (const b of toRemove) this.physics.remove(b);
  }

  updateDanger(dt) {
    let maxLevel = 0;
    for (const b of this.physics.bodies) {
      const settled = b.hadContact || b.age > RULES.SETTLE_AGE;
      const edge = Math.hypot(b.x, b.y) + b.r;
      if (settled && edge > WORLD.DANGER_R && b.eaten === 0) {
        b.dangerTime += dt;
      } else {
        b.dangerTime = Math.max(0, b.dangerTime - dt * 2);
      }
      const level = b.dangerTime / RULES.DANGER_TIME;
      if (level > maxLevel) maxLevel = level;
      if (b.dangerTime >= RULES.DANGER_TIME) {
        this.dangerLevel = 1;
        this.gameOver();
        return;
      }
    }
    this.dangerLevel = maxLevel;
  }

  gameOver() {
    if (this.over) return;
    this.over = true;
    this.events.push({ type: 'gameover', score: this.score, bestTier: this.bestTier, merges: this.merges });
  }

  // Rewarded-ad revive: a solar flare vaporizes all small debris.
  revive() {
    if (!this.over || this.reviveUsed) return false;
    this.reviveUsed = true;
    const cleared = [];
    for (const b of [...this.physics.bodies]) {
      if (b.tier < RULES.REVIVE_CLEAR_TIERS) {
        cleared.push({ x: b.x, y: b.y, tier: b.tier });
        this.physics.remove(b);
      }
    }
    for (const b of this.physics.bodies) b.dangerTime = 0;
    this.over = false;
    this.dangerLevel = 0;
    // Sim time froze while over — an old chain must not survive the ad break.
    this.chain = 0;
    this.chainTimer = 0;
    this.events.push({ type: 'revive', cleared });
    return true;
  }

  drainEvents() {
    // Double-buffer instead of slice: no per-frame allocation.
    const evs = this.events;
    this.events = this._spareEvents || [];
    this.events.length = 0;
    this._spareEvents = evs;
    return evs;
  }
}
