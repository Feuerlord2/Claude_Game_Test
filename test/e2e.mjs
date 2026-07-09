#!/usr/bin/env node
// End-to-end test suite for Singularity Drop.
// Runs headless Chromium (mobile viewport) against a local static server.
//
//   node test/e2e.mjs            # starts its own server on :8123
//   SD_URL=http://... node test/e2e.mjs   # test an already-running server

import { createRequire } from 'module';
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium, devices } = pw;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const BASE = process.env.SD_URL || `http://127.0.0.1:${PORT}`;
const URL = `${BASE}/?test=1`;

// A fixed fake "now" so daily tests are reproducible: 2026-07-10 12:00 UTC (day #4).
const FAKE_NOW = Date.UTC(2026, 6, 10, 12, 0, 0);
const FAKE_DAY = 4;

let server = null;
if (!process.env.SD_URL) {
  server = spawn('npx', ['http-server', ROOT, '-p', String(PORT), '-s'], { stdio: 'ignore' });
  // Poll instead of a fixed sleep — first-ever npx run may download http-server.
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/index.html`);
      if (res.ok) break;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) {
      console.error('server did not come up within 30s');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

const results = [];
let browser;

function ok(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${name}${detail && !cond ? ' — ' + detail : ''}`);
}

async function newPage(ctx) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__sd !== undefined);
  return page;
}

async function mobileContext(opts = {}) {
  // Pinned timezone: the daily day-number is local-midnight based, so the
  // suite must not depend on the runner's TZ.
  return browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', timezoneId: 'UTC', ...opts });
}

