# Singularity Drop — Meilensteine

Produktentscheidung basiert auf Markt-Recherche (Juli 2026), siehe `docs/RESEARCH.md`.

**Konzept:** Physics-Merge-Arcade (Suika-Klasse) mit Radial-Gravitation in einer
kreisrunden Arena + Wordle-artigem Daily-Modus mit Streak und Emoji-Share.
**Zielplattformen:** Web (eigene Domain als PWA, Poki, CrazyGames, itch.io) →
später Google Play via Capacitor.
**Monetarisierung:** Rewarded Ads (Revive, 2× Daily-Score) über Adapter-Interface,
Portal-SDKs andockbar, Remove-Ads/Kosmetik-IAP im Store-Build.

## M1 — Spielbarer Core-Loop
- [x] Verlet-Physik: Kreis-Kollisionen, Radial-Gravitation, stabile Haufenbildung
- [x] 11-Tier-Merge-Kette (Sternenstaub → Schwarzes Loch) mit Kaskaden + Chain-Multiplikator
- [x] Rim-Launcher: Touch-Drag/Maus-Aiming über 360°, Ghost-Vorschau, Next-Piece-Queue
- [x] Danger-Ring-Lose-Condition mit Warnphase, Instant-Restart < 1 s
- [x] Black-Hole-Finale: konsumiert Umgebung, evaporiert mit Bonus
- [x] Verifiziert: Playwright-Autoplay (Merges passieren, keine NaN, Game Over + Restart funktionieren)

## M2 — Juice & Polish
- [x] Prozedurale Tier-Sprites (Gradient + Glow, gecacht — in M7 durch Kawaii-Sprites ersetzt)
- [x] Merge-Partikel, Shockwave-Ringe, Screenshake skaliert mit Tier
- [x] WebAudio-Synth: Drop-Pluck, aufsteigende Merge-Töne, Chain-Pitch, Danger-Heartbeat, BH-Boom
- [x] Haptik (Vibration API), Starfield-/Nebel-Hintergrund
- [x] 60 fps auf Mobile-Klasse-Hardware (DPR-Cap, Sprite-Cache, kein DOM im Game-Loop)

## M3 — Daily Singularity + Streak + Share
- [x] Deterministischer Tages-Seed aus UTC-Datum, weltweit identische Piece-Sequenz
- [x] Ein gewerteter Versuch/Tag + unbegrenzte Practice-Runs, Countdown zum nächsten Daily
- [x] Streak mit Schutzschilden (1 Schild je 7 Tage, max. 2, automatische Einlösung)
- [x] Spoiler-freier Emoji-Share-Text (Clipboard + navigator.share) mit Spiel-URL
- [x] Verifiziert: gleicher Tag ⇒ gleiche Sequenz, anderer Tag ⇒ andere Sequenz (E2E)

## M4 — Persistenz, PWA, Monetarisierungs-Seams, i18n
- [x] localStorage-Persistenz (Bestscore, Daily-Historie, Streak, Settings) mit Fallback
- [x] PWA: Manifest, Service Worker (offline-fähig), Icons 192/512 + maskable
- [x] Ad-Adapter-Interface: Rewarded-Placements (Revive „Solar Flare“, 2× Daily) als Stub,
      dokumentierte Seams für Poki SDK / CrazyGames SDK / AdMob
- [x] UI in Deutsch + Englisch (Auto-Erkennung)

## M5 — QA
- [x] Playwright-E2E auf Mobile-Viewport (Touch): Gameplay, Determinismus, Persistenz,
      Game Over, Revive, Share-Format
- [x] Performance-Messung im Autoplay (Frame-Budget)
- [x] Adversariales Multi-Agenten-Code-Review, Findings verifiziert und gefixt

## M6 — Docs & Launch
- [x] README: Setup, Tests, Deployment, Portal-Submission-Playbook, Capacitor-Pfad
- [x] Monetarisierungs-Playbook mit konkreten nächsten Schritten
- [x] Alles committet und gepusht auf `claude/mobile-game-dev-66vxk6`

## M7 — Playtest-Feedback: Kawaii-Art, Schwierigkeit, Verlier-Klarheit
Nutzerfeedback nach erstem Spielen: „KI-Optik“, zu leicht, Verlieren unklar.
- [x] Kawaii-Art-Direction: flache satte Farben, dicke Sticker-Outlines, Gesichter
      auf allen Körpern (blinzeln, freuen sich beim Merge, Panik in der Danger-Zone,
      hungriges Schwarzes Loch), Sonnenstrahlen für Sterne, Cartoon-Akkretionsring
- [x] UI-Redesign: Sticker-Lettering, drückbare Solid-Buttons mit Hard-Shadow,
      chunky Panels/Toggles — weg vom generischen Glass-Look
- [x] Schwierigkeit: Arena-Kapazität ~55 % reduziert (DANGER_R 84→74, Körper +18 %),
      Kollaps-Warnzeit 2,4 s→1,7 s, Drop-Cooldown 0,36 s→0,45 s
      (Zufalls-Bot: Ø 41 Drops bis Game Over statt 109)
