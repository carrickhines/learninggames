# Learning Games

Three browser games for two kids, one site, one shared character.

- **🔢 Math RPG** — counting, adding, times tables, algebra, and pattern-finding
- **🔤 Language RPG** — letters, spelling, grammar, and word play
- **📖 Story Quest** — reading comprehension as an adventure

They were three separate repos with three separate bookmarks and no memory
between sessions. They're now one site with a hub, a shared design system,
and a persistent hero who carries gold, levels, gear, and a monster-card
collection across all three games.

---

# Never lose a child's progress

**This rule outranks every design note in this file.**

Everything the kids have — gold, gear, cards, map position, the pet they
raised, months of it — lives in that iPad's `localStorage` and **nowhere
else**. There is no server, no account, no backup we control. Pushing to `main`
replaces the code underneath a save that already exists. A save destroyed is a
destroyed month, and to a seven-year-old it is not recoverable by explaining
what a schema is.

## The storage keys are permanent

`lg_save_v1` (the hero) and `lg_log_v1` (the parent record). **Never rename
them, never namespace them, never "clean them up".** The `v1` in the key is
historical; the real schema version is the `v` field *inside* the blob.
Renaming a key is indistinguishable from wiping the save.

## Schema changes go through `migrate()`, and only ever add

Bump `VERSION` in `shared/save.js` (currently **4**) and add an `if (v < N)`
block. Inside it:

- **Add missing fields; never remove, rename or re-key an existing one.** Old
  data you no longer read costs a few bytes and is free insurance.
- **Never reset a value to a default** because it looks stale. If a field's
  meaning changed, write a new field and leave the old one alone.
- **Migrations must be idempotent.** They run on load, and a load can happen
  twice. Running one twice must produce the same save as running it once —
  there's a test for exactly this.
- **Every earlier block still runs.** A save that has been on an iPad since v1
  must climb all the way to the current version in one load.
- **Nothing in `save.js` or `log.js` may throw.** A parent losing a record is a
  shame; a child losing a battle to a storage error is not acceptable.

## Every shipped version keeps a fixture

`.verify/save-test.html` holds a `FIXTURES` map: one realistic save blob per
schema version that has ever been deployed (currently v2 and v3). Each is
loaded and checked for gold, XP, gear, owned items, tokens, cards, foils,
worlds, map position, roads already taken, quests, stats, pity counter,
remembered track and mode, and that a half-played stop still resumes into the
road that was there.

- **When you bump `VERSION`, add a fixture for the version you are leaving.**
- **Never edit an old fixture.** Its value is that it is what really shipped.
  If a fixture fails, the migration is wrong — not the fixture.

## Content data is load-bearing too

`localStorage` stores *ids and indices*, not objects. Renaming or reordering
content silently repoints a saved reference at something else:

- **Never change a shop item's `id`, a card's `id`, or a world's id.** They live
  in `inventory.owned`, `inventory.weapon`, `cards`, `unlockedWorlds`.
- **Never remove or reorder a step in `MAP`.** `progress.map` is an index into
  that array — deleting step 4 teleports every hero past it backwards. Append
  to the end, or add a whole new trail. `save-test.html` freezes the first road
  of all 22 steps that shipped before this rule existed and fails if one moves.
- **When a `MAP` step gains a fork, the road that was already there must stay
  option 0.** `activeNode` stores `{ trail, i, o }`, so a stop half-played at
  deploy time resumes as `o: 0` and must land in the same game, track and mode.
  This is why every boss fork's first option is its original stop.
- **A region must have card monsters to draw from.** `rollLoot()` uses
  `cardsOfWorld(region.cards || region.id)`. A region whose id isn't a world
  must name one in `cards`, or a boss chest promises a card and hands over
  nothing — a bug this project has already had once.
- **Anything that picks content *for* a child reads `profile.row`**, never their
  progress. Both trails start at 0, so "which trail are they further along"
  answers `little` for every new hero — which is how the nine-year-old came to
  be set counting practice as his challenge of the day.
- Adding a new track, foe, card, region or shop item is always safe. It's the
  *existing* ones that are frozen.

## Before every deploy

```bash
.verify/venv/bin/python .verify/upgrade.py
```

It checks out **what is currently deployed** into a worktree, plays on it until
it has written a real save — gold, gear, cards, worlds, map progress, a boss
stop left half-played — then opens the **working tree** on top of that save.
Nothing may be lost, and the half-played stop must resume into the same game it
would have before. It exits non-zero and says *do not deploy* if not.