try {
  browser = await chromium.launch();

  // ---------------- 1. Boot & assets ----------------
  {
    console.log('boot & assets');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    ok('loads without console errors', page.errors.length === 0, page.errors.join('; '));
    ok('menu visible', await page.isVisible('#menu'));
    ok('canvas present', await page.isVisible('#game'));

    for (const asset of ['manifest.webmanifest', 'sw.js', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png']) {
      const status = await page.evaluate(async (a) => (await fetch(a)).status, asset);
      ok(`asset ${asset} -> 200`, status === 200, `got ${status}`);
    }
    await ctx.close();
  }

  // ---------------- 2. Endless gameplay ----------------
  {
    console.log('endless gameplay');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    const r = await page.evaluate(() => {
      const sd = window.__sd;
      sd.startGame('endless');
      // Random-angle play may legitimately lose before 40 drops — that's the
      // tuned difficulty, not a bug. Stop dropping once the run ends.
      for (let i = 0; i < 40 && !sd.state().over; i++) {
        sd.drop(Math.random() * Math.PI * 2);
        sd.stepFrames(60); // 0.5 s > DROP_COOLDOWN so every drop lands
      }
      if (!sd.state().over) sd.stepFrames(400);
      return sd.state();
    });
    ok('drops registered', r.dropsMade >= 15, `dropsMade=${r.dropsMade}`);
    ok('merges happened', r.merges > 5, `merges=${r.merges}`);
    ok('score positive', r.score > 0);
    ok('bodies < drops (merging works)', r.bodies.length < r.dropsMade, `bodies=${r.bodies.length}`);
    ok('no NaN positions', !r.bodies.some((b) => !Number.isFinite(b.x) || !Number.isFinite(b.y)));
    ok('pile inside arena', r.bodies.every((b) => Math.hypot(b.x, b.y) <= 113));
    // Read HUD and score atomically — the live rAF loop keeps simulating
    // between evaluate calls, so a cross-call comparison races with merges.
    const hudCheck = await page.evaluate(() => {
      const sd = window.__sd;
      sd.stepFrames(0); // sync updateHud with the current score
      return { hud: document.getElementById('score').textContent.replace(/[.,\s]/g, ''), score: sd.state().score };
    });
    ok('HUD score rendered', hudCheck.hud === String(hudCheck.score), `hud=${hudCheck.hud} score=${hudCheck.score}`);
    ok('no console errors during play', page.errors.length === 0, page.errors.join('; '));
    await ctx.close();
  }

  // ---------------- 3. Physics stability ----------------
  {
    console.log('physics stability');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    const r = await page.evaluate(() => {
      const sd = window.__sd;
      sd.startGame('endless');
      // Drop 30 bodies quickly, then let everything settle for 8 sim-seconds.
      for (let i = 0; i < 30; i++) {
        sd.drop((i / 30) * Math.PI * 2);
        sd.stepFrames(50);
      }
      sd.stepFrames(960);
      const s1 = sd.state();
      sd.stepFrames(240); // two more seconds
      const s2 = sd.state();
      return { k1: s1.kinetic, k2: s2.kinetic, bodies: s2.bodies.length };
    });
    ok('pile settles (kinetic energy small)', r.k2 < 500, `k=${r.k2.toFixed(1)}`);
    ok('kinetic energy not growing', r.k2 <= r.k1 * 3 + 500, `k1=${r.k1.toFixed(1)} k2=${r.k2.toFixed(1)}`);
    await ctx.close();
  }

  // ---------------- 4. Game over, revive, restart ----------------
  {
    console.log('game over / revive / restart');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    const over = await page.evaluate(() => {
      const sd = window.__sd;
      sd.startGame('endless');
      for (let i = 0; i < 250 && !sd.state().over; i++) {
        sd.drop((i % 12) * (Math.PI / 6));
        sd.stepFrames(55); // >= DROP_COOLDOWN 0.45s at DT 1/120
        if (!document.getElementById('danger-banner').classList.contains('hidden')) {
          window.__bannerSeen = true;
        }
      }
      return sd.state();
    });
    ok('overfilling triggers game over', over.over === true, `drops=${over.dropsMade}`);
    ok('game over overlay shown', await page.isVisible('#gameover'));
    // The warning banner must have been up during the danger phase.
    const bannerSeen = await page.evaluate(() => window.__bannerSeen === true);
    ok('collapse warning banner appeared before game over', bannerSeen);
    ok('revive button offered', await page.isVisible('#btn-revive'));

    const beforeRevive = await page.evaluate(() => window.__sd.state().bodies.length);
    await page.click('#btn-revive');
    await page.waitForFunction(() => window.__sd.state().screen === 'playing');
    const afterRevive = await page.evaluate(() => window.__sd.state());
    ok('revive resumes play', afterRevive.over === false && afterRevive.screen === 'playing');
    ok('revive cleared small tiers', afterRevive.bodies.length < beforeRevive, `${beforeRevive} -> ${afterRevive.bodies.length}`);
    ok('score kept after revive', afterRevive.score === over.score);

    // Second game over: revive must not be offered again.
    await page.evaluate(() => {
      const sd = window.__sd;
      for (let i = 0; i < 250 && !sd.state().over; i++) {
        sd.drop((i % 12) * (Math.PI / 6));
        sd.stepFrames(55); // >= DROP_COOLDOWN 0.45s at DT 1/120
      }
    });
    ok('second game over reached', await page.evaluate(() => window.__sd.state().over));
    ok('revive hidden after use', await page.isHidden('#btn-revive'));

    await page.click('#btn-restart');
    const fresh = await page.evaluate(() => window.__sd.state());
    ok('restart resets cleanly', fresh.screen === 'playing' && fresh.score === 0 && fresh.bodies.length === 0 && !fresh.over);
    ok('no console errors', page.errors.length === 0, page.errors.join('; '));
    await ctx.close();
  }

  // ---------------- 5. Black hole finale ----------------
  {
    console.log('black hole');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    const r = await page.evaluate(() => {
      const sd = window.__sd;
      sd.startGame('endless');
      // Sprinkle some debris near the center, then collide two neutron stars.
      sd.spawn(0, 20, 0);
      sd.spawn(1, -20, 5);
      sd.spawn(2, 0, 22);
      sd.stepFrames(120);
      const before = sd.state();
      sd.spawn(9, -14, -30);
      sd.spawn(9, 14, -30);
      sd.stepFrames(120); // approach + merge
      const merged = sd.state();
      const bhExists = merged.bodies.some((b) => b.tier === 10);
      sd.stepFrames(600); // feed + evaporate (1.7 s + margin)
      const after = sd.state();
      return {
        beforeBodies: before.bodies.length,
        bhExisted: bhExists,
        afterBodies: after.bodies.length,
        bhGone: !after.bodies.some((b) => b.tier === 10),
        noStranded: after.bodies.every((b) => b.eaten === 0),
        scoreBefore: before.score,
        scoreAfter: after.score,
        bestTier: after.bestTier,
      };
    });
    ok('two neutron stars merged into a black hole', r.bhExisted);
    ok('black hole evaporated after feeding', r.bhGone);
    ok('no stranded half-eaten bodies after finale', r.noStranded);
    ok('black hole consumed nearby debris', r.afterBodies < r.beforeBodies + 2, `before=${r.beforeBodies} after=${r.afterBodies}`);
    ok('finale awarded big score', r.scoreAfter >= r.scoreBefore + 1500, `${r.scoreBefore} -> ${r.scoreAfter}`);
    ok('bestTier reached black hole', r.bestTier === 10);
    ok('no console errors', page.errors.length === 0, page.errors.join('; '));
    await ctx.close();
  }

  // ---------------- 6. Daily determinism ----------------
  {
    console.log('daily determinism');
    const seqFor = async (fakeNow) => {
      const ctx = await mobileContext();
      const page = await newPage(ctx);
      const seq = await page.evaluate((ts) => {
        const sd = window.__sd;
        sd.setNow(ts);
        sd.startGame('daily');
        const seq = [sd.game.currentTier, sd.game.nextTier];
        for (let i = 0; i < 10; i++) {
          sd.drop(Math.PI / 2);
          sd.stepFrames(50);
          seq.push(sd.game.nextTier);
        }
        return seq;
      }, fakeNow);
      await ctx.close();
      return seq;
    };
    const a = await seqFor(FAKE_NOW);
    const b = await seqFor(FAKE_NOW);
    const c = await seqFor(FAKE_NOW + 86400000);
    ok('same day -> identical sequence', JSON.stringify(a) === JSON.stringify(b), `${a} vs ${b}`);
    ok('next day -> different sequence', JSON.stringify(a) !== JSON.stringify(c), `${a} vs ${c}`);
  }

  // ---------------- 7. Daily official run, share, double ----------------
  {
    console.log('daily flow');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    const flow = await page.evaluate((ts) => {
      const sd = window.__sd;
      sd.setNow(ts);
      sd.startGame('daily');
      const official = sd.state().officialDaily;
      for (let i = 0; i < 250 && !sd.state().over; i++) {
        sd.drop((i % 10) * (Math.PI / 5));
        sd.stepFrames(55); // >= DROP_COOLDOWN 0.45s at DT 1/120
      }
      return { official, over: sd.state().over, score: sd.state().score, day: sd.daily.dayNumber() };
    }, FAKE_NOW);
    ok('first daily run is official', flow.official === true);
    ok('daily day number correct', flow.day === FAKE_DAY, `day=${flow.day}`);
    ok('daily section shown on game over', await page.isVisible('#go-daily'));
    ok('share button visible', await page.isVisible('#btn-share'));

    // Ad ladder: while the revive is still on the table, the double is held back.
    ok('revive offered first (ad ladder)', await page.isVisible('#btn-revive'));
    ok('double held back while revive available', await page.isHidden('#btn-double'));

    await page.click('#btn-share');
    await page.waitForTimeout(300);
    const shareText = await page.evaluate(() => window.__sd.lastShareText);
    ok('share text built', typeof shareText === 'string' && shareText.length > 0);
    ok('share text has day number', shareText.includes(`Singularity Drop #${FAKE_DAY}`), shareText);
    ok('share text has url', shareText.includes('http'), shareText);
    ok('share text has emoji progress grid', shareText.includes('⬛'), shareText);
    ok('share text spoiler-free (no seed digits beyond day/score)', !shareText.includes('seed'));

    // Ladder step 2: revive (ad 1), die again, then the double (ad 2) unlocks.
    await page.click('#btn-revive');
    await page.waitForFunction(() => window.__sd.state().screen === 'playing');
    await page.evaluate(() => {
      const sd = window.__sd;
      for (let i = 0; i < 250 && !sd.state().over; i++) {
        sd.drop((i % 10) * (Math.PI / 5));
        sd.stepFrames(55);
      }
    });
    ok('second game over reached (daily)', await page.evaluate(() => window.__sd.state().over));
    ok('double offered once revive is spent', await page.isVisible('#btn-double'));
    const recorded = await page.evaluate(() => window.__sd.daily.getDailyState().score);
    await page.click('#btn-double');
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => window.__sd.daily.getDailyState());
    ok('double doubles the recorded score', state.doubled === true && state.score === recorded * 2 && state.rawScore === recorded, JSON.stringify(state));
    ok('double button hidden after use', await page.isHidden('#btn-double'));

    // Sharing after the double must still share the RAW score.
    await page.click('#btn-share');
    await page.waitForTimeout(300);
    const shareAfter = await page.evaluate(() => window.__sd.lastShareText);
    const rawFmt = recorded.toLocaleString('de-DE');
    const dblFmt = (recorded * 2).toLocaleString('de-DE');
    ok('share uses raw undoubled score', shareAfter.includes(rawFmt) && !shareAfter.includes(dblFmt), shareAfter);

    // Second run today is practice
    await page.click('#btn-restart');
    const practice = await page.evaluate(() => window.__sd.state());
    ok('second daily run is practice', practice.officialDaily === false);
    ok('no console errors', page.errors.length === 0, page.errors.join('; '));
    await ctx.close();
  }

  // ---------------- 8. Streak & shields (fast, via module API) ----------------
  {
    console.log('streak & shields');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    const r = await page.evaluate((ts) => {
      const sd = window.__sd;
      const day = 86400000;
      const out = {};
      // Play 7 consecutive days.
      for (let d = 0; d < 7; d++) {
        sd.setNow(ts + d * day);
        sd.daily.startOfficialRun();
        sd.daily.finalizeRun(1000 + d, 5);
      }
      out.after7 = sd.daily.getStreak();
      // Skip a day, play the day after: shield should auto-consume.
      sd.setNow(ts + 8 * day);
      sd.daily.startOfficialRun();
      sd.daily.finalizeRun(2000, 6);
      out.afterSkip = sd.daily.getStreak();
      // Skip three days with no shields left: streak resets.
      sd.setNow(ts + 12 * day);
      sd.daily.startOfficialRun();
      sd.daily.finalizeRun(500, 4);
      out.afterBigGap = sd.daily.getStreak();
      return out;
    }, FAKE_NOW);
    ok('7-day streak counted', r.after7.count === 7, JSON.stringify(r.after7));
    ok('shields earned at day 3 and day 7', r.after7.shields === 2, JSON.stringify(r.after7));
    ok('shield saves a missed day', r.afterSkip.count === 8 && r.afterSkip.shields === 1, JSON.stringify(r.afterSkip));
    ok('big gap without shields resets streak', r.afterBigGap.count === 1, JSON.stringify(r.afterBigGap));
    ok('longest streak preserved', r.afterBigGap.longest === 8, JSON.stringify(r.afterBigGap));
    await ctx.close();
  }

  // ---------------- 8b. Midnight-crossing edge cases ----------------
  {
    console.log('midnight edge cases');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    const r = await page.evaluate((ts) => {
      const sd = window.__sd;
      const day = 86400000;
      const out = {};

      // A run that starts on day N and finalizes after midnight is credited
      // to day N, and day N+1's attempt stays available.
      sd.setNow(ts);
      sd.daily.startOfficialRun();
      sd.setNow(ts + day);
      const fin = sd.daily.finalizeRun(1234, 6);
      out.creditedDay = fin.state.day;
      out.streakAfterCross = sd.daily.getStreak();
      out.nextDayFree = sd.daily.getDailyState() === null; // new day not consumed

      // Double, then a better post-revive result must still improve the score.
      sd.daily.startOfficialRun();
      sd.daily.finalizeRun(1000, 5);
      sd.daily.applyDouble();
      sd.daily.improveScore(3000, 7);
      out.afterImprove = sd.daily.getDailyState();

      // Stale inprogress from yesterday + startGame today: yesterday counts,
      // today is still official.
      sd.setNow(ts + 3 * day);
      localStorage.setItem('sd1:daily', JSON.stringify({ day: sd.daily.dayNumber(), status: 'inprogress', score: 50, bestTier: 2, doubled: false }));
      sd.setNow(ts + 4 * day);
      sd.startGame('daily');
      out.staleOfficial = sd.state().officialDaily;
      out.staleStreak = sd.daily.getStreak();
      return out;
    }, FAKE_NOW);
    ok('midnight-crossing run credited to its start day', r.creditedDay === FAKE_DAY, `day=${r.creditedDay}`);
    ok('streak counted for the start day', r.streakAfterCross.lastDay === FAKE_DAY, JSON.stringify(r.streakAfterCross));
    ok('next day attempt not consumed', r.nextDayFree === true);
    ok('improveScore works after double (raw comparison)', r.afterImprove.score === 6000 && r.afterImprove.rawScore === 3000 && r.afterImprove.bestTier === 7, JSON.stringify(r.afterImprove));
    ok('stale inprogress run: today still official', r.staleOfficial === true);
    ok('stale inprogress run: yesterday counted for streak', r.staleStreak.lastDay >= FAKE_DAY + 3, JSON.stringify(r.staleStreak));
    ok('no console errors', page.errors.length === 0, page.errors.join('; '));
    await ctx.close();
  }

  // ---------------- 9. Abandoned official run still counts ----------------
  {
    console.log('abandoned daily run');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    await page.evaluate((ts) => {
      const sd = window.__sd;
      sd.setNow(ts);
      sd.startGame('daily');
      // Guarantee at least one merge so progress is recorded.
      sd.spawn(0, 10, 0);
      sd.spawn(0, -10, 0);
      sd.stepFrames(240);
    }, FAKE_NOW);
    const midScore = await page.evaluate(() => window.__sd.state().score);
    ok('mid-run score exists', midScore > 0, `score=${midScore}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__sd !== undefined);
    const rec = await page.evaluate((ts) => {
      window.__sd.setNow(ts);
      return { state: window.__sd.daily.getDailyState(), streak: window.__sd.daily.getStreak() };
    }, FAKE_NOW);
    ok('abandoned run finalized on reload', rec.state && rec.state.status === 'done', JSON.stringify(rec.state));
    ok('abandoned run kept its score', rec.state && rec.state.score === midScore, `saved=${rec.state && rec.state.score} expected=${midScore}`);
    ok('streak counted for abandoned run', rec.streak.count >= 1, JSON.stringify(rec.streak));
    await ctx.close();
  }

  // ---------------- 10. Persistence ----------------
  {
    console.log('persistence');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    await page.evaluate(() => {
      const sd = window.__sd;
      sd.startGame('endless');
      for (let i = 0; i < 200 && !sd.state().over; i++) {
        sd.drop((i % 12) * (Math.PI / 6));
        sd.stepFrames(55); // >= DROP_COOLDOWN 0.45s at DT 1/120
      }
    });
    const finalScore = await page.evaluate(() => window.__sd.state().score);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__sd !== undefined);
    const best = await page.evaluate(() => JSON.parse(localStorage.getItem('sd1:best:endless')));
    ok('best score persisted across reload', best === finalScore, `best=${best} score=${finalScore}`);

    // Settings persistence
    await page.click('#btn-settings');
    await page.click('#tgl-music');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__sd !== undefined);
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('sd1:settings')));
    ok('settings persisted (music off)', settings.music === false, JSON.stringify(settings));
    await ctx.close();
  }

  // ---------------- 11. Real touch input ----------------
  {
    console.log('touch input');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    await page.evaluate(() => window.__sd.startGame('endless'));
    const vp = page.viewportSize();
    // Tap on the right side of the arena -> aim angle ~0, piece drops.
    await page.touchscreen.tap(vp.width - 30, Math.round(vp.height * 0.54));
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => window.__sd.state());
    ok('touch tap drops a piece', s.dropsMade === 1, `dropsMade=${s.dropsMade}`);
    const angleOk = await page.evaluate(() => Math.abs(window.__sd.game.aimAngle) < 0.6);
    ok('tap position sets aim angle', angleOk);
    ok('no console errors', page.errors.length === 0, page.errors.join('; '));
    await ctx.close();
  }

  // ---------------- 11b. Onboarding, codex & accessibility ----------------
  {
    console.log('onboarding & accessibility');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    // Fresh profile: the first tap on play shows the 3-card tutorial.
    await page.click('#btn-endless');
    ok('tutorial shows on first play', await page.isVisible('#tutorial'));
    await page.click('#btn-tut-next');
    await page.click('#btn-tut-next');
    await page.click('#btn-tut-next');
    ok('tutorial ends into the game', await page.evaluate(() => window.__sd.state().screen === 'playing'));
    ok('tutorial flag persisted', await page.evaluate(() => JSON.parse(localStorage.getItem('sd1:tut')) === true));

    await page.evaluate(() => window.__sd.showMenu());
    await page.click('#btn-endless');
    ok('tutorial skipped on second play', await page.isHidden('#tutorial'));
    ok('second play starts instantly', await page.evaluate(() => window.__sd.state().screen === 'playing'));

    await page.evaluate(() => window.__sd.showMenu());
    await page.click('#btn-howto');
    const rows = await page.evaluate(() => document.querySelectorAll('#codex .codex-row').length);
    ok('codex lists all 11 bodies', rows === 11, `rows=${rows}`);
    await page.click('#btn-howto-close');

    await page.click('#btn-settings');
    await page.click('#tgl-badges');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('sd1:settings')));
    ok('tier-badge setting persisted', s.badges === true, JSON.stringify(s));
    ok('no console errors', page.errors.length === 0, page.errors.join('; '));
    await ctx.close();
  }

  // ---------------- 12. Performance ----------------
  {
    console.log('performance');
    const ctx = await mobileContext();
    const page = await newPage(ctx);
    const r = await page.evaluate(() => {
      const sd = window.__sd;
      sd.startGame('endless');
      // Fixed seed: the piece sequence decides whether the pile survives,
      // and a random one makes this check flaky.
      sd.game.reset('endless', 424242);
      // Build the pile the way real play does — dropped from the rim at
      // spread angles. Synthetic overlapping spawns explode in the solver
      // and collapse the scene, making the measurement vacuous.
      for (let i = 0; i < 32 && !sd.state().over; i++) {
        sd.drop((i * 2.399963) % (Math.PI * 2));
        sd.stepFrames(56);
      }
      sd.stepFrames(240); // settle
      const bodies = sd.state().bodies.length;
      const t0 = performance.now();
      sd.stepFrames(1200); // 10 simulated seconds
      const elapsed = performance.now() - t0;
      return { bodies, elapsed, perStep: elapsed / 1200, over: sd.state().over };
    });
    ok('perf scene survives the whole measurement', r.over === false);
    // 1200 physics steps = 10 s of sim. Budget: avg step must fit a 120 Hz substep
    // twice over even on this shared CI-class CPU.
    ok(`physics step fast enough (${r.perStep.toFixed(2)} ms/step, ${r.bodies} bodies)`, r.perStep < 4, `${r.perStep.toFixed(2)} ms`);
    await ctx.close();
  }

} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
