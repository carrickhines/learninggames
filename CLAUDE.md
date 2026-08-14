# Learning Games

Three browser games for two kids, one site, one shared character.

- **🔢 Math RPG** — counting, adding, times tables, algebra, and pattern-finding
- **🔤 Language RPG** — letters, spelling, grammar, and word play
- **📖 Story Quest** — reading comprehension as an adventure

They were three separate repos with three separate bookmarks and no memory
between sessions. They're now one site with a hub, a shared design system,
and a persistent hero who carries gold, levels, gear, and a monster-card
collection across all three games.

## Who it's for

- **Younger son (age 5)** — learning to count, read, and sequence. His tracks
  are the "little hero" rows: everything is tappable, emoji do the reading,
  and nothing punishes a wrong answer beyond a lost heart.
- **Older son (age 8, 3rd grade)** — a confident reader working on times
  tables, spelling, grammar, and finding the rule behind a pattern. His are
  the "big hero" rows.

The split is by row on each menu, not by profile, so either kid can wander
into the other's tracks.

## Layout

```
index.html          the hub: who's playing, the map, shop, cards, trader,
                    the grown-ups' progress report, settings
shared/
  tokens.css        design tokens — the one place colors and fonts are set
  ui.css            app frame, screens, buttons, HP pips, reward panel
  battle.css        arena, attack animations, timer bar (math + language only)
  sound.js          every sound effect, synthesized
  save.js           profiles, economy, shop, worlds, cards, the map — all persistence
  log.js            the play record: sessions, questions, what was missed
  reward.js         the iPad-time countdown
  hud.js            the hero chip each game wears, and the gold/level-up feedback
math/index.html
language/index.html + record.html (Voice Studio) + voice.js (generated clips)
story/index.html
.verify/            the test harness — see "Testing"
```

Shared files load with plain `<script src>` and `<link>`, so there is still
no build step and the games still open straight from `file://`.

## The map

The hub's map is the visible route through everything: a winding trail of
stops, each naming a concrete challenge, opening the next when beaten.

**Two trails, deliberately.** The five-year-old and the eight-year-old play
genuinely different content, so a single linear path would strand the younger
one at the first Algebra stop. `MAP.little` and `MAP.big` are 24 stops each,
with independent progress per profile.

Tapping a stop calls `Save.startNode()`, opens that game, and the game locks
itself to the stop's track and mode (skipping its menu). Winning calls
`Save.completeNode()`, which walks the trail forward once — replaying a beaten
stop is fine and doesn't double-advance. Some stops carry `needs: '<world>'`
and stay shut until that world is bought.

**Free play is not gated by the map.** Starting from a game's own menu clears
any armed stop. A kid who wants to drill times tables today just can.

Stop positions are not stored — the hub lays them out as a serpentine, so
adding a stop is a one-line change to the `MAP` data with nothing to
re-position.

## The hero, and why everything persists

`shared/save.js` owns one localStorage key (`lg_save_v1`) holding every
profile. The key name is fixed; the schema version lives *inside* the blob as
`v`, so a migration never orphans an existing save. (`shared/log.js` owns a
second key, `lg_log_v1` — see below for why.) This is the layer everything else hangs off:

- **Profiles** — a "who's playing?" picker on the hub. Each kid has his own
  level, gold, gear, cards, and progress, so sharing an iPad is fine.
- **XP and levels** — XP is stored as a lifetime total and the level is
  *derived* from it (`Save.levelOf`), so the two can never drift apart.
  Level N costs `100 + (N-1) * 50` XP.
- **Gold** — earned on every right answer and spent in the shop.
- **Export / Import** — localStorage is one "clear website data" away from
  gone, so Settings can write the whole save to a file and read it back.

Every write is wrapped in try/catch. A full or disabled localStorage must
leave the games playable and merely forgetful — never broken.

**Migrations.** `Save.load()` brings older saves forward once and stamps the
new version, so a hero can't be paid a migration bonus twice. v1 → v2 scaled
everyone's gold by the same factor prices moved in the rebalance, so it
neither stranded a saver nor made anyone instantly rich. Add to `migrate()`
when the schema changes; the idempotence is tested.

**Tuning lives in one place.** `ECONOMY` in `save.js` holds every payout;
`SHOP` holds every item and its effect; `WORLDS` holds every foe. Watch the
kids play, then change those numbers — nothing else needs touching.

## Earning

