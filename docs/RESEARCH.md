# Markt-Recherche (Juli 2026) — Warum Singularity Drop?

Zusammenfassung der Multi-Agenten-Recherche (4 parallele Researcher: Genre-Trends,
Monetarisierung, Plattform-Strategie, Retention-Mechaniken), auf deren Basis das
Produkt entschieden wurde.

## Kernbefunde

**Markt-Makro (AppMagic/Udonis-Daten 2025):**
- Mobile-IAP wuchs nur noch +1,3 % (~81,75 Mrd. $), Downloads fielen −7,2 %.
- **Hybrid-Casual war das einzige wachsende Casual-Segment**: +20 % IAP auf 4,2 Mrd. $.
- ~50 % des Hybrid-Casual-Umsatzes kam aus Block-/Screw-/Sort-**Puzzles**.
- Retention-Benchmarks: Hybrid-Casual D7 = 18–22 % vs. Hyper-Casual 6–9 %.
  Beste Langzeit-Retention: klassische Genres (Board, Card, Word, **Puzzle**).

**Breakout-Anatomie:**
- *Suika Game*: Physics-Merge, kein Tutorial nötig, „one more round“-Loop,
  Virality zu 100 % über Streamer-Clips (Kettenreaktionen sind clippable).
- *Wordle*: <5.000 → 45 Mio. DAU in 3 Monaten mit null Marketing. Mechanik:
  1 Puzzle/Tag (Knappheit + Termin-Habit), weltweit dasselbe Puzzle
  (geteilter Moment), Spoiler-freies Emoji-Share-Grid (eingebaute Viralität).
- *Vampire Survivors / Balatro*: Solo-Devs, minimale Art, Compulsion-Loop
  („hooks you in 45 seconds“ ist Playstacks wörtliches Signing-Kriterium).

**Distribution (der eigentliche Engpass für Solo-Devs):**
- Paid UA ist tot für Solo-Devs: CPI 2,00–3,50 $ in Hybrid-Casual-USA.
- **Web-Portale sind der einzige UA-freie Kanal**: Poki erreichte Juni 2025
  1 Mrd. Plays/Monat (~100 Mio. Spieler), Top-Devs bis 1 Mio. €/Jahr;
  CrazyGames 30–40 Mio. MAU, offene Submission, 60 % Rev-Share.
- Anforderungen der Portale: Instant Load (<5 s), 3–15-min-Sessions,
  Touch+Maus, Poki „Player Fit“: 25 % der Tester spielen 3+ Minuten.

**Monetarisierung:**
- Rewarded Video ist das einzige Ad-Format, das Retention *verbessert*
  (80–90 % Completion, 50–70 % des Ad-Umsatzes von Top-Titeln).
- Hybrid (Ads + IAP) ist das einzige wachsende Modell; keine Interstitials
  zum Launch (drücken die Retention-Metriken, auf die Portale gaten).

## Die Entscheidung

**Physics-Merge (Suika-Klasse) × Daily-Seeded-Puzzle (Wordle-Formel)** —
laut Recherche eine **unbesetzte Kombination**. Der Radial-Gravitations-Twist
(kreisrunde Arena, Gravitationszentrum statt Becher) macht es im Screenshot
sofort als „nicht Suika“ erkennbar und ist mit Kreis-Physik die billigste
Simulation, die sich großartig anfühlen kann.

Verworfene Alternativen:
1. *Reines Daily-Puzzle* — kein Endless-Session-Engine, monetarisiert auf
   Portalen schlecht (Ad-Inventar skaliert mit Session-Länge).
2. *Streamer-Roguelite (Balatro-Template)* — höchste Revenue-Ceiling, aber
   Balancing-Tiefe sprengt den Rahmen; natürliche Heimat wäre Steam/Premium.
3. *Meme-Skin-Merge (Merge Fellas-Precedent)* — schneller Cashflow-Test, aber
   Wochen-Fenster, kein bleibendes Asset. Überlebt als Idee für saisonale
   Cosmetic-Skins.
4. *Paid Idle auf Steam* — bestes dokumentiertes Solo-Verhältnis, aber nicht
   Mobile-Touch-first und nicht portal-kompatibel.

## Abgeleitete Design-Entscheidungen

| Befund | Umsetzung im Spiel |
|---|---|
| Wordle-Habit-Loop | Daily Singularity: 1 gewerteter Versuch, UTC-Seed, weltweit identisch |
| Emoji-Share als Marketing-Engine | Spoiler-freier Share-Text mit Tag-Nummer, Score, höchstem Körper |
| Duolingo-Streak-Daten (+48 % Streak-Länge durch Forgiveness) | Streak-Schilde: 1 je 7 Tage, max. 2, Auto-Einlösung |
| Rewarded-only zum Launch | Revive („Sonneneruption“) + 2×-Daily-Score, keine Interstitials |
| Portal-Gates (Load, Session) | 0 Dependencies, ~60 KB Gesamt-JS, Instant-Restart < 1 s |
| Streamer-Clippability | Kettenreaktionen + Black-Hole-Finale als Spektakel |
| Cup-Trade-Dress vermeiden | Radialgravitation + Kosmos-Theme statt Früchte/Becher |
