// Tiny i18n: English default, German auto-detected. All UI strings live here.

const STRINGS = {
  en: {
    tagline: 'Merge matter. Birth a black hole.',
    play_endless: 'Play Endless',
    daily_label: (n) => `Daily Singularity #${n}`,
    daily_ready: '1 scored attempt · same puzzle worldwide',
    daily_done: (score) => `Scored: ${score} · practice mode`,
    streak_risk: (n) => `Keep your ${n}-day streak alive!`,
    howto: 'How to',
    settings: 'Settings',
    howto_title: 'How to play',
    howto_body: `<p>Drag around the ring to aim, release to <b>drop</b> a celestial body into the gravity well.</p>
<p>Two identical bodies <b>merge</b> into the next one:</p>
<p class="howto-chain">✨→☄️→🪨→🌠→🌙→🌍→🪐→⭐→🔴→🌟→⚫</p>
<p>Chains multiply your score. Merging two neutron stars 🌟 births a <b>black hole</b> ⚫ that devours everything nearby.</p>
<p>Bodies pushed past the <b>red ring</b> panic and show a red countdown. Merge the pile below them to pull them back in — if the countdown runs out, everything collapses.</p>
<p>After a collapse, one rewarded <b>Solar Flare</b> per run vaporizes every small body (Stardust to Moon) and lets you keep going.</p>
<p>The <b>Daily Singularity</b> is the same puzzle for every player on Earth. One scored attempt per day — keep your streak alive!</p>`,
    got_it: 'Got it',
    codex_title: 'The celestial bodies',
    codex_neutron: 'small but HEAVY — frees space!',
    codex_bh: 'devours everything, then bursts into points',
    tut_steps: [
      { title: 'Drop & merge', body: 'Drag around the ring to aim, release to drop.<br>Two identical bodies <b>merge</b> into the next one:<br><span class="howto-chain">✨→☄️→🪨→🌠→🌙→🌍→🪐→⭐→🔴→🌟→⚫</span>' },
      { title: 'The red ring', body: 'Bodies pushed past the <b>red ring</b> panic and show a countdown.<br>Merge the pile below to pull them back — or everything <b>collapses</b>.' },
      { title: 'Two cosmic twists', body: '🌟 <b>Neutron stars are SMALL</b> but heavy — merging two red giants frees space.<br><br>⚫ The <b>black hole</b> devours everything nearby, then evaporates into points!' },
    ],
    tut_next: 'Next',
    tut_go: 'Let’s go!',
    first_neutron: '🌟 Neutron star! Small but heavy — you just freed space.',
    first_bh: '⚫ BLACK HOLE! It devours everything nearby…',
    show_badges: 'Tier numbers',
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
    collapse_in: (s) => `Collapse in ${s}s`,
    new_best: 'NEW BEST',
    stats: (best, merges) => `Best body: ${best} · Merges: ${merges}`,
    revive: '☀️ Solar Flare — vaporize all small bodies (Ad)',
    restart: 'Play again',
    menu: 'Menu',
    share: 'Share result',
    shared: 'Copied to clipboard!',
    share_fail: 'Could not copy',
    double: '🎬 Double score (Ad)',
    doubled: 'Score doubled!',
    daily_expired: 'A new day has begun — play today’s Daily!',
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
    share_text: (n, score, emoji, tierName, tierIdx, streak, url, grid) =>
      `Singularity Drop #${n}\n${grid}\n${emoji} ${score.toLocaleString('en-US')} pts · ${tierName} (${tierIdx + 1}/11)` +
      (streak > 1 ? `\n🔥 ${streak}-day streak` : '') + `\n${url}`,
  },
  de: {
    tagline: 'Verschmilz Materie. Erschaffe ein Schwarzes Loch.',
    play_endless: 'Endlos spielen',
    daily_label: (n) => `Daily Singularity #${n}`,
    daily_ready: '1 gewerteter Versuch · weltweit dasselbe Puzzle',
    daily_done: (score) => `Gewertet: ${score} · Übungsmodus`,
    streak_risk: (n) => `Halte deine ${n}-Tage-Serie am Leben!`,
    howto: 'Anleitung',
    settings: 'Optionen',
    howto_title: 'So funktioniert’s',
    howto_body: `<p>Ziehe am Ring, um zu zielen — loslassen <b>lässt fallen</b>: Der Himmelskörper stürzt in den Gravitationsschacht.</p>
<p>Zwei gleiche Körper <b>verschmelzen</b> zum nächsten:</p>
<p class="howto-chain">✨→☄️→🪨→🌠→🌙→🌍→🪐→⭐→🔴→🌟→⚫</p>
<p>Ketten multiplizieren deine Punkte. Zwei Neutronensterne 🌟 gebären ein <b>Schwarzes Loch</b> ⚫, das alles in der Nähe verschlingt.</p>
<p>Körper, die über den <b>roten Ring</b> hinausgedrückt werden, bekommen Panik und zeigen einen roten Countdown. Räume den Haufen darunter ab, um sie zurückzuholen — läuft der Countdown ab, kollabiert alles.</p>
<p>Nach einem Kollaps verdampft eine <b>Sonneneruption</b> (1× pro Run, Werbung) alle kleinen Körper (Sternenstaub bis Mond) — und du spielst weiter.</p>
<p>Die <b>Daily Singularity</b> ist für alle Spieler weltweit dasselbe Puzzle. Ein gewerteter Versuch pro Tag — halte deine Serie am Leben!</p>`,
    got_it: 'Alles klar',
    codex_title: 'Die Himmelskörper',
    codex_neutron: 'klein, aber SCHWER — schafft Platz!',
    codex_bh: 'frisst alles und zerplatzt in Punkte',
    tut_steps: [
      { title: 'Fallen lassen & verschmelzen', body: 'Ziehe am Ring, um zu zielen — loslassen lässt fallen.<br>Zwei gleiche Körper <b>verschmelzen</b> zum nächsten:<br><span class="howto-chain">✨→☄️→🪨→🌠→🌙→🌍→🪐→⭐→🔴→🌟→⚫</span>' },
      { title: 'Der rote Ring', body: 'Körper jenseits des <b>roten Rings</b> bekommen Panik und einen Countdown.<br>Räume den Haufen darunter ab, um sie zu retten — sonst <b>kollabiert</b> alles.' },
      { title: 'Zwei kosmische Twists', body: '🌟 <b>Neutronensterne sind KLEIN</b>, aber schwer — zwei Rote Riesen zu verschmelzen schafft Platz.<br><br>⚫ Das <b>Schwarze Loch</b> frisst alles in der Nähe und zerplatzt dann in Punkte!' },
    ],
    tut_next: 'Weiter',
    tut_go: 'Los geht’s!',
    first_neutron: '🌟 Neutronenstern! Klein, aber schwer — du hast gerade Platz geschaffen.',
    first_bh: '⚫ SCHWARZES LOCH! Es frisst alles in der Nähe…',
    show_badges: 'Tier-Nummern',
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
    collapse_in: (s) => `Kollaps in ${s} s`,
    new_best: 'NEUER REKORD',
    stats: (best, merges) => `Bester Körper: ${best} · Merges: ${merges}`,
    revive: '☀️ Sonneneruption — alle kleinen Körper verdampfen (Ad)',
    restart: 'Nochmal',
    menu: 'Menü',
    share: 'Ergebnis teilen',
    shared: 'In Zwischenablage kopiert!',
    share_fail: 'Kopieren fehlgeschlagen',
    double: '🎬 Punkte verdoppeln (Ad)',
    doubled: 'Punkte verdoppelt!',
    daily_expired: 'Ein neuer Tag hat begonnen — spiel die heutige Daily!',
    streak: (n) => `🔥 Serie: ${n} ${n === 1 ? 'Tag' : 'Tage'}`,
    shields: (n) => `🛡️ ${n}`,
    daily_result: (score) => `Heutiger gewerteter Score: ${score}`,
    practice: 'Übungsrunde — zählt nicht',
    next_daily: (h, m) => `Nächste Daily in ${h} h ${m} min`,
    best_label: (s) => `Rekord ${s}`,
    mode_daily: 'Daily',
    mode_practice: 'Übung',
    ad_stub: 'Werbe-Platzhalter — hier dockt das Portal-SDK an',
    tier_names: ['Sternenstaub', 'Meteoroid', 'Asteroid', 'Komet', 'Mond', 'Planet', 'Gasriese', 'Stern', 'Roter Riese', 'Neutronenstern', 'Schwarzes Loch'],
    share_text: (n, score, emoji, tierName, tierIdx, streak, url, grid) =>
      `Singularity Drop #${n}\n${grid}\n${emoji} ${score.toLocaleString('de-DE')} Pkt. · ${tierName} (${tierIdx + 1}/11)` +
      (streak > 1 ? `\n🔥 Serie: ${streak} Tage` : '') + `\n${url}`, // share only for streak>1, always plural
  },
};

export const lang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

export function t(key, ...args) {
  const entry = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key];
  if (typeof entry === 'function') return entry(...args);
  return entry ?? key;
}