| Event | Gold | XP |
|---|---|---|
| Correct answer | 2 | 1 |
| Correct inside the double-hit window | 4 | 2 |
| Foe defeated | 10 | 5 |
| Run won (every foe) | 25 | 25 |
| Story Quest: right choice | 2 | 2 |
| Story Quest: chest opened | 5 | 3 |
| Quest or little-hero game finished | 30 | 30 |

**Wrong answers never cost gold.** A lost heart is punishment enough, and the
games are meant to stay encouraging. Progress only ever goes up.

Gold is then multiplied by **where you're fighting** and **what you're
wearing**: each world has a `gold` multiplier (1× in the Meadow up to 3× on
Ember Peak) and trinkets add a percentage. `Save.setContext(game)` decides
whether the world multiplier applies — Story Quest has no world, so parking in
Ember Peak can't inflate its payouts.

### The shape of the curve

Roughly 475 gold a day at 30 minutes of play. Against the price table that
means: worlds unlocking on days 3, 11, 27 and 55; every tier-4 item by day 82;
everything by day 129. **This is enforced, not hoped for** — `content.py`
simulates a day of play against the real prices and fails if the top gear
becomes reachable in a week, or if the set-gated tier turns into a second gold
wall on top of the collection.

## The shop

Five tiers per slot, each roughly 3× the last, so something is always
affordable soon and something is always a long way off. Bought on the hub,
applied at the start of the next run via `Save.loadout()`:

- **Weapons** — crit chance, and the top tiers raise double-hit damage. The
  equipped weapon is also the slash effect you see.
- **Armor** — up to +5 hearts.
- **Pets** — a companion in the arena, plus a passive (thinking time, or
  blocked hits per run).
- **Trinkets** — the fourth slot, with effects that never touch damage: gold
  bonus, card luck, a wider DOUBLE window.
- **Worlds** — five in total, each a new foe lineup, a new card set, and a
  better gold multiplier.
- **🎟️ iPad Time Token** — see below.

**The top tier of every slot needs a completed card set** (`set: '<world>'` in
`SHOP`), so the best gear is a collection problem rather than just a big
number. `buy()` returns `'noset'` for those until the set is held.

**Keep the buffs mild.** Owning something that grows is the point; making the
math easy is not.

## Monster cards

55 cards: every foe across five worlds and both battle games, plus one per
Story Quest quest and one per little-hero game.

**Cards are rare on purpose** — a collection you finish in a week isn't a
collection. A beaten monster rolls `cardChance` (12%), scaled down by the
foe's rarity, so most fights pay nothing.

- **Three rarities.** Every world's last foe is legendary. Rarity sets both
  the drop odds and the trade-in value.
- **Foils.** ~5% of drops come back shiny, worth triple in trade — the reason
  a duplicate you already own is still exciting.
- **A pity counter.** 30 monsters with nothing and the next one is certain.
  Rare must never become miserable.
- **Story Quest's cards stay guaranteed** (`awardCard(id, true)`). Finishing a
  twelve-scene quest and being told the dice said no would be miserable;
  rarity is for monsters you can re-fight in a minute.

**The Card Trader** turns spares into something: gold by rarity, or 12 spares
for any card you're missing — so a collection can always be finished by
playing rather than only by luck. Finishing a world's set grants a permanent
perk (`SET_PERKS`) and unlocks that world's tier-5 gear.

At ~22 monsters a day that's about 1.9 cards a day, and one world's nine-card
set takes a median of 17 days. `content.py` guards the drops-per-day so a
tweak can't quietly make it a week again.

Card ids must be unique across the entire site — `.verify/content.py` checks
this, because a collision would silently merge two monsters into one card.

## The record, for grown-ups

`shared/log.js` records every session and every question: what was asked, what
came back, whether it was right, and how long it took. Settings → **Progress
report** shows the headline numbers, accuracy per track (weakest first), the
**review list** of most-missed questions with what was answered instead, the
recent sessions with times of day, and a CSV export.

**It lives in its own storage key on purpose.** `Save.write()` re-serializes
the whole save blob on every correct answer; a few thousand question records
in there would mean stringifying hundreds of KB per answer on an iPad. So the
log buffers in memory and writes at the end of a run — a test asserts that
fifty answers cause zero writes — and flushes on `visibilitychange` and
`pagehide` so closing the iPad mid-battle doesn't lose the morning.

Capped at 3,000 answers per hero, oldest dropped first. If storage fills
anyway it halves itself and retries. **Nothing in the module may throw:** a
parent losing a record is a shame, a child losing a battle to a storage error
is not acceptable.

## Win reward — iPad game time