This is the check that matters most: it exercises a save written by the old
code rather than one written by hand. Run it with `run-save-test.py`, which
covers the older versions the fixtures still hold.

It takes a ref, so an older era can be checked too — `upgrade.py 266e2b2` walks
a v2 save all the way up. Worth doing after a migration lands, since the
default (`origin/main`) only ever tests one step.

If the schema moved, also ask the parent to take a backup from **Settings →
Save progress to a file** on each iPad. It costs a tap and it is the only real
undo that exists.

---

# The game

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
  allies.js         the wild-ally arena UI (odds live in save.js)
math/index.html
language/index.html + record.html (Voice Studio) + voice.js (generated clips)
story/index.html
.verify/            the test harness — see "Testing"
```

Shared files load with plain `<script src>` and `<link>`, so there is still
no build step and the games still open straight from `file://`.

## The map

A landscape the hero walks, not a menu. The trail climbs through seven regions,
each with its own sky, hills and scenery, and the hero token slides along the
path when a stop is beaten — that walk is the moment the screen exists for.

**Two trails, deliberately.** The five-year-old and the eight-year-old play
genuinely different content, so a single path would strand the younger one at
the first Algebra stop. `MAP.little` and `MAP.big` are 80 steps each, with
independent progress per profile.

**New ground is appended, never inserted.** `progress.map` is an *index* into
the trail, so removing or reordering a step teleports every hero standing past
it. `save-test.html` freezes the first road of every step that has shipped and
fails if one moves. The trail now runs nine
regions past Ember Peak, all added this way — Market Town and The Observatory
first, to give the everyday-maths, fractions and blending tracks a home, then
Whispering Woods, The Clockwork Mill, Frostfall, The Drowned Library, Thunder
Plateau, The Deep Hollow, The Glass Desert, The Long Night and The Star Road.

**A region draws its chests from a world.** `rollLoot()` looks up
`cardsOfWorld(region.cards || region.id)`, so a region whose id isn't a world
must name one in `cards` — otherwise a boss chest promises a card and hands
over nothing, which is exactly what happened the first time the two drifted
apart. Market Town and The Observatory used to borrow the Reef's and the Peak's
this way, which meant a boss chest there paid out a card the hero had held for
weeks; they have their own lineups now, and `save-test.html` fails if a region
that *is* a world goes back to borrowing (`borrows reef`).

**The far trail has no shop behind it.** Everything past The Observatory is a
world in its own right but carries no `world-*` shop item —
the ladder tops out at The Observatory. You meet their monsters by walking into
them, which is exactly what the rule below makes possible. `content.py` checks a
world is reachable *somehow*: buyable, or the home region of a stretch of map.

**A map stop fights the monsters that live there.** `foesFor()` reads the armed
`activeNode`'s region and draws that world's lineup; only free play uses the
world you bought and chose. It used to be `progress.world` either way, which
made the map's places cosmetic — Ember Peak full of Meadow slimes if the Meadow
was all you owned, or Emberwyrms in the opening fields if you'd bought the Peak.
It also meant a region could never have monsters of its own without a shop world
to match, and that ladder cannot be climbed nine more times. Bosses are
unaffected: they name their own `foe`. The gold multiplier still follows
`progress.world`, not the region — worth revisiting, but changing both at once
moves the economy twice.

**A step is one stop or a choice of two.** A fork always rejoins, so no route
is a dead end and nothing is missable — the branch exists to make the journey
yours, not to punish a wrong turn. Beating either option advances the step;
the road not taken is drawn faded. Which route was taken is remembered in
`progress.mapPicks`.

```
    ●───●───┬─●─┬───●───◆        ◆ boss
            └─●─┘
```

**Bosses** fight one named monster with 8–15 hearts instead of the usual
lineup (`boss: true` plus a `foe`), get a bigger red node, and always drop a
card. Story stops are never bosses — there's nothing to fight. Every boss is
also a fork with one road marked as its weakness — see below.

**Every stop pays a chest**, revealed on the map when the hero arrives rather
than on a win screen. That's deliberate: the reward lands where the progress
is visible, which is the reason to walk back and look. Boss chests pay more
and always hold a card, so they're also the most reliable way to finish a set.
The game stashes the loot in `sessionStorage` and the hub's `resumeFromMap()`
picks it up.