- [x] Verlier-Klarheit: gefährdete Körper zeigen Panik-Gesicht + roten
      Countdown-Bogen, pulsierendes „⚠️ Kollaps in X,X s“-Banner, rote
      Bildschirm-Vignette, deutlich sichtbarer Danger-Ring, Anleitung erklärt Regel
- [x] 73/73 E2E-Checks grün nach Umbau

## M8 — Voll-Audit: jede Entscheidung hinterfragt (v1.2.0)
Drei parallele Fresh-Eyes-Reviews (Code-Korrektheit, Design-Entscheidungen,
Launch-Readiness) über den kompletten Stand; alle bestätigten Findings umgesetzt.
- [x] Share-Integrität: geteilt wird immer der Raw-Score (nie der Ad-verdoppelte)
      + Wordle-artiges Emoji-Fortschrittsgrid (✨☄️🪨…⬛⬛) im Share-Text
- [x] Loss-Aversion-Nudge im Menü („Halte deine N-Tage-Serie am Leben!")
- [x] Erster Streak-Schild schon an Tag 3 (Duolingo-Modell), dann alle 7 Tage
- [x] Rewarded-Ad-Leiter: erst Revive, nach dessen Nutzung Double — auch in
      Practice-Runs nachholbar (kein CTA-Wettbewerb, mehr Impressions)
- [x] Chain-Step 0,25→0,5 (Kaskaden-Setup lohnt sich sichtbar),
      Black-Hole-Fenster 1,7→2,5 s (der Höhepunkt darf wirken),
      Revive räumt den ganzen Drop-Pool (Tiers 0–4)
- [x] Daily wechselt um LOKALE Mitternacht (Wordle-Modell statt UTC-Nachmittag
      in Amerika)
- [x] Kawaii-App-Icons passend zur neuen Art, Desktop-Hover-Aiming +
      Hold-to-Rotate, echte Sprite-Vorschau im HUD, prefers-reduced-motion
- [x] Fixes aus Code-Review: wirkungsloser Perf-Test (Szene kollabierte nach
      0,7 s), Test-Drop-Kadenz unter Cooldown, eingefrorener reduced-motion-Cache
- [x] Launch-Readiness: SW-Precache ohne 512er-Icons (~600 KB gespart), og:url/
      twitter:image/mobile-web-app-capable, Pages-Workflow mit enablement,
      Testserver-Polling, i18n-Korrekturen, Doku-Fakten aktualisiert
- [x] 79/79 E2E-Checks grün

## M9 — Visual-Overhaul (Phase 1: visueller Kern, v1.3.0)
Externes KI-Feedback: Körper zu generisch/„KI-like" (jeder Tier derselbe
perfekte Kreis, nur andere Farbe). Phase 1 löst „alles rund" + „gestempelt":
- [x] Silhouetten-System pro Tier: unregelmäßige Fels-Brocken (klein),
      saubere gravitations-gerundete Welten (mittel), Silhouette-Brecher
      (Kometenschweif, Saturn-Ringe, Sternen-Korona, Pulsar-Strahlen,
      Akkretionsscheibe) — als reine Render-Overlays, Kollision bleibt Kreis
- [x] Per-Körper-Variation via `cosmeticSeed` (aus Body-id, strikt getrennt
      vom Gameplay-RNG) → keine zwei Asteroiden/Monde gleich; Cache bounded
      über wenige gebackene Varianten pro Tier
- [x] Eine konsistente Lichtquelle (oben-links): Kugel-Shading + Rim-Light,
      eine Tiefenebene — Kawaii-Charme bleibt
- [x] Material/Textur pro Familie (Krater/Speckle/Bänder/Granulation/Eis),
      leichter Outline-Wobble gegen den Maschinen-perfekt-Look
- [x] Gesichter pro Archetyp (grimmig/aufgeregt/verschlafen/strahlend/ruhig/
      hungrig) + proportionale Größe (kleine Körper = größeres Gesicht)
- [x] Tiefen-Starfield + Nebel im Hintergrund
- [x] Alle neuen Animationen mit `prefers-reduced-motion`-Fallback (verifiziert)
- [x] Daily-Determinismus, Performance (79/79 E2E, Perf-Check grün) intakt
- [x] Phase 2 (v1.4.0): First-Run-Tutorial (3 Karten inkl. der zwei
      genre-untypischen Mechaniken), One-Time-Toasts beim ersten
      Neutronenstern/Schwarzen Loch, Tier-Codex in der Anleitung (live
      gerenderte Sprites), Tier-Nummern-Badges als Accessibility-Setting,
      Parallax-Starfield-Drift, dekorative Orbit-Ringe auf breiten Screens —
      87/87 E2E-Checks
- [ ] Phase 3: Kosmetische Meta-Progression, Share-Grid-Redesign
- [ ] Phase 4: Gravitations-Puls, Modifikatoren, Freundes-Duell
