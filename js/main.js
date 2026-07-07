// Bootstrap + orchestration: input, render loop, UI flow, daily mode, ads.

import { VERSION, TIERS, BLACKHOLE_TIER, PHYSICS, RULES } from './config.js';
import { Game } from './game.js';
import { Body } from './physics.js';
import { Renderer } from './render.js';
import { Particles } from './particles.js';
import { AudioEngine } from './audio.js';
import { Haptics } from './haptics.js';
import { Storage } from './storage.js';
import { Ads } from './ads.js';
import { t } from './i18n.js';
import { buildShareText, share } from './share.js';
import * as Daily from './daily.js';

const TEST = new URLSearchParams(location.search).has('test');

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

// ---------- Core objects ----------
const canvas = $('game');
const game = new Game();
const renderer = new Renderer(canvas);
const particles = new Particles();
const audio = new AudioEngine();
if (TEST) {
  audio.disabled = true;
  Ads.adapter.fast = true;
}

// ---------- Settings ----------
const settings = Storage.get('settings', { sound: true, music: true, haptics: true });
audio.setSound(settings.sound);
audio.setMusic(settings.music);
Haptics.enabled = settings.haptics;

// Portals require game audio muted during ad breaks.
Ads.onAdStart = () => audio.suspend();
Ads.onAdEnd = () => audio.resume();

function saveSettings() {
  Storage.set('settings', settings);
}

// ---------- Run state ----------
let screen = 'menu';           // menu | playing | paused | gameover
let runMode = 'endless';       // endless | daily
let officialDaily = false;
let finalizedThisRun = false;
let dailyRunDay = 0;           // the UTC day this daily run belongs to
let lastTime = performance.now();

// ---------- Static UI text ----------
function applyStaticText() {
  $('menu-tagline').textContent = t('tagline');
  $('btn-endless').textContent = t('play_endless');
  $('btn-howto').textContent = t('howto');
  $('btn-settings').textContent = t('settings');
  $('howto-title').textContent = t('howto_title');
  $('howto-body').innerHTML = t('howto_body');
  $('btn-howto-close').textContent = t('got_it');
  $('settings-title').textContent = t('settings');
  $('lbl-sound').textContent = t('sound');
  $('lbl-music').textContent = t('music');
  $('lbl-haptics').textContent = t('haptics');
  $('btn-settings-close').textContent = t('close');
  $('pause-title').textContent = t('paused');
  $('btn-resume').textContent = t('resume');
  $('btn-quit').textContent = t('quit');
  $('go-title').textContent = t('collapse');
  $('go-newbest').textContent = t('new_best');
  $('btn-revive').textContent = t('revive');
  $('btn-restart').textContent = t('restart');
  $('btn-gomenu').textContent = t('menu');
  $('btn-share').textContent = t('share');
  $('btn-double').textContent = t('double');
  $('adstub-text').textContent = t('ad_stub');
  $('version').textContent = VERSION;
}

function refreshToggles() {
  const set = (id, on) => {
    const el = $(id);
    el.textContent = on ? t('on') : t('off');
    el.classList.toggle('on', on);
  };
  set('tgl-sound', settings.sound);
  set('tgl-music', settings.music);
  set('tgl-haptics', settings.haptics);
}

function toast(msg, ms = 1800) {
  const el = $('toast');
  el.textContent = msg;
  show('toast');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => hide('toast'), ms);
}

// ---------- Menu / daily button ----------
function updateMenu() {
  const day = Daily.dayNumber();
  $('daily-label').textContent = t('daily_label', day);
  const state = Daily.getDailyState();
  if (state && state.status === 'done') {
    $('daily-sub').textContent = t('daily_done', state.score.toLocaleString());
  } else {
    $('daily-sub').textContent = t('daily_ready');
  }
  const streak = Daily.displayStreak();
  $('menu-streak').textContent = streak.count > 0
    ? `${t('streak', streak.count)}${streak.shields > 0 ? '  ' + t('shields', streak.shields) : ''}`
    : '';
}

function showMenu() {
  screen = 'menu';
  game.paused = true;
  Ads.gameplayStop();
  hide('hud'); hide('gameover'); hide('pause');
  updateMenu();
  show('menu');
}