Tapping a stop calls `Save.startNode()`, opens that game, and the game locks
itself to the stop's track and mode (skipping its menu). Winning calls
`Save.completeNode()`, which advances once — replaying a beaten stop doesn't
double-advance — records the route, remembers where to walk the hero from, and
rolls the chest. Some stops carry `needs: '<world>'` and stay shut until that
world is bought.

**Free play is not gated by the map.** Starting from a game's own menu clears
any armed stop. A kid who wants to drill times tables today just can.

**Geometry is computed, never stored.** Each step gets a point on a sine that
oscillates across the board while climbing, so the trail winds itself; a fork
puts its options either side and the path splits and rejoins around them.
Adding a stop is a one-line change to `MAP` with nothing to re-position.

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

Five to seven tiers per slot, each roughly 3× the last, so something is always
affordable soon and something is always a long way off. Bought on the hub,
applied at the start of the next run via `Save.loadout()`:

- **Weapons** — crit chance, and the top tiers raise double-hit damage. The
  equipped weapon is also the slash effect you see.
- **Armor** — up to +5 hearts.
- **Pets** — a companion in the arena, plus a passive (thinking time, or
  blocked hits per run).
- **Trinkets** — the fourth slot, with effects that never touch damage: gold
  bonus, card luck, a wider DOUBLE window.
- **Helms** — the DOUBLE window is the helm's identity, so it pays a child who
  is quick rather than one who is lucky. A heart or two at the top, in ones, so
  helm and armor together top out at twelve pips rather than running away.
- **Boots** — the gentlest ladder of the six: thinking time and a small cut of
  the gold. It's the slot you fill once you've bought the thing you wanted.
- **Worlds** — sixteen in total, each a new foe lineup, a new card set, and a
  better gold multiplier.
- **🎟️ iPad Time Token** — see below.

**The two later slots add, they don't replace.** `loadout()` reads helm and
boots *after* the original four and `+=` their contributions, so a helm and a
trinket that both widen the DOUBLE window stack. `save-test.html` asserts this
against the item table rather than a typed number — making the helm assign
instead of add fails with `got 900`, the helm's value alone.

**The top tier of every slot needs a completed card set** (`set: '<world>'` in
`SHOP`), so the best gear is a collection problem rather than just a big
number. `buy()` returns `'noset'` for those until the set is held. `content.py`
checks this **per slot**, not against a fixed list of four — adding a slot whose
dearest item is gold-only fails with `gold alone buys the best ['helm']`.

**Keep the buffs mild.** Owning something that grows is the point; making the
math easy is not.

## Monster cards

158 cards: every foe across sixteen worlds and both battle games, plus one per
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

## Which kid is this? (`profile.row`)

The two boys play genuinely different content, and this is the one thing the
site cannot work out for itself. A hero carries `row: 'little' | 'big'`, asked
on the New Hero screen and changeable in **Settings → This hero**.

It decides **which map trail they land on** and **which trail their challenge
of the day is drawn from** (`Save.heroTrail()`).

**Why it can't be inferred.** It used to be: `mapAt('big') > mapAt('little')`.
Both trails start at 0, and 0 is not greater than 0 — so *every new hero* read
as "little", and the nine-year-old was handed counting to 30 as his challenge
of the day. A save-test reproduces this exactly if `heroTrail()` is reverted.

**Saves written before v4** are read off the road behind them by `guessRow()`:
whichever trail they are further along, else whichever menu their last chosen
track belongs to (the two menus share no track ids), else `little` — easy work
handed to a big kid is a shrug, hard work handed to a five-year-old is a wall.
Nobody is stopped on the way to a game to answer a question, and the answer is
shown on the hero picker and in Settings so a wrong guess is one tap to fix.

**Switching costs nothing.** The two trails have always kept separate progress,
so a hero can move between them and lose neither.

Note this is *not* a content gate: both menus stay fully open to both kids, and
free play is never restricted. A five-year-old who wants to poke at fractions
still can.

## Today's challenge, and a streak that can't hurt

One challenge a day, the same one all day, worth **double gold**
(`ECONOMY.dailyGold`). It's drawn from **that hero's own trail** (see
`profile.row` above) — deterministically, from the date and the hero's id — so
it can only ever be work they've already met, and there's no second registry of
tracks to keep in step with the games. The two brothers are set different work
on the same day.

