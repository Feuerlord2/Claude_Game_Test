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