// ---------- Game flow ----------
function startGame(mode) {
  runMode = mode;
  finalizedThisRun = false;
  if (mode === 'daily') {
    // Finalize any abandoned attempt for ITS day first (e.g. quit-to-menu
    // yesterday in a never-reloaded PWA session) so it is not destroyed.
    Daily.reconcileAbandonedRun();
    // Compute the day ONCE so state, seed and badge cannot straddle midnight.
    const day = Daily.dayNumber();
    dailyRunDay = day;
    const state = Daily.getDailyState();
    officialDaily = !state; // first run today is the scored one
    if (officialDaily) Daily.startOfficialRun(day);
    game.reset('daily', Daily.seedForDay(day));
  } else {
    officialDaily = false;
    game.reset('endless', Math.floor(Math.random() * 0xffffffff));
  }
  particles.clear();
  hide('menu'); hide('gameover'); hide('pause');
  show('hud');
  updateHudMode();
  updateHud(true);
  screen = 'playing';
  game.paused = false;
  Ads.gameplayStart();
}

function updateHudMode() {
  const badge = $('mode-badge');
  if (runMode === 'daily') {
    badge.textContent = officialDaily ? `${t('mode_daily')} #${dailyRunDay}` : t('mode_practice');
    show('mode-badge');
  } else {
    hide('mode-badge');
  }
}

// The next-piece preview renders the REAL sprite (with face) instead of a
// system emoji, so the HUD matches the in-game art on every platform.
function drawNextPreview(tier) {
  const nextCanvas = $('next');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = 36;
  if (nextCanvas.width !== size * dpr) {
    nextCanvas.width = size * dpr;
    nextCanvas.height = size * dpr;
  }
  const nctx = nextCanvas.getContext('2d');
  nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  nctx.clearRect(0, 0, size, size);
  const r = 12;
  const spr = renderer.sprite(tier, r);
  const full = spr.offset * 2;
  const scale = 32 / full;
  const dw = spr.canvas.width * scale;
  nctx.drawImage(spr.canvas, (size - dw) / 2, (size - dw) / 2, dw, dw);
  renderer.drawFace(nctx, size / 2, size / 2, r * scale, 'normal', tier);
}

let lastScoreShown = -1;
let lastNextShown = -1;
let lastChainShown = '';
function updateHud(force = false) {
  if (game.score !== lastScoreShown || force) {
    $('score').textContent = game.score.toLocaleString();
    lastScoreShown = game.score;
  }
  if (game.nextTier !== lastNextShown || force) {
    drawNextPreview(game.nextTier);
    lastNextShown = game.nextTier;
  }
  // Only touch the DOM when the label actually changes — this runs per frame.
  const chainEl = $('chain');
  if (game.chain >= 2 && game.chainTimer > 0) {
    const label = `×${game.chainMult().toFixed(2).replace(/\.?0+$/, '')} CHAIN`;
    if (label !== lastChainShown) {
      chainEl.textContent = label;
      chainEl.classList.remove('hidden');
      // Restart the pop animation on every multiplier change.
      chainEl.style.animation = 'none';
      void chainEl.offsetWidth;
      chainEl.style.animation = '';
      lastChainShown = label;
    }
  } else if (lastChainShown !== '') {
    chainEl.classList.add('hidden');
    lastChainShown = '';
  }
  if (force) {
    const best = Storage.get('best:endless', 0);
    $('best').textContent = runMode === 'endless' && best > 0 ? t('best_label', best.toLocaleString()) : '';
  }
}

