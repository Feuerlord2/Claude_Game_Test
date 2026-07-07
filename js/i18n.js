// Tiny i18n: English default, German auto-detected. All UI strings live here.

const STRINGS = {
  en: {
    tagline: 'Merge matter. Birth a black hole.',
    play_endless: 'Play Endless',
    daily_label: (n) => `Daily Singularity #${n}`,
    daily_ready: '1 scored attempt · same puzzle worldwide',
    daily_done: (score) => `Scored: ${score} · practice mode`,
    howto: 'How to',
    settings: 'Settings',
    howto_title: 'How to play',
    howto_body: `<p>Drag around the ring to aim, release to <b>drop</b> a celestial body into the gravity well.</p>
<p>Two identical bodies <b>merge</b> into the next one:</p>
<p class="howto-chain">✨→☄️→🪨→🌠→🌙→🌍→🪐→⭐→🔴→🌟→⚫</p>
<p>Chains multiply your score. Merging two neutron stars 🌟 births a <b>black hole</b> ⚫ that devours everything nearby.</p>
<p>If the pile stays outside the <b>red ring</b> too long, it collapses — game over.</p>
<p>The <b>Daily Singularity</b> is the same puzzle for every player on Earth. One scored attempt per day — keep your streak alive!</p>`,
    got_it: 'Got it',
    sound: 'Sound',
    music: 'Music',
    haptics: 'Vibration',
    close: 'Close',
    on: 'ON',
    off: 'OFF',
    paused: 'Paused',
    resume: 'Resume',
    quit: 'Back to menu',
    collapse: 'Collapse!',
    new_best: 'NEW BEST',
    stats: (best, merges) => `Best body: ${best} · Merges: ${merges}`,
    revive: '☀️ Solar Flare — keep playing (Ad)',
    restart: 'Play again',
    menu: 'Menu',
    share: 'Share result',
    shared: 'Copied to clipboard!',
    share_fail: 'Could not copy',
    double: '🎬 Double score (Ad)',
    doubled: 'Score doubled!',
    streak: (n) => `🔥 ${n}-day streak`,
    shields: (n) => `🛡️ ${n}`,
    daily_result: (score) => `Today's official score: ${score}`,
    practice: 'Practice run — score not counted',
    next_daily: (h, m) => `Next Daily in ${h}h ${m}m`,
    best_label: (s) => `Best ${s}`,
    mode_daily: 'Daily',
    mode_practice: 'Practice',
    ad_stub: 'Ad placeholder — portal SDK plugs in here',
    tier_names: ['Stardust', 'Meteoroid', 'Asteroid', 'Comet', 'Moon', 'Planet', 'Gas Giant', 'Star', 'Red Giant', 'Neutron Star', 'Black Hole'],
    share_text: (n, score, emoji, tierName, tierIdx, streak, url) =>
      `Singularity Drop #${n}\n${emoji} ${score.toLocaleString('en-US')} pts · ${tierName} (${tierIdx + 1}/11)` +
      (streak > 1 ? `\n🔥 ${streak}-day streak` : '') + `\n${url}`,
  },
  de: {
    tagline: 'Verschmilz Materie. Erschaffe ein Schwarzes Loch.',
    play_endless: 'Endlos spielen',
    daily_label: (n) => `Daily Singularity #${n}`,
    daily_ready: '1 gewerteter Versuch · weltweit dasselbe Puzzle',
    daily_done: (score) => `Gewertet: ${score} · Übungsmodus`,
    howto: 'Anleitung',
    settings: 'Optionen',
    howto_title: 'So funktioniert’s',
    howto_body: `<p>Ziehe am Ring, um zu zielen — loslassen <b>lässt fallen</b>: Der Himmelskörper stürzt in den Gravitationsschacht.</p>
<p>Zwei gleiche Körper <b>verschmelzen</b> zum nächsten:</p>
<p class="howto-chain">✨→☄️→🪨→🌠→🌙→🌍→🪐→⭐→🔴→🌟→⚫</p>
<p>Ketten multiplizieren deine Punkte. Zwei Neutronensterne 🌟 gebären ein <b>Schwarzes Loch</b> ⚫, das alles in der Nähe verschlingt.</p>
<p>Bleibt der Haufen zu lange außerhalb des <b>roten Rings</b>, kollabiert er — Game Over.</p>
<p>Die <b>Daily Singularity</b> ist für alle Spieler weltweit dasselbe Puzzle. Ein gewerteter Versuch pro Tag — halte deine Serie am Leben!</p>`,
    got_it: 'Alles klar',
    sound: 'Sound',
    music: 'Musik',
    haptics: 'Vibration',
    close: 'Schließen',
    on: 'AN',
    off: 'AUS',
    paused: 'Pause',
    resume: 'Weiter',
    quit: 'Zum Menü',
    collapse: 'Kollaps!',
    new_best: 'NEUER REKORD',
    stats: (best, merges) => `Bester Körper: ${best} · Merges: ${merges}`,
    revive: '☀️ Sonneneruption — weiterspielen (Ad)',
    restart: 'Nochmal',
    menu: 'Menü',
    share: 'Ergebnis teilen',
    shared: 'In Zwischenablage kopiert!',
    share_fail: 'Kopieren fehlgeschlagen',
    double: '🎬 Punkte verdoppeln (Ad)',
    doubled: 'Punkte verdoppelt!',
    streak: (n) => `🔥 Serie: ${n} Tage`,
    shields: (n) => `🛡️ ${n}`,
    daily_result: (score) => `Heutiger gewerteter Score: ${score}`,
    practice: 'Übungsrunde — zählt nicht',
    next_daily: (h, m) => `Nächste Daily in ${h} h ${m} min`,
    best_label: (s) => `Best ${s}`,
    mode_daily: 'Daily',
    mode_practice: 'Übung',
    ad_stub: 'Werbe-Platzhalter — hier dockt das Portal-SDK an',
    tier_names: ['Sternenstaub', 'Meteoroid', 'Asteroid', 'Komet', 'Mond', 'Planet', 'Gasriese', 'Stern', 'Roter Riese', 'Neutronenstern', 'Schwarzes Loch'],
    share_text: (n, score, emoji, tierName, tierIdx, streak, url) =>
      `Singularity Drop #${n}\n${emoji} ${score.toLocaleString('de-DE')} Pkt. · ${tierName} (${tierIdx + 1}/11)` +
      (streak > 1 ? `\n🔥 Serie: ${streak} Tage` : '') + `\n${url}`,
  },
};

export const lang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

export function t(key, ...args) {
  const entry = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key];
  if (typeof entry === 'function') return entry(...args);
  return entry ?? key;
}
