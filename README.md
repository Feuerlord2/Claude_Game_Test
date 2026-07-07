# ⚫ Singularity Drop

**Merge matter. Birth a black hole.** — Ein Mobile-First-HTML5-Spiel:
Physics-Merge (Suika-Klasse) mit Radial-Gravitation in einer kreisrunden Arena,
plus Wordle-artigem **Daily-Modus** mit Streaks und Spoiler-freiem Emoji-Share.

| | |
|---|---|
| **Tech** | Vanilla JS (ES-Module) + Canvas 2D, **null Dependencies, kein Build-Step** |
| **Größe** | ~90 KB JS gesamt, Instant Load — erfüllt Poki/CrazyGames-Anforderungen |
| **Plattformen** | Jeder Browser (Touch + Maus + Tastatur), installierbare PWA, offline-fähig |
| **Sprachen** | Deutsch + Englisch (Auto-Erkennung) |
| **Monetarisierung** | Rewarded-Ad-Placements hinter Adapter-Interface (SDK-ready), s. unten |

## Spielprinzip

Himmelskörper vom Rand einer kreisrunden Arena in den Gravitationsschacht fallen
lassen. Zwei gleiche Körper verschmelzen zum nächsten Tier:

**✨ Sternenstaub → ☄️ Meteoroid → 🪨 Asteroid → 🌠 Komet → 🌙 Mond → 🌍 Planet →
🪐 Gasriese → ⭐ Stern → 🔴 Roter Riese → 🌟 Neutronenstern → ⚫ Schwarzes Loch**

- **Kettenreaktionen** multiplizieren Punkte (bis ×3).
- **Neutronensterne sind klein und schwer** (Sternkollaps!) — Fortschritt schafft Platz.
- Das **Schwarze Loch** verschlingt 1,7 s lang alles in Reichweite und
  evaporiert dann mit Bonus (Hawking-Strahlung) — das Board-Clear-Spektakel.
- Bleibt der Haufen zu lange außerhalb des roten Rings → **Kollaps** (Game Over).
- **Daily Singularity**: ein deterministischer Seed pro UTC-Tag, weltweit
  identisch, 1 gewerteter Versuch, Streak mit Schutzschilden (1 je 7 Tage, max. 2),
  Share-Text im Wordle-Format.

## Entwicklung

```bash
# Lokal starten (beliebiger statischer Server)
npx http-server . -p 8080
# -> http://localhost:8080

# E2E-Tests (headless Chromium via Playwright, 73 Checks)
node test/e2e.mjs
```

`?test=1` an die URL anhängen aktiviert deterministische Test-Hooks
(`window.__sd`), deaktiviert Audio/Service-Worker und beschleunigt Ad-Stubs.

### Architektur

```
index.html            App-Shell, DOM-Overlays (Menü, Game Over, Settings…)
css/style.css         Mobile-first UI, safe-area-aware
js/main.js            Bootstrap: Game-Loop, Input, UI-Flow, Daily-Orchestrierung
js/config.js          Alle Tuning-Konstanten + Tier-Definitionen
js/physics.js         Verlet-Kreis-Physik, Radial-Gravitation, Kontakt-Reibung
js/game.js            State-Machine: Queue, Merges, Chains, Black Hole, Lose
js/render.js          Canvas-Renderer, gecachte prozedurale Sprites, Starfield
js/particles.js       Partikel: Bursts, Shockwaves, Score-Popups
js/audio.js           WebAudio-Synth (SFX + Ambient) — keine Audio-Assets
js/daily.js           Tages-Seed, Streak/Schild-Logik, Reconciliation
js/share.js           Share-Text + navigator.share/Clipboard
js/ads.js             Ad-Adapter-Interface (Stub; Poki/CrazyGames/AdMob-ready)
js/i18n.js            DE/EN-Strings
js/storage.js         Safe-localStorage (Private-Mode-Fallback)
js/haptics.js         Vibration-API-Wrapper
js/rng.js             Deterministisches PRNG (mulberry32) + Seed-Hashing
sw.js                 Cache-first Service Worker (offline-fähig)
manifest.webmanifest  PWA-Manifest (Icons, standalone, portrait)
.github/workflows/    GitHub-Pages-Deploy bei Push auf main
test/e2e.mjs          Playwright-E2E: 73 Checks auf iPhone-Viewport
```