function handleGameOver(ev) {
  screen = 'gameover';
  hide('danger-banner');
  lastDangerText = '';
  Ads.gameplayStop();
  audio.gameover();
  Haptics.gameover();

  const tierName = t('tier_names')[game.bestTier];
  $('go-score').textContent = game.score.toLocaleString();
  $('go-stats').textContent = t('stats', `${TIERS[game.bestTier].emoji} ${tierName}`, game.merges);

  // Endless best
  let newBest = false;
  if (runMode === 'endless') {
    const best = Storage.get('best:endless', 0);
    if (game.score > best) {
      Storage.set('best:endless', game.score);
      newBest = true;
    }
  }
  $('go-newbest').classList.toggle('hidden', !newBest);

  // Daily accounting
  if (runMode === 'daily' && officialDaily) {
    if (!finalizedThisRun) {
      Daily.finalizeRun(game.score, game.bestTier);
      finalizedThisRun = true;
    } else {
      Daily.improveScore(game.score, game.bestTier);
    }
    const state = Daily.getDailyState();
    if (state) {
      const streak = Daily.getStreak();
      $('go-daily-summary').textContent = t('daily_result', state.score.toLocaleString());
      $('go-streak').textContent = `${t('streak', streak.count)}${streak.shields > 0 ? '  ' + t('shields', streak.shields) : ''}`;
      $('btn-double').classList.toggle('hidden', state.doubled || !Ads.rewardedAvailable());
    } else {
      // A revived run crossed UTC midnight: yesterday's result is locked in.
      $('go-daily-summary').textContent = t('practice');
      $('go-streak').textContent = '';
      hide('btn-double');
    }
    updateCountdown();
    show('go-daily');
  } else if (runMode === 'daily') {
    $('go-daily-summary').textContent = t('practice');
    $('go-streak').textContent = '';
    hide('btn-double');
    updateCountdown();
    show('go-daily');
  } else {
    hide('go-daily');
  }

  $('btn-revive').classList.toggle('hidden', game.reviveUsed || !Ads.rewardedAvailable());
  show('gameover');
}

let lastDangerText = '';
function updateDangerBanner() {
  const banner = $('danger-banner');
  if (game.dangerLevel > 0.08 && !game.over) {
    const remaining = Math.max(0, RULES.DANGER_TIME * (1 - game.dangerLevel));
    const text = `⚠️ ${t('collapse_in', remaining.toFixed(1))}`;
    if (text !== lastDangerText) {
      banner.textContent = text;
      lastDangerText = text;
    }
    banner.classList.remove('hidden');
  } else if (lastDangerText !== '') {
    banner.classList.add('hidden');
    lastDangerText = '';
  }
}

function updateCountdown() {
  const ms = Daily.msUntilNextDaily();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  $('go-countdown').textContent = t('next_daily', h, m);
}
setInterval(() => {
  if (screen === 'gameover' && runMode === 'daily') {
    updateCountdown();
    // Past UTC midnight the recorded day expires — retire the stale button.
    if (!Daily.getDailyState()) hide('btn-double');
  }
}, 30000);

// ---------- Game events -> fx ----------
function processEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'drop':
        audio.drop();
        Haptics.drop();
        break;
      case 'merge': {
        particles.spawnBurst(ev.x, ev.y, ev.tier, 8 + ev.tier * 2);
        if (ev.tier >= 4) particles.spawnRing(ev.x, ev.y, ev.tier, 1 + ev.tier * 0.15);
        if (ev.points >= 80 || ev.chain >= 3) {
          particles.spawnText(ev.x, ev.y - TIERS[ev.tier].r - 3, `+${ev.points}`, ev.chain >= 3 ? '#ffb45e' : '#e8ecff');
        }
        renderer.addShake(ev.tier >= 7 ? 3 + ev.tier * 0.8 : ev.tier * 0.35);
        audio.merge(ev.tier, ev.chain);
        if (ev.tier >= 7) Haptics.bigMerge(); else Haptics.merge(ev.tier);
        if (ev.tier === BLACKHOLE_TIER) {
          renderer.addShake(16);
          audio.bhBirth();
        }
        if (officialDaily) Daily.recordProgress(game.score, game.bestTier);
        break;
      }
      case 'bh-eat':
        particles.spawnBurst(ev.x, ev.y, ev.tier, 6);
        particles.spawnText(ev.x, ev.y, `+${ev.points}`, '#ff9a3c');
        audio.bhEat();
        break;
      case 'bh-finale':
        particles.spawnBurst(ev.x, ev.y, BLACKHOLE_TIER, 40);
        particles.spawnRing(ev.x, ev.y, BLACKHOLE_TIER, 3);
        particles.spawnText(ev.x, ev.y, `+${ev.points}`, '#ff9a3c');
        renderer.addShake(22);
        audio.bhFinale();
        if (officialDaily) Daily.recordProgress(game.score, game.bestTier);
        break;
      case 'revive':
        for (const c of ev.cleared) particles.spawnBurst(c.x, c.y, c.tier, 5);
        renderer.addShake(8);
        audio.revive();
        break;
      case 'gameover':
        handleGameOver(ev);
        break;
    }
  }
}

