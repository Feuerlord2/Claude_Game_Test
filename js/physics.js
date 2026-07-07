// Verlet circle physics with radial (center-seeking) gravity.
// Circles only — the cheapest sim that can feel great. No external deps.

import { PHYSICS, WORLD } from './config.js';

let nextId = 1;

export class Body {
  constructor(x, y, tier, r, density = 1) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.px = x;          // previous position (verlet velocity = pos - prev)
    this.py = y;
    this.ax = 0;
    this.ay = 0;
    this.r = r;
    this.tier = tier;
    this.mass = r * r * density;
    this.invMass = 1 / this.mass;
    this.age = 0;
    this.hadContact = false;
    this.dangerTime = 0;
    this.mergeGrace = 0;   // seconds left before this body may merge
    this.spin = Math.random() * Math.PI * 2;
    this.spinV = (Math.random() - 0.5) * 0.6;
    this.dead = false;
    this.eaten = 0;        // 0..1 shrink progress while being consumed by a black hole
  }

  get vx() { return this.x - this.px; }
  get vy() { return this.y - this.py; }

  setVelocity(vx, vy, dt) {
    this.px = this.x - vx * dt;
    this.py = this.y - vy * dt;
  }
}

export class Physics {
  constructor() {
    this.bodies = [];
    this.contacts = [];   // {a, b} pairs touching after the final solver pass
  }

  add(body) {
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    body.dead = true;
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  clear() {
    this.bodies.length = 0;
    this.contacts.length = 0;
  }

  step(dt) {
    const bodies = this.bodies;
    const damp = Math.max(0, 1 - PHYSICS.DAMPING * dt);
    const maxV = PHYSICS.MAX_SPEED * dt;

    // Integrate
    for (const b of bodies) {
      b.age += dt;
      if (b.mergeGrace > 0) b.mergeGrace -= dt;
      b.spin += b.spinV * dt;

      // Radial gravity toward (0,0), softened near the center.
      const d = Math.hypot(b.x, b.y);
      if (d > 0.001) {
        const soft = Math.min(1, d / 8);
        const g = PHYSICS.GRAVITY * soft / d;
        b.ax -= b.x * g;
        b.ay -= b.y * g;
      }

      let vx = (b.x - b.px) * damp + b.ax * dt * dt;
      let vy = (b.y - b.py) * damp + b.ay * dt * dt;
      const sp = Math.hypot(vx, vy);
      if (sp > maxV) {
        vx = (vx / sp) * maxV;
        vy = (vy / sp) * maxV;
      }
      b.px = b.x;
      b.py = b.y;
      b.x += vx;
      b.y += vy;
      b.ax = 0;
      b.ay = 0;
    }

    // Solve circle-circle overlaps
    const n = bodies.length;
    for (let iter = 0; iter < PHYSICS.ITERATIONS; iter++) {
      const record = iter === PHYSICS.ITERATIONS - 1;
      if (record) this.contacts.length = 0;

      for (let i = 0; i < n; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < n; j++) {
          const b = bodies[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const rSum = a.r + b.r;
          const distSq = dx * dx + dy * dy;
          if (distSq >= (rSum + 0.6) * (rSum + 0.6)) continue;

          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;

          if (record && dist < rSum + 0.6) this.contacts.push({ a, b });

          const overlap = rSum - dist;
          if (overlap <= 0.02) continue;

          a.hadContact = true;
          b.hadContact = true;

          const wa = a.invMass / (a.invMass + b.invMass);
          const wb = b.invMass / (a.invMass + b.invMass);
          const push = Math.min(overlap * 0.8, PHYSICS.MAX_CORRECTION);

          a.x -= nx * push * wa;
          a.y -= ny * push * wa;
          b.x += nx * push * wb;
          b.y += ny * push * wb;

          // Tangential friction: damp relative sliding so piles settle.
          const rvx = (a.x - a.px) - (b.x - b.px);
          const rvy = (a.y - a.py) - (b.y - b.py);
          const rvn = rvx * nx + rvy * ny;
          const tx = rvx - rvn * nx;
          const ty = rvy - rvn * ny;
          const f = PHYSICS.FRICTION;
          a.px += tx * f * wa;
          a.py += ty * f * wa;
          b.px -= tx * f * wb;
          b.py -= ty * f * wb;
        }
      }
    }

    // Safety clamp — nothing escapes the arena region.
    for (const b of bodies) {
      const d = Math.hypot(b.x, b.y);
      if (d > WORLD.CLAMP_R) {
        const s = WORLD.CLAMP_R / d;
        b.x *= s;
        b.y *= s;
        b.px = b.x;
        b.py = b.y;
      }
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) {
        // Should never happen; recover instead of corrupting the sim.
        b.x = 0; b.y = -WORLD.SPAWN_R * 0.5;
        b.px = b.x; b.py = b.y;
      }
    }
  }

  // Total kinetic proxy — used by tests to assert the pile settles.
  kineticEnergy() {
    let e = 0;
    for (const b of this.bodies) {
      const vx = b.x - b.px;
      const vy = b.y - b.py;
      e += b.mass * (vx * vx + vy * vy);
    }
    return e;
  }
}