Beating a run used to grant 5–10 minutes of iPad time automatically. That made
it a per-session prize that reset every night. It's now a **150-gold shop
item**, redeemed from the hub whenever the kid likes, so it accumulates like
everything else. The countdown itself is unchanged: `shared/reward.js`, a
wall-clock end time so a delayed tick can't drift, a flashing "TIME'S UP!" and
a looping two-tone alarm until it's dismissed.

**Known iOS limitation — by design, not a bug:** the timer and alarm only run
while the page is open and in the foreground. iOS Safari freezes JS timers and
Web Audio in backgrounded tabs, and a web page cannot bring itself to the
front — there is no API for it, and no Vibration API on iOS. That's why the
panel nudges the player to keep the screen open or ask Siri. Don't try to fix
this with notifications or PWA push: it needs an installed PWA plus permission
and *still* can't schedule a future alarm without live JS, which breaks the
single-file `file://` design.

---

# Math RPG

Twelve tracks. A `MAKERS` registry maps each track id to a function returning
either `{ text, answer }` (answered on the number pad) or
`{ text, answer, choices }` (answered by tapping a tile).

**Little hero (age 5)**

| Track | What it drills |
|---|---|
| 🔢 Next Number | counting: 1–30, what comes after |
| ↕️ One More, One Less | number sense in both directions |
| 👣 Count On | add 1, 2 or 3 — counting toward addition |
| 🦘 Skip Counting | 5s and 10s; 2s and 3s unlock by winning a run |
| ➕ Addition | single digits, with the number blocks |
| ➖ Subtraction | take-away, result always ≥ 1 |
| 🎨 Pattern Blocks | repeating patterns — proto-algebra |
| 🧺 Sort It! | which one doesn't belong — categorizing |

**Big hero (age 8)**

| Track | What it drills |
|---|---|
| ✖️ Multiplication | tables, both factors 2–12 |
| ➗ Division | the same facts backwards, always clean |
| 🧩 Algebra | solve for x; ~30% two-step |
| 🔍 Rule Hunter | the five-rung sequencing ladder |

## Rule Hunter

One track, five rungs. The rung lives on the profile (`progress.seqTier`) and
steps up every 5 correct answers, so the ladder is remembered between sessions.

1. Single operation — `3, 6, 9, ?`
2. Multiplicative — `2, 4, 8, 16, ?` (the leap from adding to multiplying)
3. Backwards and dividing — `20, 17, 14, ?` (so "bigger" stops being a safe guess)
4. Two interleaved rules — `1, 2, 4, 5, 7, 8, ?` (working memory)
5. Name the rule, or predict the 10th number

Rung 5 is the point of the whole track: it stops asking *what's the next
number* and starts asking *what's the rule*.

## Number blocks (addition, count-on, subtraction)

The operands render as towers of plain colored blocks — Numberblocks-style,
mirroring the physical blocks at home. Each number has its own color, each
tower is a grid that wraps at ~3 blocks per column, and the towers are
draggable so the child can physically push one onto the other (or press
"Push together"). Subtraction shows one tower with the top `b` blocks marked,
and "Take N away" animates them off.

**The total is never printed.** Combining or removing lights the blocks up one
at a time to pace counting; the child counts and types the answer. This is a
counting aid, not an autosolve.

---

# Language RPG

Fourteen tracks, declared once each in the `TRACKS` array — which renders the
menu, picks the deck, and maps the question maker. (This used to be three
unlinked places, and nothing warned you if you updated only two.)

**Little hero:** Letter Hunt, Beginning Sounds, Word Builder, Sight Words,
Read It!, Rhyme Time, Opposites, Time Machine.
**Big hero:** Fix It!, Word Forge, Grammar Hunt, Syllable Smith, Word Twins,
Mark It!

## The no-transcription architecture

The game **never listens to the child** — no speech-to-text, no API keys, no
external services. Instead:

- **The game's voice is the parent's voice.** The vocabulary is closed, so
  `record.html` (the Voice Studio) lets a parent record every prompt once and
  downloads a single `voice.js` of base64 clips that sits next to
  `index.html`. Data URIs mean no fetch, so it works from `file://` too.
- **`speechSynthesis` is only a fallback** for clips not yet recorded. It was
  once the primary voice, but robot TTS proved too poor for a child to make
  out words. Record on the device the kids actually play on (mp4/AAC records
  and plays everywhere; Chrome-recorded webm may not play on iPads).
- **Emoji are the art.** Every picture ships with the OS.
- **All input is tapping.** A five-year-old drives everything with one finger.

