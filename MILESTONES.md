# Singularity Drop — Meilensteine

Produktentscheidung basiert auf Markt-Recherche (Juli 2026), siehe `docs/RESEARCH.md`.

**Konzept:** Physics-Merge-Arcade (Suika-Klasse) mit Radial-Gravitation in einer
kreisrunden Arena + Wordle-artigem Daily-Modus mit Streak und Emoji-Share.
**Zielplattformen:** Web (eigene Domain als PWA, Poki, CrazyGames, itch.io) →
später Google Play via Capacitor.
**Monetarisierung:** Rewarded Ads (Revive, 2× Daily-Score) über Adapter-Interface,
Portal-SDKs andockbar, Remove-Ads/Kosmetik-IAP im Store-Build.

## M1 — Spielbarer Core-Loop
- [ ] Verlet-Physik: Kreis-Kollisionen, Radial-Gravitation, stabile Haufenbildung
- [ ] 11-Tier-Merge-Kette (Sternenstaub → Schwarzes Loch) mit Kaskaden + Chain-Multiplikator
- [ ] Rim-Launcher: Touch-Drag/Maus-Aiming über 360°, Ghost-Vorschau, Next-Piece-Queue
- [ ] Danger-Ring-Lose-Condition mit Warnphase, Instant-Restart < 1 s
- [ ] Black-Hole-Finale: konsumiert Umgebung, evaporiert mit Bonus
- [ ] Verifiziert: Playwright-Autoplay (Merges passieren, keine NaN, Game Over + Restart funktionieren)

## M2 — Juice & Polish
- [ ] Prozedurale Tier-Sprites (Gradient + Glow, gecacht — kein shadowBlur im Frame)
- [ ] Merge-Partikel, Shockwave-Ringe, Screenshake skaliert mit Tier
- [ ] WebAudio-Synth: Drop-Pluck, aufsteigende Merge-Töne, Chain-Pitch, Danger-Heartbeat, BH-Boom
- [ ] Haptik (Vibration API), Starfield-/Nebel-Hintergrund
- [ ] 60 fps auf Mobile-Klasse-Hardware (DPR-Cap, Sprite-Cache, kein DOM im Game-Loop)

## M3 — Daily Singularity + Streak + Share
- [ ] Deterministischer Tages-Seed aus UTC-Datum, weltweit identische Piece-Sequenz
- [ ] Ein gewerteter Versuch/Tag + unbegrenzte Practice-Runs, Countdown zum nächsten Daily
- [ ] Streak mit Schutzschilden (1 Schild je 7 Tage, max. 2, automatische Einlösung)
- [ ] Spoiler-freier Emoji-Share-Text (Clipboard + navigator.share) mit Spiel-URL
- [ ] Verifiziert: gleicher Tag ⇒ gleiche Sequenz, anderer Tag ⇒ andere Sequenz (E2E)

## M4 — Persistenz, PWA, Monetarisierungs-Seams, i18n
- [ ] localStorage-Persistenz (Bestscore, Daily-Historie, Streak, Settings) mit Fallback
- [ ] PWA: Manifest, Service Worker (offline-fähig), Icons 192/512 + maskable
- [ ] Ad-Adapter-Interface: Rewarded-Placements (Revive „Solar Flare“, 2× Daily) als Stub,
      dokumentierte Seams für Poki SDK / CrazyGames SDK / AdMob
- [ ] UI in Deutsch + Englisch (Auto-Erkennung)

## M5 — QA
- [ ] Playwright-E2E auf Mobile-Viewport (Touch): Gameplay, Determinismus, Persistenz,
      Game Over, Revive, Share-Format
- [ ] Performance-Messung im Autoplay (Frame-Budget)
- [ ] Adversariales Multi-Agenten-Code-Review, Findings verifiziert und gefixt

## M6 — Docs & Launch
- [ ] README: Setup, Tests, Deployment, Portal-Submission-Playbook, Capacitor-Pfad
- [ ] Monetarisierungs-Playbook mit konkreten nächsten Schritten
- [ ] Alles committet und gepusht auf `claude/mobile-game-dev-66vxk6`
