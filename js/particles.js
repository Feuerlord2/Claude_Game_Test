// Pooled particle system: merge bursts, shockwave rings, floating score text.
// Positions are in world units; drawn in the renderer's world transform.

import { TIERS } from './config.js';

const MAX_PARTICLES = 400;

export class Particles {
  constructor() {
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  spawnBurst(x, y, tier, count = 14) {
    const spec = TIERS[tier];
    const n = Math.min(count, MAX_PARTICLES - this.items.length);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 55;
      this.items.push({
        kind: 'dot',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 1.6 + Math.random() * 1.2,
        size: 0.8 + Math.random() * 1.6 + tier * 0.12,
        color: spec.glow,
      });
    }
  }

  spawnRing(x, y, tier, scale = 1) {
    if (this.items.length >= MAX_PARTICLES) return;
    const spec = TIERS[tier];
    this.items.push({
      kind: 'ring',
      x, y,
      life: 1,
      decay: 2.2,
      size: TIERS[tier].r * 0.8,
      grow: 60 * scale,
      color: spec.glow,
    });
  }

  spawnText(x, y, text, color = '#ffd75e') {
    if (this.items.length >= MAX_PARTICLES) return;
    this.items.push({
      kind: 'text',
      x, y,
      vx: 0,
      vy: -14,
      life: 1,
      decay: 1.1,
      text,
      color,
    });
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        items[i] = items[items.length - 1];
        items.pop();
        continue;
      }
      if (p.kind === 'dot' || p.kind === 'text') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'dot') {
          p.vx *= 0.96;
          p.vy *= 0.96;
        }
      } else if (p.kind === 'ring') {
        p.size += p.grow * dt;
      }
    }
  }

  draw(ctx, s) {
    for (const p of this.items) {
      const a = Math.max(0, Math.min(1, p.life));
      if (p.kind === 'dot') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * s, p.y * s, p.size * s * 0.35 * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = a * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * a + 0.5;
        ctx.beginPath();
        ctx.arc(p.x * s, p.y * s, p.size * s, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'text') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.font = `800 ${Math.round(4.5 * s)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x * s, p.y * s);
      }
    }
    ctx.globalAlpha = 1;
  }
}