Reading *aloud* is the one skill this can't grade; that stays a
parent-at-bedtime activity by design. **Don't add transcription back.**

Clip ids: `L_B` (letter), `W_cat` (word), `S_the` (sight word), `R_frog`
(rhyme/sound/opposite-only word), `V_tear` (Time Machine stem), `O_tore`
(Time Machine option), `P_*` (game phrases).

**`record.html` duplicates the content lists** — keep them in sync when adding
content, and re-record the new clips. `.verify/content.py` checks that every
phrase the game can ask for is recordable.

## Authoring rules

These are the rules nothing at runtime can notice being broken — a violated
one produces a question with two right answers or none. `.verify/content.py`
enforces them.

- **Beginning Sounds** — one initial sound per family, and no two families may
  share it. No emoji may appear in two families, or a decoy is secretly right.
  Every emoji must be unmistakably nameable by a five-year-old.
- **Opposites** — both halves drawable as one unmistakable emoji; no emoji
  repeats across pairs.
- **Rhyme Time** — families must be complete: two words that rhyme must never
  sit in different families.
- **Fix It!** — the `wrong` word appears exactly once (matching ignores
  trailing `.,!?` but is case-sensitive, which is what makes capitalization
  items work). No decoy may be a defensible correction.
- **Word Forge / Syllable Smith** — parts concatenate into the real word with
  no spelling changes (so no `happy` + `ly`); decoys never equal a real part.
- **Grammar Hunt** — the sentence contains exactly one word of the asked class.
- **Mark It!** — end marks: only one mark defensible. Commas: direct address,
  introductory words, and compound sentences only — **no serial lists**, to
  dodge the Oxford-comma ambiguity.
- **Time Machine** — `wrong` is the classic over-regularized kid form and must
  never be a defensible real past tense (no pay/payed, dive/dived) or sound
  identical to the answer. Skip homograph pasts (read/read).

---

# Story Quest

A choose-your-path story where **reading carefully IS the mechanic**: every
scene's correct choice is supported by a clue in the scene text, so skimming
gets you hurt and careful reading wins.

**There is deliberately no timer.** Comprehension is the one skill where time
pressure is counterproductive — the whole point is slowing down. Don't add one.

## Big hero quests (8 quests · 85 scenes · 45 chests)

🌉 The Troll Bridge · 🐉 The Dragon's Library · 👻 The Ghost Ship ·
🧙 The Wizard's Maze · 🤖 The Robot Bakery · 🧊 The Yeti's Birthday ·
🚀 The Moon Rescue · 🌋 The Grumbly Volcano

When adding quests, pick settings and rule-mechanics these don't already use.

Data shape: `QUESTS` is `{ emoji, title, sub, scenes }`, each scene
`{ art, text, choices: [{ t, ok } | { t, oops }], chest? }`, each chest
`{ q, a: [3 strings], right }`.

- **Exactly one choice per scene has `ok: true`**, and the scene text must
  contain what makes it right — a stated rule, a detail, or two clues to
  combine. Never guessable only by genre convention, and never a trick.
- Wrong choices carry a 1–2 sentence `oops`: funny, gentle, never scary. The
  tone is "the story pushes back", not "you failed".
- Chest questions rotate literal recall, vocabulary in context, inference, and
  sequencing. Chests **never punish** — a wrong answer just leaves the chest
  locked, and a right one heals a heart, so careful reading recovers careless
  mistakes.
- A quest should run 10–15 minutes: ~10–12 scenes, 4–6 chests, 5 hearts.

## Little hero games

- **🃏 Story Order** — tap 3–4 picture cards into the order they happen. The
  steps must have exactly one sensible order a five-year-old can reason about
  from everyday life; no two steps may be swappable.
- **🌱 Finish the Story** — 2–3 sentences, then pick what happens next. The
  right ending must follow from the text, and the wrong ones must be gently
  silly rather than plausible-but-wrong, so a miss is funny and never
  confusing.

Both run `MINI_ROUNDS` rounds and share the hearts, panel, and end screens.

---

# Difficulty modes

Three modes in the two battle games, distinguished by **time pressure**:
Easy (long, relaxed), Normal (moderate), Expert (short). Per-mode timing lives
in `MODES` (`total`, `fast`, `penalty`).

**Easy stays pressure-free:** the timer and the double-hit bonus are shown, but
running out of time does not let the foe attack (`penalty: false`). The timer
is a reward for speed, never a punishment. A *wrong* answer still lets the foe
counterattack in every mode.

