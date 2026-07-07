// Daily Singularity: one deterministic seeded puzzle per UTC day, identical
// worldwide — plus streak accounting with auto-consumed shields.

import { DAILY } from './config.js';
import { hashString } from './rng.js';
import { Storage } from './storage.js';

let _now = () => Date.now();
export function setNowProvider(fn) { _now = fn; }
export function now() { return _now(); }

export function dayNumber(ts = _now()) {
  return Math.floor((ts - DAILY.EPOCH_UTC) / 86400000);
}

export function seedForDay(day) {
  return hashString(`${DAILY.SEED_SALT}:${day}`);
}

export function msUntilNextDaily(ts = _now()) {
  const day = dayNumber(ts);
  const nextMidnight = DAILY.EPOCH_UTC + (day + 1) * 86400000;
  return nextMidnight - ts;
}

// state: { day, status: 'inprogress'|'done', score, bestTier, doubled }
export function getDailyState() {
  const s = Storage.get('daily');
  if (!s || s.day !== dayNumber()) return null;
  return s;
}

export function getStreak() {
  return Storage.get('streak', { count: 0, lastDay: -999, shields: 0, longest: 0 });
}

export function hasPlayedToday() {
  const s = getDailyState();
  return s !== null && s.status === 'done';
}

export function startOfficialRun() {
  Storage.set('daily', { day: dayNumber(), status: 'inprogress', score: 0, bestTier: 0, doubled: false });
}

// Called during an official run so an abandoned run still counts.
export function recordProgress(score, bestTier) {
  const s = getDailyState();
  if (!s || s.status !== 'inprogress') return;
  s.score = score;
  s.bestTier = bestTier;
  Storage.set('daily', s);
}

// Finalize today's official run and update the streak. Returns {state, streak}.
export function finalizeRun(score, bestTier) {
  const day = dayNumber();
  let s = getDailyState();
  if (!s) s = { day, status: 'inprogress', score: 0, bestTier: 0, doubled: false };
  if (s.status === 'done') return { state: s, streak: getStreak() }; // already counted

  s.status = 'done';
  s.score = Math.max(s.score, score);
  s.bestTier = Math.max(s.bestTier, bestTier);
  Storage.set('daily', s);

  const streak = getStreak();
  if (streak.lastDay !== day) {
    const gap = day - streak.lastDay - 1;
    if (streak.lastDay < -100 || streak.count === 0) {
      streak.count = 1;
    } else if (gap === 0) {
      streak.count++;
    } else if (gap > 0 && streak.shields >= gap) {
      streak.shields -= gap;
      streak.count++;
    } else {
      streak.count = 1;
    }
    streak.lastDay = day;
    if (streak.count > streak.longest) streak.longest = streak.count;
    if (streak.count > 0 && streak.count % DAILY.SHIELD_EVERY === 0) {
      streak.shields = Math.min(DAILY.SHIELD_MAX, streak.shields + 1);
    }
    Storage.set('streak', streak);
  }
  return { state: s, streak };
}

// If the page was closed mid-official-run, count the recorded progress now.
export function reconcileAbandonedRun() {
  const s = getDailyState();
  if (s && s.status === 'inprogress') {
    finalizeRun(s.score, s.bestTier);
  }
}

// After a rewarded revive the run continues past the first finalize —
// let a better final result raise today's recorded score.
export function improveScore(score, bestTier) {
  const s = getDailyState();
  if (!s || s.status !== 'done' || s.doubled) return;
  if (score > s.score || bestTier > s.bestTier) {
    s.score = Math.max(s.score, score);
    s.bestTier = Math.max(s.bestTier, bestTier);
    Storage.set('daily', s);
  }
}

export function applyDouble() {
  const s = getDailyState();
  if (!s || s.status !== 'done' || s.doubled) return null;
  s.doubled = true;
  s.score *= 2;
  Storage.set('daily', s);
  return s;
}

// The streak that is "live" for display: today counted, or yesterday's still alive.
export function displayStreak() {
  const streak = getStreak();
  const today = dayNumber();
  const gap = today - streak.lastDay;
  if (gap <= 1) return streak;                       // played today or yesterday
  if (gap - 1 <= streak.shields) return streak;      // shields would still save it
  return { ...streak, count: 0 };
}
