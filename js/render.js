// Canvas renderer. All body art is procedural, pre-baked into cached sprites
// (radial gradients + details) so the hot loop is pure drawImage — no
// shadowBlur, no gradient allocation per frame.

import { WORLD, TIERS, BLACKHOLE_TIER } from './config.js';
import { hashString, mulberry32 } from './rng.js';

const GLOW_PAD = 0.9; // glow radius as a fraction of body radius, baked into sprites

// setLineDash copies its input, so shared constants are safe.
const DASH_DANGER = [6, 8];
const DASH_AIM = [3, 9];
const DASH_NONE = [];
const CHEVRON_OFFS = [-0.09, 0.09];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.spriteCache = new Map();
    this.bg = document.createElement('canvas');
    this.shake = 0;
    this.time = 0;
    this.resize();
  }

  resize() {
    // DPR can change at runtime (foldables, monitor moves, browser zoom).
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.cx = w / 2;
    this.cy = h * 0.54;
    this.scale = (Math.min(w, h * 0.86) * 0.5 * 0.95) / WORLD.R;
    this.spriteCache.clear();
    this.bakeWellGradient();
    this.renderBackground();
  }

  bakeWellGradient() {
    this.wellR = 26 * this.scale;
    const g = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.wellR);
    g.addColorStop(0, 'rgba(127, 107, 255, 0.16)');
    g.addColorStop(0.5, 'rgba(80, 60, 180, 0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    this.wellGradient = g;
  }

  // Screen position -> aim angle around the arena center.
  angleFromScreen(sx, sy) {
    return Math.atan2(sy - this.cy, sx - this.cx);
  }

  renderBackground() {
    const c = this.bg;
    c.width = Math.round(this.w * this.dpr);
    c.height = Math.round(this.h * this.dpr);
    const ctx = c.getContext('2d');
    ctx.scale(this.dpr, this.dpr);

    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, this.w, this.h);

    // Nebula washes
    const nebulae = [
      { x: 0.2, y: 0.25, r: 0.5, color: 'rgba(78, 52, 160, 0.16)' },
      { x: 0.85, y: 0.7, r: 0.55, color: 'rgba(160, 80, 60, 0.10)' },
      { x: 0.6, y: 0.15, r: 0.4, color: 'rgba(40, 90, 150, 0.12)' },
    ];
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(
        n.x * this.w, n.y * this.h, 0,
        n.x * this.w, n.y * this.h, n.r * Math.max(this.w, this.h)
      );
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // Stars (deterministic)
    const rand = mulberry32(hashString('starfield'));
    for (let i = 0; i < 160; i++) {
      const x = rand() * this.w;
      const y = rand() * this.h;
      const r = rand() * 1.1 + 0.2;
      const a = rand() * 0.5 + 0.15;
      ctx.fillStyle = `rgba(220, 230, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  sprite(tier, screenR) {
    const key = tier * 4096 + Math.min(4000, Math.round(screenR));
    let s = this.spriteCache.get(key);
    if (!s) {
      s = this.bakeSprite(tier, Math.max(2, Math.round(screenR)));
      this.spriteCache.set(key, s);
    }
    return s;
  }

  bakeSprite(tier, r) {
    const spec = TIERS[tier];
    const pad = Math.ceil(r * GLOW_PAD) + 2;
    const size = (r + pad) * 2;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const rand = mulberry32(hashString(spec.id));

    // Glow halo
    const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r + pad);
    glow.addColorStop(0, this.rgba(spec.glow, tier === BLACKHOLE_TIER ? 0.35 : 0.45));
    glow.addColorStop(1, this.rgba(spec.glow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    // Body base with 3D shading
    const base = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    if (tier === BLACKHOLE_TIER) {
      base.addColorStop(0, '#16121f');
      base.addColorStop(0.75, '#050508');
      base.addColorStop(1, '#000000');
    } else {
      base.addColorStop(0, this.lighten(spec.color, 0.45));
      base.addColorStop(0.7, spec.color);
      base.addColorStop(1, this.darken(spec.color, 0.45));
    }
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    this.bakeDetails(ctx, tier, cx, cy, r, rand, spec);
    ctx.restore();

    // Accretion ring for the black hole (drawn outside the clip)
    if (tier === BLACKHOLE_TIER) {
      ctx.strokeStyle = this.rgba(spec.glow, 0.9);
      ctx.lineWidth = Math.max(1.5, r * 0.13);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.35, r * 0.42, -0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 220, 160, 0.5)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.5, r * 0.5, -0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    return { canvas: c, offset: r + pad };
  }

  bakeDetails(ctx, tier, cx, cy, r, rand, spec) {
    const id = spec.id;
    if (id === 'stardust') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'meteoroid' || id === 'asteroid') {
      for (let i = 0; i < 5; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.6;
        ctx.fillStyle = this.rgba(this.darken(spec.color, 0.5), 0.5);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.12 + rand() * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'comet') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'moon') {
      for (let i = 0; i < 6; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.65;
        const cr = r * (0.1 + rand() * 0.16);
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        ctx.fillStyle = 'rgba(90, 86, 80, 0.35)';
        ctx.beginPath();
        ctx.arc(x, y, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 252, 245, 0.25)';
        ctx.beginPath();
        ctx.arc(x - cr * 0.2, y - cr * 0.2, cr * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'planet') {
      ctx.fillStyle = 'rgba(90, 190, 110, 0.75)';
      for (let i = 0; i < 4; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.55;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.2 + rand() * 0.25), r * (0.12 + rand() * 0.15), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 3; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.7;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.3, r * 0.08, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'gasgiant') {
      const bands = 6;
      for (let i = 0; i < bands; i++) {
        const y = cy - r + ((i + 0.5) / bands) * r * 2;
        const alt = i % 2 === 0;
        ctx.fillStyle = alt ? this.rgba(this.lighten(spec.color, 0.25), 0.5) : this.rgba(this.darken(spec.color, 0.3), 0.45);
        ctx.fillRect(cx - r, y - r * 0.12, r * 2, r * 0.24);
      }
      ctx.fillStyle = 'rgba(200, 90, 50, 0.6)';
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.3, cy + r * 0.25, r * 0.22, r * 0.13, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'star' || id === 'redgiant') {
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      core.addColorStop(0, 'rgba(255,255,255,0.95)');
      core.addColorStop(0.45, this.rgba(this.lighten(spec.color, 0.2), 0.6));
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    } else if (id === 'neutron') {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();
    }
  }

  draw(game, particles, opts = {}, dt = 1 / 60) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    this.time += dt;
    if (this.shake > 0.01) this.shake *= Math.pow(0.86, dt * 60); else this.shake = 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(this.bg, 0, 0, this.w, this.h);

    const shx = (Math.random() - 0.5) * this.shake;
    const shy = (Math.random() - 0.5) * this.shake;
    ctx.translate(this.cx + shx, this.cy + shy);
    const s = this.scale;

    this.drawWell(ctx, s);
    this.drawRings(ctx, s, game);

    // Bodies
    for (const b of game.physics.bodies) {
      const shrink = b.eaten > 0 ? Math.max(0.05, 1 - b.eaten) : 1;
      const sr = b.r * s * shrink;
      const spr = this.sprite(b.tier, b.r * s);
      const sx = b.x * s;
      const sy = b.y * s;
      if (b.tier === BLACKHOLE_TIER || b.spinV !== 0) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(b.tier === BLACKHOLE_TIER ? this.time * 1.5 : b.spin);
        const sc = (sr / (b.r * s));
        ctx.scale(sc, sc);
        ctx.drawImage(spr.canvas, -spr.offset, -spr.offset);
        ctx.restore();
      } else {
        ctx.drawImage(spr.canvas, sx - spr.offset, sy - spr.offset);
      }
    }

    if (!game.over && !opts.hideLauncher) this.drawLauncher(ctx, s, game);

    particles.draw(ctx, s);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  drawWell(ctx, s) {
    ctx.fillStyle = this.wellGradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.wellR, 0, Math.PI * 2);
    ctx.fill();

    // Slowly rotating spiral hints
    ctx.strokeStyle = 'rgba(127, 107, 255, 0.22)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 2; k++) {
      const a0 = this.time * 0.4 + k * Math.PI;
      ctx.beginPath();
      ctx.arc(0, 0, 9 * s * (0.6 + k * 0.5), a0, a0 + 1.8);
      ctx.stroke();
    }
  }

  drawRings(ctx, s, game) {
    // Launcher orbit track
    ctx.strokeStyle = 'rgba(139, 147, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, WORLD.R * s, 0, Math.PI * 2);
    ctx.stroke();

    // Danger ring
    const d = game.dangerLevel;
    const pulse = d > 0 ? (Math.sin(this.time * (6 + d * 10)) * 0.5 + 0.5) * d : 0;
    const alpha = 0.14 + d * 0.5 + pulse * 0.3;
    ctx.strokeStyle = d > 0.02 ? `rgba(255, 84, 112, ${alpha})` : 'rgba(139, 147, 184, 0.22)';
    ctx.lineWidth = 1.5 + d * 3 + pulse * 2;
    ctx.setLineDash(DASH_DANGER);
    ctx.beginPath();
    ctx.arc(0, 0, WORLD.DANGER_R * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash(DASH_NONE);
  }

  drawLauncher(ctx, s, game) {
    const a = game.aimAngle;
    const spec = TIERS[game.currentTier];
    const lx = Math.cos(a) * WORLD.SPAWN_R * s;
    const ly = Math.sin(a) * WORLD.SPAWN_R * s;

    // Aim line toward the well
    const ready = game.dropCooldown <= 0;
    ctx.strokeStyle = ready ? 'rgba(232, 236, 255, 0.30)' : 'rgba(139, 147, 184, 0.12)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash(DASH_AIM);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(Math.cos(a) * 20 * s, Math.sin(a) * 20 * s);
    ctx.stroke();
    ctx.setLineDash(DASH_NONE);

    // Current piece sitting on the rim
    const spr = this.sprite(game.currentTier, spec.r * s);
    ctx.globalAlpha = ready ? 1 : 0.45;
    ctx.drawImage(spr.canvas, lx - spr.offset, ly - spr.offset);
    ctx.globalAlpha = 1;

    // Emitter chevrons on the track
    ctx.strokeStyle = 'rgba(232, 236, 255, 0.5)';
    ctx.lineWidth = 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rr = WORLD.R * s + 8;
    for (const off of CHEVRON_OFFS) {
      ctx.beginPath();
      ctx.arc(0, 0, rr, a + off - 0.03, a + off + 0.03);
      ctx.stroke();
    }
  }

  addShake(amount) {
    this.shake = Math.min(26, this.shake + amount);
  }

  // ---- tiny color helpers (hex in, css out) ----
  hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  rgba(hex, a) {
    const [r, g, b] = this.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  lighten(hex, f) {
    const [r, g, b] = this.hexToRgb(hex);
    return `rgb(${Math.round(r + (255 - r) * f)},${Math.round(g + (255 - g) * f)},${Math.round(b + (255 - b) * f)})`;
  }
  darken(hex, f) {
    const [r, g, b] = this.hexToRgb(hex);
    return `rgb(${Math.round(r * (1 - f))},${Math.round(g * (1 - f))},${Math.round(b * (1 - f))})`;
  }
}