- **It's free play of a stop's content, not the stop.** The map stays the map;
  the challenge just picks the track and difficulty and doubles the payout.
  `?daily=1` on either battle game is the deep link.
- **Battle games only.** A Story Quest stop has no difficulty to name and pays
  a fixed amount, so doubling it means little.
- **`ECONOMY.dailyReach`** caps how far past their furthest stop it may draw
  from — gentle early, wider as they get on.
- It's claimed when it's **beaten**, not when it's started.

**The streak grants nothing, so it can take nothing away.** It's a flame and a
number. A missed day steps it back by **one**, never to zero, however long the
gap — a child who was ill for a week should not be shown what they lost. This
was the risk flagged when the feature was chosen, and it's why the streak has
no reward attached: the daily's double gold is the reason to come back, and the
flame is just nice to look at. `save-test.html` asserts that breaking a streak
costs no gold and no XP.

## Boss weaknesses

Every boss stop is a **fork**, and one road is marked `weak` — the track that
boss can't stand. Take it and every hit lands `ECONOMY.weaknessDamage` extra;
take the other and the fight is honest but longer. Both roads fight the same
boss for the same chest, so it's "on its terms or on mine", never a wrong turn.

- **The weakness is announced**, on the signpost and with a 🎯 on the stop. A
  secret a child can't deduce is a dice roll, not a decision.
- The weak road is usually the **harder subject**, which is the point: the
  reward is aimed at the track they'd otherwise dodge.
- **Option 0 of every boss fork is the stop as it was before forking.** Saves
  store `activeNode` as `{ trail, i, o }`, so a boss half-played at deploy time
  resumes as `o: 0` and has to land in the same game. `save-test.html` enforces
  this.

## Pets grow up

A pet is the one thing you own that isn't finished when you buy it. It counts
the monsters it has seen fall (`inventory.petXp`, keyed by pet id) and grows
through **three forms**, changing emoji and name and deepening its passive.

- `ECONOMY.petGrowth` sets the thresholds — a few days to the second form, a
  couple of weeks to the last, at the pace the kids play.
- **Growth scales the pet you have** (`petStageTimeScale`) rather than adding a
  flat bonus, so raising a 200-gold chick can't out-perform an 8,000-gold
  griffin. A pet with no shield never grows one; the last form only deepens a
  shield it already had. `save-test.html` asserts a grown starter never beats a
  better pet on every stat at once.
- XP is **per pet id**, so putting one away and bringing it back keeps what it
  earned. Swapping is not punished.
- It's the only reward that comes from turning up rather than from gold or
  luck, which is exactly why it exists.

## Wild allies

A monster you beat sometimes decides it likes you and fights at your side for
the rest of the run, standing beside the hero and swinging alongside your hits.

- **Knowing it makes it likelier.** Base 18%, plus 22% if you already hold that
  monster's card. Collecting a monster is befriending it — which is the point,
  and gives the card collection a payoff *during* a fight rather than only at
  the trader.
- **Up to three**, each with a 25% chance to add a point of damage on every hit
  of yours. A full party averages +0.75 a hit: it helps, it never wins the
  fight for you. `save-test.html` checks that expected value against the
  tuning, so a tweak can't quietly make allies do the work.
- **They last the run and no longer.** Nothing permanent means no power creep,
  and every run gets its own shape.

Odds and damage live in `ECONOMY` in `shared/save.js` (`rollAlly`,
`allyStrikes`) so both battle games tune from one place; `shared/allies.js` is
only the arena UI. An ally arrives **between monsters**, never over a live
question, for the same reason reward banners queue.

The party is one flex row (`.party`) with the shop pet as its permanent first
member, positioned in the empty middle of the arena rather than at the hero's
feet — a party of four grows into the hero if it starts against the left edge.

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
5. Name the rule, or jump ahead to the Nth number

Rung 5 is the point of the whole track: it stops asking *what's the next
number* and starts asking *what's the rule*.

**The jump-ahead question keeps its arithmetic out of the way.** It exists to
teach that you needn't list every term to know one — and that idea drowns if
the sum is hard. `8, 17, 26, 35 … the 10th?` is 8 + 9×9 in your head, which is
a mental-multiplication test wearing a sequencing costume. So the sequence is
usually the multiples of its step, making the answer a times-table fact he is
already drilling next door (`7, 14, 21, 28 … the 8th` is just 7 × 8); when
there is an offset, the step is 2, 5 or 10 and the target position stays near.
`tracks.py` enforces both, and that most of them stay times-table shaped.

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