// ---------- Main loop ----------
let dangerTick = 0;
let lastDraw = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (screen === 'playing') {
    if (keysHeld.has('ArrowLeft')) game.aimAngle -= 2.4 * dt;
    if (keysHeld.has('ArrowRight')) game.aimAngle += 2.4 * dt;
    game.update(dt);
    processEvents(game.drainEvents());
    updateHud();
    updateDangerBanner();
    if (game.dangerLevel > 0.3) {
      audio.heartbeat(game.dangerLevel);
      dangerTick += dt;
      if (dangerTick > 1) { Haptics.danger(); dangerTick = 0; }
    }
  }
  particles.update(dt);
  // Behind an overlay (menu/pause/gameover) throttle rendering to ~5 fps —
  // the canvas animation is cosmetic there and full-rate redraws just burn
  // battery on phones sitting on a menu.
  if (screen === 'playing' || now - lastDraw >= 200) {
    renderer.draw(game, particles, { hideLauncher: screen !== 'playing' }, dt);
    lastDraw = now;
  }
  requestAnimationFrame(frame);
}

// ---------- Input ----------
// One pointer owns the aim: extra fingers (palm grazes, second thumb) must
// neither hijack the angle nor fire phantom drops on lift.
let aiming = false;
let activePointerId = null;

function setAimFromEvent(e) {
  game.aimAngle = renderer.angleFromScreen(e.clientX, e.clientY);
}

canvas.addEventListener('pointerdown', (e) => {
  if (screen !== 'playing') return;
  if (activePointerId !== null && e.pointerId !== activePointerId) return;
  e.preventDefault();
  activePointerId = e.pointerId;
  aiming = true;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  setAimFromEvent(e);
});

canvas.addEventListener('pointermove', (e) => {
  if (screen !== 'playing') return;
  // Desktop: the launcher follows the mouse even without a pressed button —
  // hover-aim, click to drop (portal reviewers test with a mouse).
  if (!aiming && e.pointerType === 'mouse') {
    setAimFromEvent(e);
    return;
  }
  if (!aiming || e.pointerId !== activePointerId) return;
  e.preventDefault();
  setAimFromEvent(e);
});

canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  if (!aiming || screen !== 'playing') { aiming = false; return; }
  e.preventDefault();
  aiming = false;
  setAimFromEvent(e);
  game.drop(game.aimAngle);
});

canvas.addEventListener('pointercancel', (e) => {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;
  aiming = false;
});

canvas.addEventListener('lostpointercapture', (e) => {
  if (e.pointerId === activePointerId) {
    activePointerId = null;
    aiming = false;
  }
});

// Keyboard: smooth hold-to-rotate (per-keydown stepping stutters with the
// OS key-repeat delay), space/enter to drop.
const keysHeld = new Set();
window.addEventListener('keydown', (e) => {
  if (screen !== 'playing') return;
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    keysHeld.add(e.code);
    e.preventDefault();
  } else if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') {
    e.preventDefault();
    game.drop(game.aimAngle);
  } else if (e.code === 'Escape') {
    pauseGame();
  }
});
window.addEventListener('keyup', (e) => keysHeld.delete(e.code));
window.addEventListener('blur', () => keysHeld.clear());

// ---------- Buttons ----------
$('btn-endless').addEventListener('click', () => startGame('endless'));
$('btn-daily').addEventListener('click', () => startGame('daily'));
$('btn-howto').addEventListener('click', () => show('howto'));
$('btn-howto-close').addEventListener('click', () => hide('howto'));
$('btn-settings').addEventListener('click', () => { refreshToggles(); show('settings'); });
$('btn-settings-close').addEventListener('click', () => hide('settings'));

$('tgl-sound').addEventListener('click', () => {
  settings.sound = !settings.sound;
  audio.setSound(settings.sound);
  saveSettings(); refreshToggles();
});
$('tgl-music').addEventListener('click', () => {
  settings.music = !settings.music;
  audio.init();
  audio.setMusic(settings.music);
  saveSettings(); refreshToggles();
});
$('tgl-haptics').addEventListener('click', () => {
  settings.haptics = !settings.haptics;
  Haptics.enabled = settings.haptics;
  saveSettings(); refreshToggles();
});

function pauseGame() {
  if (screen !== 'playing') return;
  screen = 'paused';
  game.paused = true;
  Ads.gameplayStop();
  show('pause');
}
$('btn-pause').addEventListener('click', pauseGame);
$('btn-resume').addEventListener('click', () => {
  hide('pause');
  screen = 'playing';
  game.paused = false;
  lastTime = performance.now();
  Ads.gameplayStart();
});
$('btn-quit').addEventListener('click', showMenu);

