// All tuning constants live here. World units: arena radius = 100.

export const VERSION = '1.3.0';

export const WORLD = {
  R: 100,            // arena radius (launcher orbit)
  SPAWN_R: 96,       // spawn distance from center
  DANGER_R: 78,      // bodies settled beyond this edge distance trigger game over
  CLAMP_R: 112,      // hard position clamp (safety net)
};

export const PHYSICS = {
  DT: 1 / 120,           // fixed substep
  MAX_STEPS: 6,          // max substeps per render frame
  ITERATIONS: 5,         // constraint solver iterations per substep
  GRAVITY: 260,          // radial acceleration toward center (units/s^2)
  DAMPING: 0.32,         // linear velocity damping per second
  FRICTION: 0.12,        // tangential friction per contact resolve
  MAX_SPEED: 380,        // velocity clamp (units/s)
  DROP_SPEED: 60,        // initial inward speed of a dropped piece
  MAX_CORRECTION: 3.0,   // per-pair positional correction cap per iteration
  MERGE_GRACE: 0.09,     // seconds a freshly spawned body cannot merge
};

export const RULES = {
  DROP_COOLDOWN: 0.45,     // min seconds between drops
  DANGER_TIME: 1.7,        // continuous seconds in danger zone before game over
  SETTLE_AGE: 1.4,         // seconds after drop before a body counts for danger
  CHAIN_WINDOW: 2.0,       // seconds between merges to keep the chain alive
  CHAIN_STEP: 0.5,         // multiplier per chain step — cap at chain 5, so a
                           // deliberately staged cascade visibly pays off
  CHAIN_MAX_MULT: 3.0,
  DROP_POOL: 5,            // tiers 0..4 are droppable
  DROP_WEIGHTS: [30, 26, 20, 14, 10],
  BLACKHOLE_FEED_TIME: 2.5,   // seconds a black hole consumes surroundings —
                              // the game's climax deserves to linger
  BLACKHOLE_PULL_RADIUS: 54,  // extra pull radius around a black hole
  BLACKHOLE_EAT_SCORE: 150,
  BLACKHOLE_FINALE_SCORE: 1500,
  REVIVE_CLEAR_TIERS: 5,      // "Solar Flare" removes tiers 0..4 (the whole
                              // droppable pool) — an ad-paid rescue must
                              // clearly relieve the tighter arena
};

// 11 celestial tiers. radius in world units; mass ~ r^2 * density.
// Neutron star is intentionally SMALL and dense (stellar collapse!) —
// merging two red giants relieves board pressure as a reward.
// Sizes tuned against DANGER_R so a run overfills after ~50-60 drops.
//
// Cosmetic-only fields (never touch physics / gameplay RNG):
//   shape    — silhouette archetype the renderer dispatches on
//   family   — material family for coherent shading
//   face     — expression archetype ('grumpy' rocks, 'excited' comet, …)
//   faceScale— face size relative to body (small bodies = cuter/bigger face)
//   variants — number of per-body cosmetic variants baked (bounded cache)
export const TIERS = [
  { id: 'stardust',  r: 5.2,  density: 1.0, color: '#fff3b0', glow: '#ffe27a', score: 0,    emoji: '✨', shape: 'mote',   family: 'dust',   face: 'excited', faceScale: 1.2,  variants: 3 },
  { id: 'meteoroid', r: 6.9,  density: 1.0, color: '#b39679', glow: '#e0b98f', score: 10,   emoji: '☄️', shape: 'rock',   family: 'rock',   face: 'grumpy',  faceScale: 1.18, variants: 4 },
  { id: 'asteroid',  r: 9.0,  density: 1.0, color: '#9299a3', glow: '#b8c2cc', score: 20,   emoji: '🪨', shape: 'rock',   family: 'rock',   face: 'grumpy',  faceScale: 1.1,  variants: 4 },
  { id: 'comet',     r: 11.6, density: 1.0, color: '#8fdff2', glow: '#5fc8e8', score: 35,   emoji: '🌠', shape: 'ice',    family: 'ice',    face: 'excited', faceScale: 1.05, variants: 3 },
  { id: 'moon',      r: 14.9, density: 1.0, color: '#e2ddd0', glow: '#cfc9bc', score: 55,   emoji: '🌙', shape: 'round',  family: 'rock',   face: 'calm',    faceScale: 1.0,  variants: 4 },
  { id: 'planet',    r: 18.9, density: 1.0, color: '#4ba3ec', glow: '#4fa2e2', score: 90,   emoji: '🌍', shape: 'round',  family: 'terran', face: 'calm',    faceScale: 0.95, variants: 3 },
  { id: 'gasgiant',  r: 23.6, density: 1.0, color: '#eaa257', glow: '#e8934f', score: 145,  emoji: '🪐', shape: 'ringed', family: 'gas',    face: 'sleepy',  faceScale: 0.85, variants: 3 },
  { id: 'star',      r: 29.0, density: 1.0, color: '#ffd75e', glow: '#ffc72e', score: 235,  emoji: '⭐', shape: 'star',   family: 'star',   face: 'radiant', faceScale: 0.8,  variants: 2 },
  { id: 'redgiant',  r: 34.7, density: 1.0, color: '#ff6f4e', glow: '#ff5b3a', score: 380,  emoji: '🔴', shape: 'giant',  family: 'star',   face: 'sleepy',  faceScale: 0.7,  variants: 2 },
  { id: 'neutron',   r: 17.7, density: 6.0, color: '#dfe6ff', glow: '#9fb4ff', score: 615,  emoji: '🌟', shape: 'pulsar', family: 'star',   face: 'radiant', faceScale: 0.95, variants: 1 },
  { id: 'blackhole', r: 20.0, density: 9.0, color: '#14101f', glow: '#ff9a3c', score: 1000, emoji: '⚫', shape: 'void',   family: 'void',   face: 'hungry',  faceScale: 0.9,  variants: 1 },
];

export const BLACKHOLE_TIER = TIERS.length - 1;

export const DAILY = {
  // Day #1 = 2026-07-07 UTC (launch day).
  EPOCH_UTC: Date.UTC(2026, 6, 6),
  SEED_SALT: 'singularity-drop-v1',
  SHIELD_EVERY: 7,   // streak days per earned shield
  SHIELD_MAX: 2,
};

export const STORAGE_PREFIX = 'sd1:';