## Big hero quests (12 quests · 129 scenes · 65 chests)

🌉 The Troll Bridge · 🐉 The Dragon's Library · 👻 The Ghost Ship ·
🧙 The Wizard's Maze · 🤖 The Robot Bakery · 🧊 The Yeti's Birthday ·
🚀 The Moon Rescue · 🌋 The Grumbly Volcano · 🗼 The Lighthouse Keeper ·
🚂 The Midnight Train · 🏛️ The Museum at Night · 🌱 The Seed Vault

When adding quests, pick settings and rule-mechanics these don't already use.

Data shape: `QUESTS` is `{ emoji, title, sub, scenes }`, each scene
`{ art, text, choices: [{ t, ok } | { t, oops }], chest? }`, each chest
`{ q, a: [3 strings], right }`.

- **Exactly one choice per scene has `ok: true`**, and the scene text must
  contain what makes it right — a stated rule, a detail, or two clues to
  combine. Never guessable only by genre convention, and never a trick.
- Wrong choices carry a 1–2 sentence `oops`: funny, gentle, never scary. The
  tone is "the story pushes back", not "you failed".
- **Quest cards are positional.** `STORY_CARDS[state.questIdx]` binds a quest to
  its card, so a new quest's card goes *before* `s-order`, never at the end.
  `content.py` checks the mapping itself now, not just the array lengths — a
  card appended after the mini pair fails with *"The Lighthouse Keeper would
  award s-order, a mini game's card"*. The old length check passed that
  happily, which is what made it worth replacing.
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

| Mode | Math | Language |
|---|---|---|
| Easy | 50s | 70s |
| Normal | 35s | 48s |
| Expert | 20s | 26s |

Per-mode timing lives in `MODES` (`total`, `fast`, `penalty`). **Math's are in
milliseconds and Language's in seconds** — watch that when copying values
between them.

These are generous on purpose. The timer exists to reward quick recall, not to
rush a child who is working something out — and on the number-block tracks he
is physically counting, which takes as long as it takes.

`content.py` enforces the ladder: each mode must be a real step down from the
last (at least 15%), Normal must leave at least 30 seconds, and even Expert at
least 15. This exists because Easy was once 15s and Normal 14s — two modes that
felt identical, with Expert falling off a cliff after them.

## Time per track

The mode is only the baseline. **A question is not a question**: recalling 7×8
is a different act from working out what rule turns 1, 2, 4, 5, 7, 8 into the
next number, and both are different from reading a sentence to find its one
wrong word. `TRACK_TIME` in each battle game scales the clock by how much
*thinking* a track asks for, where 1 is the recall baseline.

| | Normal, seconds |
|---|---|
| Math: times tables, counting | 35 |
| Math: number blocks (add/sub/count on) | 49 |
| Math: skip counting, patterns, sorting | 52 |
| Math: algebra | 63 |
| Math: **Rule Hunter** | 77 → 123 by rung |
| Language: tap-one-card tracks | 48 |
| Language: word building | 67 |
| Language: read-a-sentence tracks | 72–77 |

Rule Hunter scales again by rung (`RULE_TIER_TIME`) — rung 5 asks for the 10th
number in a sequence, which is arithmetic you have to plan.

**`timing()` is the single place the clock is worked out**, in both games.
`startTimer()` draws the bar from it and `isFastAnswer()` judges the double-hit
from it. They used to compute the fast zone separately, which is exactly how
the white marker ends up disagreeing with the window it claims to mark.

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

# Rewards never cover a question

Level-ups and card drops are full-screen banners. They used to fire the
instant they were earned, which meant landing on top of a question the child
was still reading.

They're **held** instead. `Hud.queue()` collects them and `Hud.flush(done)`
releases them one at a time at a moment when there's nothing to cover:
between monsters, and on the end screens. The next monster waits for the queue
to drain. While something is held, the hero chip shows a 🎁 badge with a count,
so the wait is part of the anticipation rather than a loss.

Small feedback stays immediate — the `+4 🪙` float is a corner wisp and never
covers anything.

**If you add a new banner, queue it.** `.verify/playthrough.py` watches for an
overlay appearing while a question is on screen and the game isn't busy, and
fails if it ever happens. It also asserts a banner *did* appear during the run,
so the check can't pass by never triggering.

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

