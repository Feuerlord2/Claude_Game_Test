// Canvas renderer — "living cosmos" edition.
//
// Each tier has its own SILHOUETTE (irregular rocks, icy comets with tails,
// clean gravity-rounded worlds, ringed gas giants, coronal stars, pulsars,
// an accretion-disk black hole), its own MATERIAL and a per-body cosmetic
// variant so no two rocks look alike. One consistent light source (top-left)
// gives a single depth layer while keeping the kawaii charm.
//
// Split of work:
//   • baked sprite  — the static body: fill, texture, shading, outline, and
//     non-animated silhouette bits (moon craters, gas rings). Cached per
//     (tier, variant, radius); the cache stays tiny (~30 sprites).
//   • live overlays — the animated silhouette-breakers (comet tail, star
//     corona, pulsar beams, accretion disk). Drawn in world/screen space so
//     they ignore the body's physical spin; every one has a static
//     reduced-motion fallback.
//   • faces         — a dynamic layer, always upright, per-archetype.
//
// COLLISION IS ALWAYS A CIRCLE (b.r). Every shape here is a render overlay
// and never touches physics. Cosmetic randomness is seeded independently of
// the gameplay RNG, so the daily stays deterministic.

import { WORLD, TIERS, BLACKHOLE_TIER, RULES } from './config.js';
import { hashString, mulberry32 } from './rng.js';

const TAU = Math.PI * 2;
const GLOW_PAD = 1.0; // sprite margin as a fraction of body radius (room for baked rings/glow)

