// Cosmetic meta-progression — the serverless week-2 retention hook.
// Cumulative play stats + streak milestones unlock arena themes and face
// sets. Everything lives in localStorage; unlock state is DERIVED from the
// stats every time (nothing to migrate, nothing to get out of sync).

import { Storage } from './storage.js';
import { getStreak } from './daily.js';

// ---------- lifetime stats ----------
const STATS_DEFAULT = { games: 0, merges: 0, score: 0, bh: 0, bestTier: 0 };

export function getStats() {
  return { ...STATS_DEFAULT, ...Storage.get('stats', {}) };
}

export function bumpStats(delta) {
  const s = getStats();
  s.games += delta.games || 0;
  s.merges += delta.merges || 0;
  s.score += delta.score || 0;
  s.bh += delta.bh || 0;
  s.bestTier = Math.max(s.bestTier, delta.bestTier || 0);
  Storage.set('stats', s);
  return s;
}

// ---------- arena themes (background palettes) ----------
export const THEMES = {
  default: {
    bgTop: '#080a1a', bgBottom: '#04050d',
    nebulae: [
      { x: 0.2, y: 0.24, r: 0.55, color: 'rgba(88, 60, 168, 0.18)' },
      { x: 0.86, y: 0.7, r: 0.6, color: 'rgba(168, 78, 96, 0.12)' },
      { x: 0.62, y: 0.12, r: 0.42, color: 'rgba(44, 96, 156, 0.13)' },
      { x: 0.1, y: 0.85, r: 0.4, color: 'rgba(52, 120, 130, 0.08)' },
    ],
  },
  aurora: {
    bgTop: '#06121a', bgBottom: '#030a0c',
    nebulae: [
      { x: 0.25, y: 0.2, r: 0.6, color: 'rgba(40, 180, 130, 0.16)' },
      { x: 0.8, y: 0.55, r: 0.55, color: 'rgba(60, 130, 200, 0.14)' },
      { x: 0.5, y: 0.85, r: 0.45, color: 'rgba(120, 220, 160, 0.08)' },
    ],
  },
  crimson: {
    bgTop: '#170812', bgBottom: '#0a0308',
    nebulae: [
      { x: 0.3, y: 0.25, r: 0.6, color: 'rgba(220, 60, 90, 0.15)' },
      { x: 0.78, y: 0.7, r: 0.55, color: 'rgba(255, 120, 60, 0.10)' },
      { x: 0.55, y: 0.1, r: 0.4, color: 'rgba(160, 40, 120, 0.14)' },
    ],
  },
  golden: {
    bgTop: '#141008', bgBottom: '#080604',
    nebulae: [
      { x: 0.25, y: 0.22, r: 0.55, color: 'rgba(220, 170, 60, 0.14)' },
      { x: 0.82, y: 0.68, r: 0.6, color: 'rgba(255, 200, 100, 0.09)' },
      { x: 0.6, y: 0.9, r: 0.4, color: 'rgba(200, 120, 40, 0.10)' },
    ],
  },
};

export const FACESETS = ['default', 'cool', 'starry'];

// ---------- unlock table ----------
// cond receives (stats, streak) and returns true when unlocked.
export const UNLOCKS = [
  { id: 'arena:default', type: 'arena', value: 'default', cond: () => true },
  { id: 'faces:default', type: 'faces', value: 'default', cond: () => true },
  { id: 'arena:aurora',  type: 'arena', value: 'aurora',  cond: (s) => s.merges >= 100 },
  { id: 'arena:crimson', type: 'arena', value: 'crimson', cond: (s) => s.bh >= 1 },
  { id: 'arena:golden',  type: 'arena', value: 'golden',  cond: (_s, streak) => streak.longest >= 7 },
  { id: 'faces:cool',    type: 'faces', value: 'cool',    cond: (s) => s.games >= 10 },
  { id: 'faces:starry',  type: 'faces', value: 'starry',  cond: (s) => s.score >= 25000 },
];

export function unlockedIds(stats = getStats(), streak = getStreak()) {
  return new Set(UNLOCKS.filter((u) => u.cond(stats, streak)).map((u) => u.id));
}

// ---------- equipped state ----------
export function getEquipped() {
  const eq = { arena: 'default', faces: 'default', ...Storage.get('equipped', {}) };
  // never keep something equipped that is not unlocked (e.g. cleared stats)
  const un = unlockedIds();
  if (!un.has('arena:' + eq.arena)) eq.arena = 'default';
  if (!un.has('faces:' + eq.faces)) eq.faces = 'default';
  return eq;
}

export function equip(type, value) {
  const eq = getEquipped();
  if (!unlockedIds().has(`${type}:${value}`)) return eq;
  eq[type] = value;
  Storage.set('equipped', eq);
  return eq;
}