**The topbar keeps clear of the two floating corners by measuring, not
guessing.** The hero chip's width depends on the hero's name and how much gold
is in it, so `shared/hud.js` measures itself and publishes `--hud-w`, which
`.topbar` reserves. This was a hardcoded 172px until the economy grew to five
figures, the chip grew with it, and it started sitting on top of the hearts.
Armor can also reach ten hearts, so a pip row past seven shrinks (`.pips.many`)
rather than colliding with the foe.

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
- **Nothing is ever taken away.** No gold lost for a miss, no streak reset to
  zero, no content locked as punishment. Difficulty comes from the questions,
  never from spite.
- **The parent is a real second user.** Settings → Progress report exists for
  them; keep it honest and readable.
- **Ship deliberately.** The audience is two children who will be playing
  within the hour of a push.

# Technical approach

Plain HTML, CSS, and JavaScript. No build step, no server, no frameworks, no
external dependencies. Everything runs by opening a file or serving the folder
statically. Keep it that way.

Concretely, that means: no bundler, no CDN, no `fetch` of anything. Shared code
loads through plain `<script src>` and `<link>`; every sound is synthesized at
runtime; recorded voice ships as base64 data URIs inside `voice.js`; emoji are
the art. Opening `index.html` from `file://` must behave exactly as the
deployed site does — that's the fallback for when the network or Pages is
having a day.

---

# Testing

No test framework — the harness drives the real pages in headless Firefox.
Set it up once with `.verify/setup.sh` (creates the venv, downloads
geckodriver), then:

| Script | Run it when | ~ |
|---|---|---|
| `smoke.py` | after any change | 1 min |
| `run-save-test.py` | after touching `save.js` / `log.js` (397 + 65 assertions) | 10 s |
| `tracks.py` | after touching a question generator | 1 min |
| `content.py` | after touching content, prices, card odds, or the hub's claims | 30 s |
| `playthrough.py` | before shipping | 3 min |
| `upgrade.py` | **before every deploy** — see "Never lose a child's progress" | 40 s |
| `shots.py [w h]` | when something new is drawn | 2 min |

`content.py` simulates the economy and the drop rates and fails if either
drifts out of the intended range — it's what stops the best gear quietly
becoming a week's work again. It also holds the hub to its own claims: the
"19 tracks" on the game cards is checked against the registries, because that
number silently drifted to being wrong by twelve once already.

New drawing code gets a **screenshot looked at**, not just a passing assertion.
The clock face, fraction bars, number blocks and the map landscape all needed
real review at iPad size, and two of them shipped looking wrong despite green
tests.

## A test that can't fail isn't a test

When you add one, **make it fail first** — break the thing on purpose, watch the
assertion fire with the wrong value in its message, then put it back. Several
checks here have caught real regressions precisely because they were proved to
bite: reverting `heroTrail()` reports the actual wrong answer it used to give
("Find the letter"), and a migration that resets map progress fails
`upgrade.py` with *do not deploy*.

Prefer asserting against **the tuning, or against the old build**, rather than a
number typed into the test. `Save.ECONOMY.weaknessDamage`, not `1`. What the
deployed build said the armed stop was, not a hardcoded `math/rule/normal`.

## How the harness sees inside the games

Each game assigns `window.TEST` on the last line of its script (state, the
current answer, the foe lineup, the track registry). It costs nothing in play,
and doubles as a **boot check**: if `window.TEST` is missing, the script threw
on its way down. A throw *during parse* leaves no error for a `window.onerror`
trap installed after load, so "no JS errors" alone would report a completely
broken page as fine.

## The trap that has bitten five times

`arguments[0]` inside a callback passed to `execute_script` refers to **the
callback's own arguments**, not the outer value. This is wrong, and fails
silently rather than erroring:

```js
d.execute_script("Save.update(function (p) { p.progress.seqTier = arguments[0]; });", 3)
d.execute_script("return Log.due('math').filter(function (o) { return o.q === arguments[0]; })[0];", q)
```

Hoist it first, every time:

```js
d.execute_script("var tier = arguments[0];"
                 "Save.update(function (p) { p.progress.seqTier = tier; });", 3)
```

## Other harness notes

- Headless Firefox stops advancing the CSS animation clock after a window
  resize, which pins pop-in animations at their first frame. `shots.py`
  disables animations, which is what a screenshot suite wants anyway.
- Firefox's driver refuses to click an element inside a scrolling container it
  can't scroll into view by its own rules; the `click()` helpers scroll the
  container themselves and fall back to a scripted click.