> **Test-Voraussetzung:** Playwright global installieren
> (`npm i -g playwright && npx playwright install chromium`) — das Repo hat
> bewusst keine package.json, das Spiel selbst braucht keinerlei Build.

## 🚀 Launch-Playbook (in dieser Reihenfolge)

### Stufe 1 — Sofort, 0 €: eigene Domain + PWA
1. Statisch deployen (Cloudflare Pages / GitHub Pages / Netlify — Repo-Root ist
   die Site). Eigene Domain lohnt sich: Share-Links zeigen hierhin, und
   **Poki zahlt 100 % Rev-Share auf selbst gebrachten Traffic**.
2. In `sw.js` bei jedem Deploy `CACHE_VERSION` bumpen.
3. Parallel auf **itch.io** spiegeln (ZIP hochladen, „HTML-Spiel“).

### Stufe 2 — Diese Woche: Portal-Submissions (der eigentliche Traffic)
- **CrazyGames** (offene Submission, 60 % Rev-Share, Auszahlung ab 100 €):
  <https://developer.crazygames.com> — Basic Launch: ≤ 50 MB ✓ (wir: < 1 MB).
  SDK-Integration: `CrazyGamesAdapter` in `js/ads.js` implementieren
  (`SDK.ad.requestAd('rewarded')` in `showRewarded`, `gameplayStart/Stop` mappen).
- **Poki** (kuratiert, 50/50 Rev-Share): <https://developers.poki.com> —
  Gate ist der „Player Fit Test“ (25 % der Tester spielen 3+ min; der
  Instant-Restart-Loop ist genau darauf gebaut). `PokiAdapter`:
  `PokiSDK.rewardedBreak()` in `showRewarded`, `gameplayStart/Stop` mappen.
- Danach Syndikation: GameDistribution, GameMonetize.

### Stufe 3 — Nach Portal-Traktion (2–6 Wochen): Google Play
1. Capacitor-Wrapper (`npx cap init` + dieses Verzeichnis als `webDir`),
   `@capacitor-community/admob` für Rewarded (`AdMobAdapter` ans Interface).
2. Play-Konsole 25 $ einmalig; 12-Tester-×-14-Tage-Closed-Test als
   Community-Aufbau nutzen (Discord/Reddit).
3. Einziges IAP zum Start: „Remove Ads + Cosmic Skin Pack“ (~2,99 €).
4. iOS erst, wenn Umsatz > 99 $/Jahr (Apple-Gebühr) — **nicht** als iOS-PWA
   (Safari löscht Storage nach 7 Tagen Inaktivität → Streak-Killer).

### Monetarisierungs-Placements (bereits eingebaut, Stub aktiv)
| Placement | Trigger | Datei |
|---|---|---|
| ☀️ Revive „Sonneneruption“ | Game Over, 1×/Run | `btn-revive` in `js/main.js` |
| 🎬 2× Daily-Score | Nach gewertetem Daily | `btn-double` in `js/main.js` |
| Interstitial-Slot | bewusst deaktiviert (Retention first) | `ads.js:commercialBreak` |

### Wachstums-Mechaniken (eingebaut)
- Share-Text mit Tag-Nummer erzeugt Wordle-artige tägliche Social-Posts.
- Streak + Schilde erzeugen den Termin-Habit.
- Black-Hole-Finale ist das clippable Streamer-Moment.

## Meilenstein-Status

Siehe [MILESTONES.md](MILESTONES.md) — alle Meilensteine erfüllt und per
E2E-Suite verifiziert. Recherche-Grundlage: [docs/RESEARCH.md](docs/RESEARCH.md).
