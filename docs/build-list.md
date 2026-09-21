# Build list

What's agreed to build, and what's still only an idea. Kept here rather than in
a chat window so the next round starts from something written down.

Add to the top section when a thing is chosen. Move it out when it ships and
say so in CLAUDE.md's "Where the project stands" instead.

---

## Agreed

### 1. 🎖️ Deeds — a board of things to go and do

The site has a lot of systems and exactly two goals: walk the map, finish the
card sets. A list of named deeds gives everything already built a reason to be
poked at.

- 30–40 deeds read from data that already exists: *catch your first shiny,
  finish a world's set, reach floor 10, solve a pack with every star, beat a
  boss on its weak road, raise a pet to its last form, walk twenty stops.*
- Each pays a little gold; the good ones pay a **title** shown under the hero's
  name on the chip — *Kraken-Hunter*, *Loopsmith*, *Deep-Walker*.
- Titles cost the economy nothing and are pure bragging, which is the point.

**Why this one:** it is the cheapest thing on the list by a distance — a screen
and a table of conditions, no new game loop — and it makes everything already
built worth more. The nine-year-old was reading his card shelf closely enough
to spot two tiles that looked alike; that is completionist attention with
almost nothing to chew on.

**Watch:** deed rewards are a fifth purse. Keep them small and put them in
`content.py`'s day-of-play model, which now covers all four games.

### 2. 🤖 More Robot Workshop, and harder

**The eldest finished all 48 levels.** The big-hero rungs are only 24 of those,
so the ceiling is too low — the game landed and then ran out.

The current ladder tops out at rung 5 (a slot budget only a loop will fit).
What comes after it, roughly in value-for-effort order:

- **Nested repeats.** A repeat inside a repeat. The interpreter already
  recurses; it is a one-line cap removal plus levels, and it is an immediate
  step up in difficulty.
- **Two robots, one plan.** Both start somewhere different and both must reach
  a flag, running *the same program*. Cheap to implement — run the plan twice
  and require both to win — and conceptually the deepest thing here: a plan
  that works from more than one place is the beginning of abstraction.
- **Cover every tile.** Win by visiting every square rather than reaching a
  flag. A new win condition changes the puzzle's whole genre for very little
  code.
- **A named routine you can call.** Define a small block once, use it twice.
  The classic step after loops; more UI work than the three above.
- **Conditionals** — *if there's a gem, take it; if blocked, turn.* The biggest
  idea and the biggest build. Probably its own round.

Also worth doing regardless: **generated levels for the straight-line rungs.**
Levels are authored because par needs a known optimum — but the harness already
BFSes every level to find that optimum, and the same BFS can run *in the game*
at generation time. Generate a grid, solve it, keep it if it is solvable and the
par lands in range. That is endless content for rungs 1–3 with a par that is
correct by construction. The loop rungs stay authored, because their budget
needs a hand-written looped solution.

### 3. 🛠️ A level editor for the Robot Workshop

The eldest finished all 48 levels. The natural next thing for a child who
finishes a puzzle game is to *make* puzzles — and the site has never once let
them create anything.

- Paint a grid, drop the robot, the flag, the rocks, the gems.
- **The BFS solver already written for `content.py` runs in the game**, so it
  answers "is this solvable?" and "what is par?" on the spot. A level he builds
  validates and scores itself; nothing needs authoring by hand.
- A level is a small grid, so it encodes as a short **share code** he can read
  out to his brother, who types it in and plays it. Sibling play with no server,
  no accounts, and nothing new in the save but a string.

**Why this one:** it is the only idea on any of these lists that turns him from
someone who finishes the content into someone who makes it, and the hard part —
a solver that knows whether a puzzle is fair — is already built and tested.

**Watch:** a shared code is untrusted input. Decode defensively and refuse
anything that does not parse into a legal grid; never let a bad code throw on a
page a child is standing on.

### 4. 🌿 Side spurs off the map

The eldest is well ahead of his brother. A spur puts hard content in front of
him **without touching the difficulty of the line the five-year-old walks**.

Every fork on the map today rejoins — two roads, same next stop, nothing
missable. A spur is a different shape: it hangs off the trail, runs two or
three stops well above the local difficulty, ends in a good chest, and does
not reconnect. You walk back to where you left the line.

This does not break the no-dead-ends rule, which exists so a **wrong turn
cannot cost you**. There is no wrong turn on a spur: it is visibly optional,
skipping it costs only the chest, and it is still there next week.

**The data model is the real work, and the nicer half of the idea.**
`progress.map` is an *index* into a flat list, which is exactly why the main
trail is frozen forever and stops can only be appended. A spur is not on that
line, so it tracks completed side-stops **by id** in a set instead — meaning
side content can be added, reordered or retired later without teleporting
anybody, in a way the main trail never can.

---

## Ideas, not yet chosen

- **⚔️ The Duel.** Hot-seat, two heroes on one arena, alternating turns, each
  kid's questions drawn from **their own row** so a five-year-old and a
  nine-year-old are genuinely matched. Reuses the battle engine nearly whole.
  The one feature that uses the fact that there are two of them. Needs both
  boys in the same room, so it is an evening event, not a daily loop.
- **🏪 A merchant and a forge underground.** You currently descend to *get*
  gold with nothing to spend it on until you climb out. One random thing per
  floor at a markup makes the purse in your pocket matter mid-run. **Touches
  the economy**, and a descent already pays ~2.3x a battle run.
- **🌗 A week that changes.** Date-seeded, no server: this week Frostfall drops
  double cards, next week bosses pay triple. One line on the hub. Reuses the
  day-seeding the daily challenge already does.
- **👨‍👩‍👦 A challenge set by a grown-up.** The parent picks a goal from the
  progress report — *beat three stops today* — and the kid sees it on the hub
  with whatever real-world reward was promised. The parent is already a real
  second user; this is the only idea that lets them put something *into* the
  game.
- **🃏 The Card Arena.** Deck-build from the 170 cards; questions pay the energy
  you spend playing them. The biggest retention pull, and the deepest build.
- **🏠 A trophy room.** Somewhere the hero lives, with the cards, gear and pets
  on display. Ownership made visible.

---

## Open questions

- **Is the nine-year-old outgrowing the rest of it too?** He cleared 24 robot
  levels quickly. Multiplication tops out at 12×12 and only ~30% of Algebra is
  two-step. Worth watching whether the big-hero *maths and language* tracks need
  a harder tier, not just the Workshop.
- **A descent pays ~2.3x a battle run** (`content.py` measures it). Nobody chose
  that number. Is the dungeon *meant* to be the best-paying half hour?
- **The Workshop is not on the map or in the daily.** Deferred on purpose —
  both trails are 80 steps and the kids are months from that ground. Tidiness,
  not excitement.