// Consistent light: top-left. Unit vector pointing FROM the surface TO the light.
const LX = -0.62, LY = -0.78;

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
    this.motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.resize();
  }

  reduced() { return this.motionQuery ? this.motionQuery.matches : false; }

  resize() {
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

  angleFromScreen(sx, sy) {
    return Math.atan2(sy - this.cy, sx - this.cx);
  }

  // ---------- background: parallax-ish depth via layered stars + nebula ----------
  renderBackground() {
    const c = this.bg;
    c.width = Math.round(this.w * this.dpr);
    c.height = Math.round(this.h * this.dpr);
    const ctx = c.getContext('2d');
    ctx.scale(this.dpr, this.dpr);

    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#080a1a');
    bg.addColorStop(1, '#04050d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const nebulae = [
      { x: 0.2, y: 0.24, r: 0.55, color: 'rgba(88, 60, 168, 0.18)' },
      { x: 0.86, y: 0.7, r: 0.6, color: 'rgba(168, 78, 96, 0.12)' },
      { x: 0.62, y: 0.12, r: 0.42, color: 'rgba(44, 96, 156, 0.13)' },
      { x: 0.1, y: 0.85, r: 0.4, color: 'rgba(52, 120, 130, 0.08)' },
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

    // Two star depth layers: far dim dust + near brighter stars with soft halos.
    const rand = mulberry32(hashString('starfield-v2'));
    for (let i = 0; i < 220; i++) {
      const x = rand() * this.w, y = rand() * this.h;
      const r = rand() * 0.8 + 0.15;
      const a = rand() * 0.35 + 0.1;
      ctx.fillStyle = `rgba(200, 214, 255, ${a})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 34; i++) {
      const x = rand() * this.w, y = rand() * this.h;
      const r = rand() * 1.3 + 0.7;
      const a = rand() * 0.4 + 0.35;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, `rgba(235, 240, 255, ${a})`);
      g.addColorStop(1, 'rgba(235,240,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill();
    }
  }

  // ---------- sprite cache ----------
  sprite(tier, screenR, variant = 0) {
    const key = (tier * 8 + variant) * 4096 + Math.min(4000, Math.round(screenR));
    let s = this.spriteCache.get(key);
    if (!s) {
      s = this.bakeSprite(tier, Math.max(2, Math.round(screenR)), variant);
      this.spriteCache.set(key, s);
    }
    return s;
  }

  bakeSprite(tier, r, variant) {
    const spec = TIERS[tier];
    const pad = Math.ceil(r * GLOW_PAD) + 2;
    const size = (r + pad) * 2;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const rand = mulberry32(hashString(spec.id + '#' + variant));

    switch (spec.shape) {
      case 'mote':   this.bakeMote(ctx, cx, cy, r, rand, spec); break;
      case 'rock':   this.bakeRock(ctx, cx, cy, r, rand, spec); break;
      case 'ice':    this.bakeIce(ctx, cx, cy, r, rand, spec); break;
      case 'round':  this.bakeWorld(ctx, cx, cy, r, rand, spec); break;
      case 'ringed': this.bakeGasGiant(ctx, cx, cy, r, rand, spec); break;
      case 'star':   this.bakeStar(ctx, cx, cy, r, rand, spec); break;
      case 'giant':  this.bakeGiant(ctx, cx, cy, r, rand, spec); break;
      case 'pulsar': this.bakePulsarCore(ctx, cx, cy, r, rand, spec); break;
      case 'void':   this.bakeVoid(ctx, cx, cy, r, rand, spec); break;
      default:       this.bakeWorld(ctx, cx, cy, r, rand, spec);
    }
    return { canvas: c, offset: r + pad };
  }

  // ---------- geometry helpers ----------
  // Irregular closed blob, returned as a vertex list (reused for fill/clip/outline).
  blob(r, points, jitter, rand, elong = 1, rot = 0) {
    const v = [];
    // Smooth the per-vertex radii a touch so rocks read chunky, not spiky.
    const raw = [];
    for (let i = 0; i < points; i++) raw.push(1 - jitter + rand() * jitter * 2);
    for (let i = 0; i < points; i++) {
      const rr = (raw[i] * 2 + raw[(i + 1) % points] + raw[(i + points - 1) % points]) / 4;
      const a = (i / points) * TAU + rot;
      v.push([Math.cos(a) * r * rr * elong, Math.sin(a) * r * rr]);
    }
    return v;
  }

  tracePath(ctx, verts) {
    ctx.beginPath();
    ctx.moveTo(verts[0][0], verts[0][1]);
    // Quadratic smoothing through midpoints for a hand-drawn edge.
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.closePath();
  }

  // One depth layer: sphere shading offset toward the top-left light.
  shadeSphere(ctx, cx, cy, r, base, opts = {}) {
    const hi = opts.hi ?? this.lighten(base, 0.5);
    const mid = base;
    const lo = opts.lo ?? this.darken(base, 0.42);
    const g = ctx.createRadialGradient(
      cx + LX * r * 0.5, cy + LY * r * 0.5, r * 0.1,
      cx, cy, r * 1.02
    );
    g.addColorStop(0, hi);
    g.addColorStop(0.5, mid);
    g.addColorStop(1, lo);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  }

  // Thin bright crescent along the lit (top-left) edge.
  rimLight(ctx, cx, cy, r, color, w) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = w ?? Math.max(1.2, r * 0.14);
    ctx.beginPath();
    const la = Math.atan2(LY, LX);
    ctx.arc(cx + LX * r * 0.12, cy + LY * r * 0.12, r * 0.96, la - 1.15, la + 1.15);
    ctx.stroke();
    ctx.restore();
  }

  stickerOutline(ctx, cx, cy, r, color, w, rand) {
    // Slightly wobbly circle — machine-perfect reads as AI, a touch of jitter
    // reads as hand-drawn.
    const verts = this.blob(r - w * 0.35, 40, rand ? 0.012 : 0, rand || Math.random, 1, 0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    this.tracePath(ctx, verts);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- per-tier bakers ----------
  bakeMote(ctx, cx, cy, r, rand, spec) {
    // Soft warm glow + a small irregular cluster of sparks. Not round.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.7);
    glow.addColorStop(0, this.rgba(spec.glow, 0.9));
    glow.addColorStop(0.4, this.rgba(spec.glow, 0.4));
    glow.addColorStop(1, this.rgba(spec.glow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cx * 2, cy * 2);

    ctx.fillStyle = '#fffdf0';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.fill();
    // sparkle spikes (4-point star)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (const [len, wid] of [[1.15, 0.13], [0.8, 0.09]]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rand() * TAU);
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-r * wid, r * 0.2);
        ctx.lineTo(0, r * len);
        ctx.lineTo(r * wid, r * 0.2);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // tiny satellite motes
    ctx.fillStyle = this.rgba(spec.glow, 0.8);
    for (let i = 0; i < 3; i++) {
      const a = rand() * TAU, d = r * (0.7 + rand() * 0.5);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.12, 0, TAU); ctx.fill();
    }
  }

  bakeRock(ctx, cx, cy, r, rand, spec) {
    const elong = 0.85 + rand() * 0.3;
    const rot = rand() * TAU;
    const verts = this.blob(r * 0.96, 11, 0.26, rand, elong, rot);
    ctx.save();
    ctx.translate(cx, cy);

    // fill + directional shading, clipped to the lumpy silhouette
    this.tracePath(ctx, verts);
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(LX * r, LY * r, -LX * r, -LY * r);
    g.addColorStop(0, this.lighten(spec.color, 0.32));
    g.addColorStop(0.55, spec.color);
    g.addColorStop(1, this.darken(spec.color, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);

    // speckle texture (seeded → every rock unique)
    for (let i = 0; i < 22; i++) {
      const a = rand() * TAU, d = rand() * r * 0.85;
      const x = Math.cos(a) * d * elong, y = Math.sin(a) * d;
      ctx.fillStyle = this.rgba(rand() < 0.5 ? this.darken(spec.color, 0.4) : this.lighten(spec.color, 0.3), 0.5);
      ctx.beginPath(); ctx.arc(x, y, r * (0.03 + rand() * 0.05), 0, TAU); ctx.fill();
    }
    // craters with a lit rim + shadowed floor
    const craters = spec.id === 'meteoroid' ? 2 : 3;
    for (let i = 0; i < craters; i++) {
      const a = rand() * TAU, d = rand() * r * 0.5;
      const x = Math.cos(a) * d * elong, y = Math.sin(a) * d;
      const cr = r * (0.14 + rand() * 0.14);
      ctx.fillStyle = this.rgba(this.darken(spec.color, 0.5), 0.85);
      ctx.beginPath(); ctx.arc(x, y, cr, 0, TAU); ctx.fill();
      ctx.strokeStyle = this.rgba(this.lighten(spec.color, 0.4), 0.6);
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath(); ctx.arc(x - LX * cr * 0.3, y - LY * cr * 0.3, cr * 0.9, 0, TAU); ctx.stroke();
    }
    // scorch/glow rim for the fresh meteoroid
    if (spec.id === 'meteoroid') {
      ctx.strokeStyle = 'rgba(255,150,70,0.5)';
      ctx.lineWidth = r * 0.12;
      this.tracePath(ctx, verts); ctx.stroke();
    }
    ctx.restore();

    // chunky outline
    ctx.strokeStyle = this.darken(spec.color, 0.62);
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.lineJoin = 'round';
    this.tracePath(ctx, verts); ctx.stroke();
    ctx.restore();
  }

  bakeIce(ctx, cx, cy, r, rand, spec) {
    const verts = this.blob(r * 0.9, 12, 0.14, rand, 1, rand() * TAU);
    ctx.save(); ctx.translate(cx, cy);
    this.tracePath(ctx, verts);
    ctx.save(); ctx.clip();
    const g = ctx.createRadialGradient(LX * r * 0.4, LY * r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, spec.color);
    g.addColorStop(1, this.darken(spec.color, 0.4));
    ctx.fillStyle = g;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    // icy facets
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 3; i++) {
      const a = rand() * TAU, d = rand() * r * 0.4;
      ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(rand() * TAU);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.3); ctx.lineTo(r * 0.16, 0); ctx.lineTo(0, r * 0.3); ctx.lineTo(-r * 0.16, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = this.darken(spec.color, 0.5);
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.lineJoin = 'round';
    this.tracePath(ctx, verts); ctx.stroke();
    ctx.restore();
  }

  bakeWorld(ctx, cx, cy, r, rand, spec) {
    // Clean gravity-rounded sphere with one depth layer.
    this.shadeSphere(ctx, cx, cy, r, spec.color);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();

    if (spec.id === 'moon') {
      for (let i = 0; i < 6; i++) {
        const a = rand() * TAU, d = rand() * r * 0.8;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        const cr = r * (0.08 + rand() * 0.14);
        ctx.fillStyle = this.rgba(this.darken(spec.color, 0.28), 0.8);
        ctx.beginPath(); ctx.arc(x, y, cr, 0, TAU); ctx.fill();
        ctx.fillStyle = this.rgba(this.lighten(spec.color, 0.35), 0.5);
        ctx.beginPath(); ctx.arc(x - LX * cr * 0.35, y - LY * cr * 0.35, cr * 0.7, 0, TAU); ctx.fill();
      }
    } else if (spec.id === 'planet') {
      // ocean base already; paint irregular continents + polar caps
      ctx.fillStyle = '#43b56f';
      for (let i = 0; i < 3; i++) {
        const a = rand() * TAU, d = rand() * r * 0.5;
        const cverts = this.blob(r * (0.34 + rand() * 0.18), 9, 0.4, rand, 1.1, rand() * TAU);
        ctx.save(); ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
        this.tracePath(ctx, cverts); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.86, r * 0.5, r * 0.22, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.86, r * 0.42, r * 0.18, 0, 0, TAU); ctx.fill();
      // cloud wisps
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 3; i++) {
        const y = cy + (rand() - 0.5) * r * 1.2, x = cx + (rand() - 0.5) * r;
        ctx.beginPath(); ctx.ellipse(x, y, r * 0.3, r * 0.08, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();

    // atmosphere rim glow for the planet
    if (spec.id === 'planet') {
      ctx.strokeStyle = 'rgba(150,210,255,0.6)';
      ctx.lineWidth = Math.max(1.2, r * 0.07);
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, TAU); ctx.stroke();
    }
    this.rimLight(ctx, cx, cy, r, 'rgba(255,255,255,0.5)');
    this.stickerOutline(ctx, cx, cy, r, this.darken(spec.color, 0.55), Math.max(1.5, r * 0.08), rand);
  }

  bakeGasGiant(ctx, cx, cy, r, rand, spec) {
    // Back half of the ring (behind the body)
    const ringRot = -0.42;
    this.gasRing(ctx, cx, cy, r, spec, ringRot, true);

    this.shadeSphere(ctx, cx, cy, r, spec.color, { hi: this.lighten(spec.color, 0.4), lo: this.darken(spec.color, 0.4) });
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    // banding
    const bandCols = [this.lighten(spec.color, 0.32), this.darken(spec.color, 0.16), this.lighten(spec.color, 0.14)];
    let y = -r;
    let bi = 0;
    while (y < r) {
      const bh = r * (0.16 + rand() * 0.16);
      ctx.fillStyle = bandCols[bi % bandCols.length];
      ctx.fillRect(cx - r, cy + y, r * 2, bh + 0.5);
      y += bh; bi++;
    }
    // storm spot
    ctx.fillStyle = '#e0552f';
    ctx.beginPath(); ctx.ellipse(cx + r * 0.3, cy + r * 0.28, r * 0.22, r * 0.13, 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = this.darken('#e0552f', 0.4); ctx.lineWidth = Math.max(1, r * 0.03); ctx.stroke();
    ctx.restore();

    this.rimLight(ctx, cx, cy, r, 'rgba(255,240,210,0.45)');
    this.stickerOutline(ctx, cx, cy, r, this.darken(spec.color, 0.5), Math.max(1.5, r * 0.08), rand);

    // Front half of the ring (over the body)
    this.gasRing(ctx, cx, cy, r, spec, ringRot, false);
  }

  gasRing(ctx, cx, cy, r, spec, rot, back) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot);
    const rx = r * 1.7, ry = r * 0.52;
    ctx.lineWidth = r * 0.16;
    // clip to top (back) or bottom (front) half so the ring passes behind/in front
    ctx.beginPath();
    if (back) ctx.rect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 1.2);
    else ctx.rect(-rx * 1.2, 0, rx * 2.4, ry * 1.2);
    ctx.clip();
    ctx.strokeStyle = this.darken(spec.color, 0.35);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = this.rgba(this.lighten(spec.color, 0.3), 0.9);
    ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  bakeStar(ctx, cx, cy, r, rand, spec) {
    // baked warm core + granulation; the corona is a live overlay
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#fff6cf');
    g.addColorStop(0.6, spec.color);
    g.addColorStop(1, this.darken(spec.color, 0.25));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.fillStyle = this.rgba(this.lighten(spec.color, 0.45), 0.5);
    for (let i = 0; i < 10; i++) {
      const a = rand() * TAU, d = rand() * r * 0.85;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.05 + rand() * 0.07), 0, TAU); ctx.fill();
    }
    // a couple of darker sunspots
    ctx.fillStyle = this.rgba(this.darken(spec.color, 0.3), 0.5);
    for (let i = 0; i < 2; i++) {
      const a = rand() * TAU, d = rand() * r * 0.6;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  bakeGiant(ctx, cx, cy, r, rand, spec) {
    // Puffy, fuzzy-edged bloated star: soft fringe + mottled surface.
    const fringe = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.02);
    fringe.addColorStop(0, this.rgba(spec.glow, 0.0));
    fringe.addColorStop(0.7, this.rgba(spec.glow, 0.35));
    fringe.addColorStop(1, this.rgba(spec.glow, 0));
    // slightly irregular puffy body
    const verts = this.blob(r * 0.94, 16, 0.06, rand, 1, rand() * TAU);
    ctx.save(); ctx.translate(cx, cy);
    this.tracePath(ctx, verts);
    ctx.save(); ctx.clip();
    const g = ctx.createRadialGradient(LX * r * 0.3, LY * r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, this.lighten(spec.color, 0.3));
    g.addColorStop(0.6, spec.color);
    g.addColorStop(1, this.darken(spec.color, 0.35));
    ctx.fillStyle = g; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    ctx.fillStyle = this.rgba(this.lighten(spec.color, 0.35), 0.4);
    for (let i = 0; i < 6; i++) {
      const a = rand() * TAU, d = rand() * r * 0.7;
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.08 + rand() * 0.1), 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    // soft fuzzy fringe on top (no hard outline — the edge should waver)
    ctx.fillStyle = fringe;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, 0, TAU); ctx.fill();
  }

  bakePulsarCore(ctx, cx, cy, r, rand, spec) {
    // Tiny, intense blue-white core + tight magnetic glow. Beams are live.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.15);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.4, this.rgba(spec.glow, 0.85));
    glow.addColorStop(1, this.rgba(spec.glow, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = this.rgba(spec.glow, 0.5);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.fill();
  }

  bakeVoid(ctx, cx, cy, r, rand, spec) {
    // Deep void core with a faint purple event-horizon glint. Disk is live.
    const g = ctx.createRadialGradient(cx - LX * r * 0.2, cy - LY * r * 0.2, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#1c1630');
    g.addColorStop(0.7, '#0a0812');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    // bright photon rim (cheap lensing hint)
    ctx.strokeStyle = this.rgba(spec.glow, 0.9);
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.98, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,150,255,0.3)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0.4, 3.6); ctx.stroke();
  }

  // ---------- live silhouette-breaking overlays (world/screen space) ----------
  drawBehind(ctx, b, sx, sy, sr, game) {
    const spec = TIERS[b.tier];
    const t = this.reduced() ? 0 : this.time;
    switch (spec.shape) {
      case 'mote': {
        const tw = 0.7 + 0.3 * Math.sin(t * 3 + b.cosmeticSeed);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.1);
        g.addColorStop(0, this.rgba(spec.glow, 0.35 * tw));
        g.addColorStop(1, this.rgba(spec.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, sr * 2.1, 0, TAU); ctx.fill();
        break;
      }
      case 'ice': {
        // Tail streams radially away from the gravity centre (the "sun").
        const ang = Math.atan2(sy, sx); // centre is at (0,0) in this transform
        const len = sr * (2.6 + 0.4 * Math.sin(t * 4 + b.cosmeticSeed));
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, this.rgba(spec.glow, 0.5));
        g.addColorStop(1, this.rgba(spec.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -sr * 0.75);
        ctx.quadraticCurveTo(len * 0.6, -sr * 0.2, len, 0);
        ctx.quadraticCurveTo(len * 0.6, sr * 0.2, 0, sr * 0.75);
        ctx.closePath(); ctx.fill();
        // ion streak
        ctx.strokeStyle = this.rgba('#ffffff', 0.35);
        ctx.lineWidth = Math.max(1, sr * 0.06);
        ctx.beginPath(); ctx.moveTo(sr * 0.4, 0); ctx.lineTo(len * 0.9, 0); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'star': {
        const pulse = 1 + (this.reduced() ? 0 : 0.06 * Math.sin(t * 2.2 + b.cosmeticSeed));
        const cr = sr * 1.7 * pulse;
        const g = ctx.createRadialGradient(sx, sy, sr * 0.8, sx, sy, cr);
        g.addColorStop(0, this.rgba(spec.glow, 0.4));
        g.addColorStop(1, this.rgba(spec.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, cr, 0, TAU); ctx.fill();
        // soft corona rays
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.15);
        ctx.fillStyle = this.rgba(spec.glow, 0.22);
        for (let i = 0; i < 12; i++) {
          ctx.rotate(TAU / 12);
          ctx.beginPath();
          ctx.moveTo(-sr * 0.12, sr * 0.9);
          ctx.lineTo(0, sr * (1.55 + 0.12 * Math.sin(t * 3 + i)));
          ctx.lineTo(sr * 0.12, sr * 0.9);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'giant': {
        const cr = sr * 1.35;
        const g = ctx.createRadialGradient(sx, sy, sr * 0.7, sx, sy, cr);
        g.addColorStop(0, this.rgba(spec.glow, 0.3));
        g.addColorStop(1, this.rgba(spec.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, cr, 0, TAU); ctx.fill();
        break;
      }
      case 'pulsar': {
        // Two opposite lighthouse beams, slowly swinging.
        const ang = (this.reduced() ? 0.6 : t * 0.6) + b.cosmeticSeed;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
        for (const dir of [-1, 1]) {
          const g = ctx.createLinearGradient(0, 0, 0, dir * sr * 4);
          g.addColorStop(0, this.rgba(spec.glow, 0.55));
          g.addColorStop(1, this.rgba(spec.glow, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(-sr * 0.28, 0);
          ctx.lineTo(-sr * 0.9, dir * sr * 4);
          ctx.lineTo(sr * 0.9, dir * sr * 4);
          ctx.lineTo(sr * 0.28, 0);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'void': {
        // Accretion disk: a bright spiralling ellipse ring, hotter while feeding.
        const feeding = b.bhBirth !== undefined && (game.time - b.bhBirth) <= RULES.BLACKHOLE_FEED_TIME;
        const spin = this.reduced() ? 0.5 : t * 1.4;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.5);
        const rx = sr * 1.75, ry = sr * 0.55;
        // back half
        ctx.lineWidth = sr * 0.22;
        ctx.strokeStyle = this.rgba(spec.glow, feeding ? 0.9 : 0.55);
        ctx.save(); ctx.beginPath(); ctx.rect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 1.2); ctx.clip();
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
        ctx.restore();
        // hot inner streaks
        ctx.strokeStyle = this.rgba('#ffd9a0', feeding ? 0.8 : 0.4);
        ctx.lineWidth = sr * 0.08;
        for (let i = 0; i < 5; i++) {
          const a = spin + i * (TAU / 5);
          ctx.beginPath();
          ctx.ellipse(0, 0, rx * 0.92, ry * 0.92, 0, a, a + 0.5);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
    }
  }

  drawFront(ctx, b, sx, sy, sr, game) {
    const spec = TIERS[b.tier];
    const t = this.reduced() ? 0 : this.time;
    if (spec.shape === 'void') {
      // Front half of the accretion disk, over the core.
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.5);
      const rx = sr * 1.75, ry = sr * 0.55;
      ctx.beginPath(); ctx.rect(-rx * 1.2, 0, rx * 2.4, ry * 1.2); ctx.clip();
      const feeding = b.bhBirth !== undefined && (game.time - b.bhBirth) <= RULES.BLACKHOLE_FEED_TIME;
      ctx.lineWidth = sr * 0.22;
      ctx.strokeStyle = this.rgba(spec.glow, feeding ? 1 : 0.7);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    } else if (spec.shape === 'pulsar') {
      // core twinkle
      const a = 0.5 + 0.5 * Math.abs(Math.sin(t * 4 + b.cosmeticSeed));
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * a})`;
      ctx.lineWidth = Math.max(1, sr * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - sr * 1.1, sy); ctx.lineTo(sx + sr * 1.1, sy);
      ctx.moveTo(sx, sy - sr * 1.1); ctx.lineTo(sx, sy + sr * 1.1);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // Subtle per-frame body pulse for luminous tiers (kept tiny, reduced-motion safe).
  renderPulse(b) {
    if (this.reduced()) return 1;
    const spec = TIERS[b.tier];
    if (spec.shape === 'giant') return 1 + 0.03 * Math.sin(this.time * 1.6 + b.cosmeticSeed);
    if (spec.shape === 'star') return 1 + 0.02 * Math.sin(this.time * 2.4 + b.cosmeticSeed);
    return 1;
  }

  // ---------- faces: dynamic, upright, per-archetype ----------
  drawFace(ctx, x, y, r, state, tier) {
    if (r < 6.5) return;
    const spec = TIERS[tier];
    const fs = spec ? spec.faceScale : 1;
    const R = r * fs;
    const ex = R * 0.34, ey = -R * 0.1, er = R * 0.16;
    const dark = spec && spec.family === 'star' ? '#5a2a12' : '#26203a';

    ctx.save();
    ctx.translate(x, y);

    if (tier === BLACKHOLE_TIER) { this.faceHungry(ctx, R, er, ex, ey); ctx.restore(); return; }
    if (state === 'eaten') { this.faceEaten(ctx, R, er, ex, ey, dark); ctx.restore(); return; }
    if (state === 'panic') { this.facePanic(ctx, R, er, ex, ey, dark); ctx.restore(); return; }
    if (state === 'happy') { this.faceHappy(ctx, R, er, ex, ey, dark); ctx.restore(); return; }
    if (state === 'blink') {
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, R * 0.07); ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * ex - er * 0.8, ey); ctx.lineTo(s * ex + er * 0.8, ey); ctx.stroke(); }
      this.drawSmile(ctx, R, dark);
      ctx.restore(); return;
    }
    // archetype resting expression
    switch (spec ? spec.face : 'calm') {
      case 'grumpy':  this.faceGrumpy(ctx, R, er, ex, ey, dark); break;
      case 'excited': this.faceExcited(ctx, R, er, ex, ey, dark); break;
      case 'sleepy':  this.faceSleepy(ctx, R, er, ex, ey, dark); break;
      case 'radiant': this.faceRadiant(ctx, R, er, ex, ey, dark); break;
      default:        this.faceCalm(ctx, R, er, ex, ey, dark);
    }
    ctx.restore();
  }

  eyeDot(ctx, x, y, er, dark, look = 0) {
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(x, y, er * 0.78, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - er * 0.26, y - er * 0.3, er * 0.28, 0, TAU); ctx.fill();
  }

  faceCalm(ctx, R, er, ex, ey, dark) {
    for (const s of [-1, 1]) this.eyeDot(ctx, s * ex, ey, er, dark);
    this.drawSmile(ctx, R, dark);
  }

  faceGrumpy(ctx, R, er, ex, ey, dark) {
    for (const s of [-1, 1]) this.eyeDot(ctx, s * ex, ey + er * 0.15, er * 0.85, dark);
    // angry slanted brows
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, R * 0.07); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * (ex - er), ey - er * 1.2);
      ctx.lineTo(s * (ex + er * 0.6), ey - er * 0.4);
      ctx.stroke();
    }
    // flat/frown mouth
    ctx.beginPath(); ctx.arc(0, R * 0.42, R * 0.2, Math.PI + 0.4, TAU - 0.4); ctx.stroke();
  }

  faceExcited(ctx, R, er, ex, ey, dark) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s * ex, ey, er * 1.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, R * 0.04); ctx.stroke();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(s * ex, ey + er * 0.1, er * 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s * ex - er * 0.2, ey - er * 0.2, er * 0.22, 0, TAU); ctx.fill();
    }
    // open little 'o' mouth
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, R * 0.34, R * 0.12, R * 0.15, 0, 0, TAU); ctx.fill();
  }

  faceSleepy(ctx, R, er, ex, ey, dark) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, R * 0.06); ctx.lineCap = 'round';
    // half-lidded: an arc over a short lash line
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(s * ex, ey + er * 0.2, er * 0.9, Math.PI + 0.3, TAU - 0.3); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, R * 0.34, R * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  faceRadiant(ctx, R, er, ex, ey, dark) {
    // sparkly closed-happy eyes + big smile
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, R * 0.08); ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex, ey + er * 0.5, er, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(0, R * 0.2, R * 0.22, 0.15, Math.PI - 0.15); ctx.closePath(); ctx.fill();
  }

  faceHappy(ctx, R, er, ex, ey, dark) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, R * 0.07); ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex, ey + er * 0.5, er, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(0, R * 0.22, R * 0.24, 0.15, Math.PI - 0.15); ctx.closePath(); ctx.fill();
  }

  facePanic(ctx, R, er, ex, ey, dark) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s * ex, ey, er * 1.25, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, R * 0.045); ctx.stroke();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(s * ex, ey + er * 0.2, er * 0.4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, R * 0.34, R * 0.16, R * 0.22, 0, 0, TAU); ctx.fill();
  }

  faceEaten(ctx, R, er, ex, ey, dark) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, R * 0.07); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * ex - er * 0.7, ey - er * 0.7); ctx.lineTo(s * ex + er * 0.7, ey + er * 0.7);
      ctx.moveTo(s * ex + er * 0.7, ey - er * 0.7); ctx.lineTo(s * ex - er * 0.7, ey + er * 0.7);
      ctx.stroke();
    }
  }

  faceHungry(ctx, R, er, ex, ey) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = R * 0.09; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex, ey, er, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, R * 0.3, R * 0.22, 0, TAU); ctx.fill();
    ctx.fillStyle = '#140f22';
    ctx.beginPath(); ctx.arc(0, R * 0.32, R * 0.15, 0, TAU); ctx.fill();
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
    if (((this.time * 0.7 + (b.cosmeticSeed % 997) * 0.013) % 3.9) < 0.13) return 'blink';
    return 'normal';
  }

  // ---------- main draw ----------
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

    for (const b of game.physics.bodies) {
      const spec = TIERS[b.tier];
      const variant = b.cosmeticSeed % spec.variants;
      const shrink = b.eaten > 0 ? Math.max(0.05, 1 - b.eaten) : 1;
      const pulse = this.renderPulse(b);
      const sr = b.r * s * shrink * pulse;
      const sx = b.x * s, sy = b.y * s;

      this.drawBehind(ctx, b, sx, sy, sr, game);

      const spr = this.sprite(b.tier, b.r * s, variant);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(b.tier === BLACKHOLE_TIER ? this.time * 1.5 : b.spin);
      const sc = sr / (b.r * s);
      ctx.scale(sc, sc);
      ctx.drawImage(spr.canvas, -spr.offset, -spr.offset);
      ctx.restore();

      this.drawFront(ctx, b, sx, sy, sr, game);
      this.drawFace(ctx, sx, sy, sr, this.faceState(b, game), b.tier);

      if (b.dangerTime > 0.05 && b.eaten === 0) {
        const remaining = 1 - b.dangerTime / RULES.DANGER_TIME;
        const p = Math.sin(this.time * 12) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(255, 84, 112, ${0.65 + p * 0.35})`;
        ctx.lineWidth = Math.max(2, sr * 0.12);
        ctx.beginPath();
        ctx.arc(sx, sy, sr + Math.max(3, sr * 0.2), -Math.PI / 2, -Math.PI / 2 + remaining * TAU);
        ctx.stroke();
      }
    }

    if (!game.over && !opts.hideLauncher) this.drawLauncher(ctx, s, game);

    particles.draw(ctx, s);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (game.dangerLevel > 0.05 && this.vignette) {
      const flick = this.reduced() ? 0.55 : (0.4 + 0.25 * (Math.sin(this.time * 10) * 0.5 + 0.5));
      ctx.globalAlpha = Math.min(0.85, game.dangerLevel) * flick;
      ctx.drawImage(this.vignette, 0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
  }

  drawWell(ctx, s) {
    ctx.fillStyle = this.wellGradient;
    ctx.beginPath(); ctx.arc(0, 0, this.wellR, 0, TAU); ctx.fill();
    // gravity swirl — a couple of faint spiralling arcs to explain the pull
    const t = this.reduced() ? 0 : this.time * 0.4;
    ctx.strokeStyle = 'rgba(127, 107, 255, 0.22)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const a0 = t + k * (TAU / 3);
      ctx.beginPath();
      ctx.arc(0, 0, 8 * s * (0.5 + k * 0.4), a0, a0 + 1.9);
      ctx.stroke();
    }
  }

  drawRings(ctx, s, game) {
    // Outer launcher orbit — solid faint hairline.
    ctx.strokeStyle = 'rgba(150, 160, 200, 0.14)';
    ctx.lineWidth = 1;
    ctx.setLineDash(DASH_NONE);
    ctx.beginPath(); ctx.arc(0, 0, WORLD.R * s, 0, TAU); ctx.stroke();

    // Danger ring — bold dashed, clearly different from the outer orbit.
    const d = game.dangerLevel;
    const pulse = d > 0 ? (Math.sin(this.time * (6 + d * 10)) * 0.5 + 0.5) * d : 0;
    const alpha = 0.34 + d * 0.5 + pulse * 0.2;
    ctx.strokeStyle = d > 0.02 ? `rgba(255, 84, 112, ${alpha})` : 'rgba(255, 110, 132, 0.34)';
    ctx.lineWidth = 2.5 + d * 3 + pulse * 2;
    ctx.setLineDash(DASH_DANGER);
    ctx.beginPath(); ctx.arc(0, 0, WORLD.DANGER_R * s, 0, TAU); ctx.stroke();
    ctx.setLineDash(DASH_NONE);
  }

  drawLauncher(ctx, s, game) {
    const a = game.aimAngle;
    const spec = TIERS[game.currentTier];
    const lx = Math.cos(a) * WORLD.SPAWN_R * s;
    const ly = Math.sin(a) * WORLD.SPAWN_R * s;

    const ready = game.dropCooldown <= 0;
    ctx.strokeStyle = ready ? 'rgba(232, 236, 255, 0.30)' : 'rgba(139, 147, 184, 0.12)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash(DASH_AIM);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(Math.cos(a) * 20 * s, Math.sin(a) * 20 * s);
    ctx.stroke();
    ctx.setLineDash(DASH_NONE);

    const spr = this.sprite(game.currentTier, spec.r * s, 0);
    ctx.globalAlpha = ready ? 1 : 0.5;
    ctx.drawImage(spr.canvas, lx - spr.offset, ly - spr.offset);
    this.drawFace(ctx, lx, ly, spec.r * s, 'normal', game.currentTier);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(232, 236, 255, 0.5)';
    ctx.lineWidth = 2;
    const rr = WORLD.R * s + 8;
    for (const off of CHEVRON_OFFS) {
      ctx.beginPath();
      ctx.arc(0, 0, rr, a + off - 0.03, a + off + 0.03);
      ctx.stroke();
    }
  }

  addShake(amount) {
    if (this.reduced()) return;
    this.shake = Math.min(26, this.shake + amount);
  }

  // ---- color helpers ----
  hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  rgba(hex, a) {
    if (hex[0] !== '#') return hex;
    const [r, g, b] = this.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  toHex(r, g, b) {
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
  }
  lighten(hex, f) {
    const [r, g, b] = this.hexToRgb(hex);
    return this.toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
  }
  darken(hex, f) {
    const [r, g, b] = this.hexToRgb(hex);
    return this.toHex(r * (1 - f), g * (1 - f), b * (1 - f));
  }
}