- Selenium's `.text` returns `""` for an element mid-fade — read `textContent`
  via JS instead.
- Python's `round()` is banker's rounding and the game's JS is half-up. A test
  once called the game wrong over 805 → 800.

# Hosting

GitHub Pages, published by `.github/workflows/pages.yml` on every push to
`main` (repo Pages settings: Source = "GitHub Actions"). There is no build
step — the same files that run from `file://` are what get served.

- Repo: https://github.com/carrickhines/learninggames
- Live: https://carrickhines.github.io/learninggames/

**Pushing to `main` is the deploy.** There is no staging environment and the
audience is two children who will be playing within the hour. Run
`.verify/upgrade.py` first, push, then `gh run list` to confirm the build went
green — and then curl the live URL, because a green Action is not proof the
page loads.

The three original repos (`mathrpg`, `languagerpg`, `storyquest`) hold the
history of how each game was built. They're still live and unchanged; once
this site is confirmed working on the kids' iPads, each gets a one-line
meta-refresh redirect here so the old bookmarks keep working. **Ask before
doing that** — a kid with an old bookmark and progress saved under the old
origin would lose it.

## Commit messages

Prose, not a bullet list of file changes: what changed, **why**, what was
considered and rejected, and what was verified. If a test caught something
during the work, say so — that's the part worth keeping.

Backticks in a commit message written inline get shell-expanded and silently
eat words. Use `git commit -F -` with a quoted heredoc.

---

# Deliberate limitations — don't "fix" these

- **The iPad reward timer only runs in the foreground.** iOS freezes JS timers
  and Web Audio in backgrounded tabs, and a page cannot bring itself forward —
  there is no API for it, and no Vibration API on iOS. The reward screen tells
  the kid to ask Siri instead. Notifications/PWA push do not solve it and would
  break the single-file `file://` design.
- **The Rematch is maths-only.** A question answered by tapping one of three
  pictures can't be reconstructed from a log line, so those record no answer
  and never come back. Language RPG is almost entirely tap-based; a language
  Rematch needs its answer UI rebuilt from the record, which is a bigger job
  than it looks.
- **No speech-to-text, ever.** The game never listens to the child. Reading
  aloud stays a parent-at-bedtime activity by design.
- **The streak grants nothing**, so it can take nothing away. Don't attach a
  reward to it — the daily's double gold is the reason to come back.
- **`profile.row` is not a content gate.** Both menus stay fully open to both
  kids and free play is never restricted; it only decides what the site picks
  *for* them.

---

# Where the project stands

Round 4 shipped and is live (schema **v4**, `57a1acc`). It added seven tracks
(Make 10, Coins, Clock, Sound It Out, Fractions, Word Problems, Big Numbers,
Everyday Maths), The Rematch, wild allies, boss weaknesses, pets that grow, the
daily challenge and streak, two new map regions, and `profile.row`.

Current shape: **19 maths tracks, 15 language tracks, 12 quests + 2 mini games,
80 map steps per trail through 16 regions, 16 worlds, 158 cards, 6 gear
slots.** Suite: 472 save checks, 65 log checks, plus smoke / tracks / content /
playthrough / upgrade.

**Outstanding, in rough priority order:**

1. **The three old repos are still live and unredirected** —
   `carrickhines.github.io/{mathrpg,languagerpg,storyquest}` all return 200.
   Waiting on confirmation that the new site works on the kids' iPads. See
   "Hosting" above; ask before doing it.
2. **Two language tracks still fall back to robot TTS.** `P_startsound` and
   `P_opposite` (plus their word clips) are not in `voice.js` and need
   recording in `record.html`, on the device the kids play on. mp4/AAC records
   and plays everywhere; Chrome-recorded webm may not play on iPads.
4. **Watch the maths menu.** Nineteen tracks is a lot for a six-year-old even
   grouped; worth checking with the kids before adding more.

**Tuning knobs**, all in `ECONOMY` in `shared/save.js`: `dailyGold`,
`dailyReach`, `weaknessDamage`, `allyJoinChance` / `allyKnownBonus` /
`allyStrikeChance` / `maxAllies`, `petGrowth` / `petStageTimeScale` /
`petStageShield`, the card odds and the pity counter, and the whole gear ladder.
`RETIRE` (3, how many corrects retire a Rematch question) lives in
`shared/log.js`.
