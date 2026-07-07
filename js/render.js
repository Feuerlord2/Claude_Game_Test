// Canvas renderer, kawaii edition: flat saturated fills, thick outlines and
// simple shapes — baked into cached sprites so the hot loop is pure drawImage.
// Faces (blink / happy / panic) are drawn as a light dynamic layer on top so
// they stay upright while the body art rotates.

import { WORLD, TIERS, BLACKHOLE_TIER, RULES } from './config.js';
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
    this.bakeVignette();
    this.renderBackground();
  }

  bakeVignette() {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(this.w / 4));
    c.height = Math.max(2, Math.round(this.h / 4));
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(
      c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35,
      c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.72
    );
    g.addColorStop(0, 'rgba(255, 60, 90, 0)');
    g.addColorStop(1, 'rgba(255, 60, 90, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    this.vignette = c;
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
    const outline = this.darken(spec.color, 0.62);
    const ow = Math.max(1.5, r * 0.09); // thick sticker outline

    // Soft halo only for luminous bodies — kawaii lives on flat color.
    if (['star', 'redgiant', 'neutron', 'blackhole'].includes(spec.id)) {
      const glow = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r + pad);
      glow.addColorStop(0, this.rgba(spec.glow, 0.3));
      glow.addColorStop(1, this.rgba(spec.glow, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
    }

    // Sun rays for stars, baked outside the body so they rotate with spin.
    if (spec.id === 'star' || spec.id === 'redgiant') {
      ctx.fillStyle = spec.id === 'star' ? '#ffca3f' : '#ff5b3a';
      const rays = 9;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        const len = r * (spec.id === 'star' ? 1.34 : 1.28);
        const half = 0.16;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a - half) * r * 0.95, cy + Math.sin(a - half) * r * 0.95);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.lineTo(cx + Math.cos(a + half) * r * 0.95, cy + Math.sin(a + half) * r * 0.95);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Flat body fill
    ctx.fillStyle = tier === BLACKHOLE_TIER ? '#181226' : spec.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Flat shading: darker bottom crescent + small top-left highlight
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (tier !== BLACKHOLE_TIER) {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.22, r * 1.08, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.42, cy - r * 0.45, r * 0.2, r * 0.11, -0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    this.bakeDetails(ctx, tier, cx, cy, r, rand, spec);
    ctx.restore();

    // Sticker outline
    ctx.strokeStyle = outline;
    ctx.lineWidth = ow;
    ctx.beginPath();
    ctx.arc(cx, cy, r - ow * 0.35, 0, Math.PI * 2);
    ctx.stroke();

    // Cartoon accretion ring for the black hole
    if (tier === BLACKHOLE_TIER) {
      ctx.strokeStyle = '#2a1608';
      ctx.lineWidth = Math.max(2, r * 0.2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.42, r * 0.46, -0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = spec.glow;
      ctx.lineWidth = Math.max(1.5, r * 0.13);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.42, r * 0.46, -0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    return { canvas: c, offset: r + pad };
  }

  // Flat, chunky details — everything reads as a sticker, not a render.
  bakeDetails(ctx, tier, cx, cy, r, rand, spec) {
    const id = spec.id;
    if (id === 'stardust') {
      // Little plus-sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const w = r * 0.16;
      ctx.fillRect(cx - w / 2, cy - r * 0.62, w, r * 0.5);
      ctx.fillRect(cx - r * 0.62 + r * 0.31, cy - w / 2 - r * 0.35, r * 0.5, w);
    } else if (id === 'meteoroid' || id === 'asteroid') {
      const spots = id === 'meteoroid' ? 3 : 4;
      ctx.fillStyle = this.rgba(this.darken(spec.color, 0.35), 0.8);
      for (let i = 0; i < spots; i++) {
        const a = rand() * Math.PI * 2;
        const d = (0.25 + rand() * 0.45) * r;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.13 + rand() * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'comet') {
      // Icy shine wedges
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.2, cy - r * 0.75);
      ctx.lineTo(cx + r * 0.75, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.55, cy - r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy + r * 0.35, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'moon') {
      const craterFill = this.darken(spec.color, 0.22);
      const craterEdge = this.darken(spec.color, 0.4);
      for (let i = 0; i < 4; i++) {
        const a = rand() * Math.PI * 2;
        const d = (0.3 + rand() * 0.45) * r;
        const cr = r * (0.12 + rand() * 0.1);
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        ctx.fillStyle = craterFill;
        ctx.beginPath();
        ctx.arc(x, y, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = craterEdge;
        ctx.lineWidth = Math.max(1, r * 0.035);
        ctx.stroke();
      }
    } else if (id === 'planet') {
      ctx.fillStyle = '#57c785';
      for (let i = 0; i < 3; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.55;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.24 + rand() * 0.2), r * (0.16 + rand() * 0.12), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 2; i++) {
        const y = cy + (rand() - 0.5) * r * 1.1;
        const x = cx + (rand() - 0.5) * r * 0.9;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.26, r * 0.09, 0, 0, Math.PI * 2);
        ctx.ellipse(x + r * 0.14, y - r * 0.05, r * 0.16, r * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'gasgiant') {
      const bandCols = [this.lighten(spec.color, 0.3), this.darken(spec.color, 0.18)];
      const bands = [-0.55, -0.15, 0.3, 0.65];
      for (let i = 0; i < bands.length; i++) {
        ctx.fillStyle = bandCols[i % 2];
        ctx.fillRect(cx - r, cy + bands[i] * r - r * 0.11, r * 2, r * 0.22);
      }
      ctx.fillStyle = '#e05e3a';
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.32, cy + r * 0.3, r * 0.2, r * 0.12, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.darken('#e05e3a', 0.4);
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.stroke();
    } else if (id === 'star') {
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'redgiant') {
      ctx.fillStyle = '#ff9a72';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 220, 160, 0.55)';
      for (let i = 0; i < 3; i++) {
        const a = rand() * Math.PI * 2;
        const d = (0.3 + rand() * 0.3) * r;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'neutron') {
      // Bright core + cross sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = r * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy); ctx.lineTo(cx + r * 0.8, cy);
      ctx.moveTo(cx, cy - r * 0.8); ctx.lineTo(cx, cy + r * 0.8);
      ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (id === 'blackhole') {
      // Inner void swirl
      ctx.strokeStyle = 'rgba(160, 120, 255, 0.35)';
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0.4, 3.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.3, 2.6, 5.6);
      ctx.stroke();
    }
  }

  // ---------- kawaii faces (dynamic layer, always upright) ----------
  // state: 'normal' | 'blink' | 'happy' | 'panic' | 'eaten'
  drawFace(ctx, x, y, r, state, tier) {
    if (r < 7) return;
    const ex = r * 0.34;          // eye x offset
    const ey = -r * 0.12;         // eye y offset
    const er = r * 0.16;          // eye radius
    const dark = '#26203a';

    ctx.save();
    ctx.translate(x, y);

    if (tier === BLACKHOLE_TIER) {
      // Hungry little void: white crescent eyes + wide open mouth.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.09;
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * ex, ey, er, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, r * 0.3, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#181226';
      ctx.beginPath();
      ctx.arc(0, r * 0.32, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (state === 'eaten') {
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1.2, r * 0.07);
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * ex - er * 0.7, ey - er * 0.7); ctx.lineTo(sx * ex + er * 0.7, ey + er * 0.7);
        ctx.moveTo(sx * ex + er * 0.7, ey - er * 0.7); ctx.lineTo(sx * ex - er * 0.7, ey + er * 0.7);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (state === 'panic') {
      // Wide eyes, tiny pupils, wobbly open mouth
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx * ex, ey, er * 1.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(1, r * 0.045);
        ctx.stroke();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(sx * ex, ey + er * 0.2, er * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.32, r * 0.16, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (state === 'happy') {
      // ^ ^ eyes + big open smile
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1.2, r * 0.07);
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * ex, ey + er * 0.5, er, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(0, r * 0.22, r * 0.24, 0.15, Math.PI - 0.15);
      ctx.closePath();
      ctx.fill();
    } else if (state === 'blink') {
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1.2, r * 0.07);
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * ex - er * 0.8, ey);
        ctx.lineTo(sx * ex + er * 0.8, ey);
        ctx.stroke();
      }
      this.drawSmile(ctx, r, dark);
    } else {
      // Normal: dot eyes with light speck + soft smile
      for (const sx of [-1, 1]) {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(sx * ex, ey, er * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx * ex - er * 0.25, ey - er * 0.28, er * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      this.drawSmile(ctx, r, dark);
    }
    ctx.restore();
  }

  drawSmile(ctx, r, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, r * 0.14, r * 0.22, 0.35, Math.PI - 0.35);
    ctx.stroke();
  }

  faceState(b, game) {
    if (b.eaten > 0) return 'eaten';
    if (b.dangerTime > 0.05) return 'panic';
    if (b.happyUntil && game.time < b.happyUntil) return 'happy';
    if (((this.time * 0.7 + b.id * 1.37) % 3.7) < 0.14) return 'blink';
    return 'normal';
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

    // Bodies (art rotates with spin; faces stay upright on top)
    for (const b of game.physics.bodies) {
      const shrink = b.eaten > 0 ? Math.max(0.05, 1 - b.eaten) : 1;
      const sr = b.r * s * shrink;
      const spr = this.sprite(b.tier, b.r * s);
      const sx = b.x * s;
      const sy = b.y * s;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(b.tier === BLACKHOLE_TIER ? this.time * 1.5 : b.spin);
      const sc = sr / (b.r * s);
      ctx.scale(sc, sc);
      ctx.drawImage(spr.canvas, -spr.offset, -spr.offset);
      ctx.restore();

      this.drawFace(ctx, sx, sy, sr, this.faceState(b, game), b.tier);

      // Collapse countdown: red arc shrinking around an endangered body.
      if (b.dangerTime > 0.05 && b.eaten === 0) {
        const remaining = 1 - b.dangerTime / RULES.DANGER_TIME;
        const pulse = Math.sin(this.time * 12) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(255, 84, 112, ${0.65 + pulse * 0.35})`;
        ctx.lineWidth = Math.max(2, sr * 0.12);
        ctx.beginPath();
        ctx.arc(sx, sy, sr + Math.max(3, sr * 0.18), -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2);
        ctx.stroke();
      }
    }

    if (!game.over && !opts.hideLauncher) this.drawLauncher(ctx, s, game);

    particles.draw(ctx, s);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Red screen-edge vignette while anything is in the danger zone.
    if (game.dangerLevel > 0.05 && this.vignette) {
      ctx.globalAlpha = Math.min(0.85, game.dangerLevel) * (0.4 + 0.25 * (Math.sin(this.time * 10) * 0.5 + 0.5));
      ctx.drawImage(this.vignette, 0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
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

    // Danger ring — clearly visible at all times, alarming under pressure.
    const d = game.dangerLevel;
    const pulse = d > 0 ? (Math.sin(this.time * (6 + d * 10)) * 0.5 + 0.5) * d : 0;
    const alpha = 0.3 + d * 0.5 + pulse * 0.2;
    ctx.strokeStyle = d > 0.02 ? `rgba(255, 84, 112, ${alpha})` : 'rgba(255, 120, 140, 0.3)';
    ctx.lineWidth = 2 + d * 3 + pulse * 2;
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

    // Current piece sitting on the rim (with its face on — it's about to jump)
    const spr = this.sprite(game.currentTier, spec.r * s);
    ctx.globalAlpha = ready ? 1 : 0.45;
    ctx.drawImage(spr.canvas, lx - spr.offset, ly - spr.offset);
    this.drawFace(ctx, lx, ly, spec.r * s, 'normal', game.currentTier);
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
    if (this.reducedMotion === undefined) {
      this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    if (this.reducedMotion) return;
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