$('btn-restart').addEventListener('click', () => startGame(runMode));
$('btn-gomenu').addEventListener('click', showMenu);

$('btn-revive').addEventListener('click', async () => {
  const granted = await Ads.showRewarded();
  if (!granted) return;
  if (game.revive()) {
    hide('gameover');
    screen = 'playing';
    game.paused = false;
    lastTime = performance.now();
    Ads.gameplayStart();
    processEvents(game.drainEvents());
  }
});

$('btn-double').addEventListener('click', async () => {
  // Check BEFORE consuming the ad: at UTC midnight yesterday's state expires
  // and the player must not watch an ad for nothing.
  if (!Daily.getDailyState()) {
    hide('btn-double');
    toast(t('daily_expired'));
    return;
  }
  const granted = await Ads.showRewarded();
  if (!granted) return;
  const state = Daily.applyDouble();
  if (state) {
    $('go-daily-summary').textContent = t('daily_result', state.score.toLocaleString());
    hide('btn-double');
    toast(t('doubled'));
  } else {
    hide('btn-double');
    toast(t('daily_expired'));
  }
});

$('btn-share').addEventListener('click', async () => {
  const state = Daily.getDailyState();
  if (!state) { toast(t('daily_expired')); return; }
  const streak = Daily.getStreak();
  const text = buildShareText(state.day, state.score, state.bestTier, streak.count);
  if (TEST) window.__sd.lastShareText = text;
  const result = await share(text);
  if (result === 'copied') toast(t('shared'));
  else if (result === 'failed') toast(t('share_fail'));
});

// Click sound on every button
document.addEventListener('click', (e) => {
  if (e.target.closest('button')) audio.click();
});

// ---------- Lifecycle ----------
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 250));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (screen === 'playing') pauseGame();
    // Silence the music pad while hidden — WebAudio is not rAF-throttled.
    audio.suspend();
  } else {
    audio.resume();
  }
});

window.addEventListener('pagehide', () => {
  if (officialDaily && screen === 'playing') {
    Daily.recordProgress(game.score, game.bestTier);
  }
});

// Unlock audio on activation-triggering events. Touch pointerdown alone is
// NOT one on iOS Safari — pointerup/touchend/click are what actually unlock.
// Listeners stay attached so audio also recovers after iOS 'interrupted'.
const unlockAudio = () => {
  audio.init();
  audio.resume();
};
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
  document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
}

// ---------- Service worker ----------
if ('serviceWorker' in navigator && !TEST && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ---------- Boot ----------
applyStaticText();
refreshToggles();
Daily.reconcileAbandonedRun();
Ads.init();
showMenu();
requestAnimationFrame((tm) => { lastTime = tm; requestAnimationFrame(frame); });

// ---------- Test hooks (only with ?test=1) ----------
if (TEST) {
  window.__sd = {
    version: VERSION,
    game,
    renderer,
    particles,
    daily: Daily,
    lastShareText: null,
    startGame,
    showMenu,
    drop: (angle) => game.drop(angle),
    setNow: (ts) => Daily.setNowProvider(() => ts),
    // Spawn an arbitrary body directly (e.g. two neutron stars -> black hole).
    spawn: (tier, x, y) => {
      const spec = TIERS[tier];
      const b = new Body(x, y, tier, spec.r, spec.density);
      game.physics.add(b);
      return b.id;
    },
    // Advance the simulation deterministically without waiting for rAF.
    stepFrames: (n) => {
      for (let i = 0; i < n; i++) {
        if (screen === 'playing') {
          game.fixedStep(PHYSICS.DT);
          processEvents(game.drainEvents());
        }
        particles.update(PHYSICS.DT);
      }
      updateHud();
      updateDangerBanner();
    },
    state: () => ({
      screen,
      mode: runMode,
      officialDaily,
      score: game.score,
      merges: game.merges,
      chain: game.chain,
      bestTier: game.bestTier,
      over: game.over,
      dropsMade: game.dropsMade,
      dangerLevel: game.dangerLevel,
      bodies: game.physics.bodies.map((b) => ({ x: b.x, y: b.y, r: b.r, tier: b.tier, eaten: b.eaten })),
      kinetic: game.physics.kineticEnergy(),
    }),
  };
}