## Double Attack Timer

The early part of the bar is a gold **fast zone** ending at a white marker.
Answer inside it for a **DOUBLE hit** — double damage, a bigger animation, and
double gold. This works the same on every track. Equipped gear can add
thinking time to the *total*, but never widens the fast zone.

---

# Sound

Every effect is synthesized at runtime with the Web Audio API — no audio files,
so the games stay self-contained and work from `file://`. `shared/sound.js`
builds tones and noise bursts for hits, the double hit, damage, wrong answers,
KOs, coins, level-ups, purchases, card drops, victory, game over, UI taps, the
number-block count-up, and the looping alarm.

- A 🔊 mute toggle sits top-right on every page; the preference is **shared
  across the whole site** (`lg_muted`).
- The audio context is created on the first user gesture, to satisfy autoplay
  rules.

# Visual design

One system, defined in `shared/tokens.css` and `shared/ui.css`: a rounded
`#app` frame on a dark page, twilight starfield with a pink horizon glow,
glassy dark panels with backdrop blur, gold gradient buttons with a 3D "lip",
a rounded display font, and HP as countable pips — green hearts for the hero,
pink orbs for the foe.

Screens use one convention everywhere: `.screen` is hidden, `.screen.show` is
visible, navigate with `showScreen(id)`. A screen that can outgrow the frame
gets `.scrolls` plus a `.screen-inner` wrapper, which centers when it fits and
scrolls when it doesn't.

# Design priorities

- **Kid-friendly UI.** Big text, big targets, clear feedback. Must be usable by
  a five-year-old.
- **Immediate, encouraging feedback.** Celebrate right answers; make wrong ones
  gentle.
- **Fast to start.** Pick a hero, pick a game, play.
- **Readable code.** This is a hackable family project — favor clarity over
  cleverness so problem ranges, timers, prices, and visuals stay easy to
  adjust.

# Technical approach

Plain HTML, CSS, and JavaScript. No build step, no server, no frameworks, no
external dependencies. Everything runs by opening a file or serving the folder
statically. Keep it that way.

---

# Testing

No test framework — the harness drives the real pages in headless Firefox.
Set it up once with `.verify/setup.sh` (creates the venv, downloads
geckodriver), then:

| Command | What it checks |
|---|---|
| `.verify/venv/bin/python .verify/smoke.py` | every page loads, styles resolve, each game starts and pays for one answer, the shop and cards and token flows work |
| `.verify/venv/bin/python .verify/run-save-test.py` | 230 assertions over `save.js` and `log.js` — profiles, level rollover, buying, set gating, card rarity and pity as *statistics* over thousands of rolls, the trader's arithmetic, the map trails, the log's buffering and cap, import round-trip, corrupt saves, storage-throws |
| `.verify/venv/bin/python .verify/tracks.py` | generates hundreds of problems per math track and re-derives every answer |
| `.verify/venv/bin/python .verify/content.py` | the authoring rules above, across all three games |
| `.verify/venv/bin/python .verify/playthrough.py` | plays every game to its win screen and checks the gold, cards, and progress that resulted |
| `.verify/venv/bin/python .verify/shots.py` | screenshots every screen to `.verify/shots/` |

Run `smoke.py` after any change. Run `content.py` after touching content,
prices, or card odds — it simulates the economy and the drop rates and fails
if either drifts out of the intended range. Run `tracks.py` after touching a
generator.

**Two traps worth knowing about**, both already handled:

- A script that throws *during parse* leaves no error for a `window.onerror`
  trap installed afterwards. Each game assigns `window.TEST` on its last line,
  and `smoke.py` checks that it exists — which is only true if the script ran
  all the way down.
- Headless Firefox stops advancing the CSS animation clock after a window
  resize, which pins pop-in animations at their first frame. `shots.py`
  disables animations, which is what a screenshot suite wants anyway.

`window.TEST` in each game exposes the state and data the harness needs. It
costs nothing in play.

# Hosting

GitHub Pages, published by `.github/workflows/pages.yml` on every push to
`main` (repo Pages settings: Source = "GitHub Actions"). There is no build
step — the same files that run from `file://` are what get served.

- Repo: https://github.com/carrickhines/learninggames
- Live: https://carrickhines.github.io/learninggames/

The three original repos (`mathrpg`, `languagerpg`, `storyquest`) hold the
history of how each game was built. They're still live and unchanged; once
this site is confirmed working on the kids' iPads, each gets a one-line
meta-refresh redirect here so the old bookmarks keep working.
