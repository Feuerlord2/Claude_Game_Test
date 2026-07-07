// Daily Singularity: one deterministic seeded puzzle per UTC day, identical
// worldwide — plus streak accounting with auto-consumed shields.

import { DAILY } from './config.js';
import { hashString } from './rng.js';
import { Storage } from './storage.js';

let _now = () => Date.now();
export function setNowProvider(fn) { _now = fn; }
export function now() { return _now(); }

// Wordle model: the day is the LOCAL calendar date, so the puzzle flips at
// the player's midnight (not at 4-7pm in the Americas) — same puzzle for
// everyone on the same calendar date.
export function dayNumber(ts = _now()) {
  const d = new Date(ts);
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAILY.EPOCH_UTC) / 86400000);
}

export function seedForDay(day) {
  return hashString(`${DAILY.SEED_SALT}:${day}`);
}

export function msUntilNextDaily(ts = _now()) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - ts;
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

export function startOfficialRun(day = dayNumber()) {
  Storage.set('daily', { day, status: 'inprogress', score: 0, bestTier: 0, doubled: false });
}

// Called during an official run so an abandoned run still counts.
export function recordProgress(score, bestTier) {
  const s = getDailyState();
  if (!s || s.status !== 'inprogress') return;
  s.score = score;
  s.bestTier = bestTier;
  Storage.set('daily', s);
}

function updateStreakForDay(day) {
  const streak = getStreak();
  if (streak.lastDay >= day) return streak; // already counted (or clock went backwards)
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
  // First shield already at day 3: streak churn is front-loaded, and a young
  // streak with zero protection is exactly where the habit dies (Duolingo
  // hands out the first freeze almost immediately for the same reason).
  if (streak.count === 3 || (streak.count > 0 && streak.count % DAILY.SHIELD_EVERY === 0)) {
    streak.shields = Math.min(DAILY.SHIELD_MAX, streak.shields + 1);
  }
  Storage.set('streak', streak);
  return streak;
}

// Finalize the official run and update the streak. Returns {state, streak}.
// A run that crosses UTC midnight is credited to the day it STARTED on
// (matching reconcileAbandonedRun), so the streak holds and the new day's
// attempt stays available.
export function finalizeRun(score, bestTier) {
  let s = Storage.get('daily');
  if (s && s.status === 'done' && s.day === dayNumber()) {
    return { state: s, streak: getStreak() }; // already counted today
  }
  if (!s || s.status !== 'inprogress') {
    s = { day: dayNumber(), status: 'inprogress', score: 0, bestTier: 0, doubled: false };
  }
  s.status = 'done';
  s.score = Math.max(s.score, score);
  s.bestTier = Math.max(s.bestTier, bestTier);
  Storage.set('daily', s);
  return { state: s, streak: updateStreakForDay(s.day) };
}

// If the page was closed mid-official-run, count the recorded progress now —
// even when that run happened on an earlier day (played at 23:58, reopened
// after midnight): the attempt still counts for ITS day, keeping the streak.
export function reconcileAbandonedRun() {
  const s = Storage.get('daily');
  if (s && s.status === 'inprogress') {
    s.status = 'done';
    Storage.set('daily', s);
    updateStreakForDay(s.day);
  }
}

// After a rewarded revive the run continues past the first finalize —
// let a better final result raise today's recorded score. Works after a
// 2x double too, by comparing against the raw (undoubled) score.
export function improveScore(score, bestTier) {
  const s = getDailyState();
  if (!s || s.status !== 'done') return;
  const raw = s.doubled ? (s.rawScore ?? Math.floor(s.score / 2)) : s.score;
  if (score > raw || bestTier > s.bestTier) {
    const newRaw = Math.max(raw, score);
    if (s.doubled) {
      s.rawScore = newRaw;
      s.score = newRaw * 2;
    } else {
      s.score = newRaw;
    }
    s.bestTier = Math.max(s.bestTier, bestTier);
    Storage.set('daily', s);
  }
}

export function applyDouble() {
  const s = getDailyState();
  if (!s || s.status !== 'done' || s.doubled) return null;
  s.doubled = true;
  s.rawScore = s.score;
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
