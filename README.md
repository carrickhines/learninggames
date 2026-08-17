# Learning Games

Three browser games for two kids, sharing one hero.

**▶ Play: https://carrickhines.github.io/learninggames/**

- **🔢 Math RPG** — counting, adding, times tables, algebra, pattern-finding
- **🔤 Language RPG** — letters, spelling, grammar, word play
- **📖 Story Quest** — reading comprehension as an adventure

Pick a hero on the hub and every game feeds the same character. There's a
**map** — a 32-stop winding trail through seven regions that opens as you beat
it, one trail for each kid, with boss fights that tell you what they fear. Right answers earn gold and XP; gold buys swords, armor, pets, trinkets,
new worlds to fight in, and iPad game time, priced so the best gear takes
months. Beaten monsters rarely drop a collectible card, sometimes shiny;
spares trade at the Card Trader, and finishing a world's set is the only way
to the top tier of each gear slot. Beaten monsters also sometimes **join you**
for the rest of a run and fight at your side — more often if you already hold
their card. Questions you get wrong come back later as a **Rematch**, and
retire once you've had them right three times running. There's a **challenge
of the day** worth double gold, and a streak that steps back by one on a missed
day rather than starting over. All of it persists between sessions, per kid.

**For parents:** Settings → Progress report shows what was played and when,
accuracy per track, and a review list of the questions being missed with what
was answered instead. Exportable as CSV.

## Running it

Open `index.html` in a browser. That's the whole install — no build step, no
server, no dependencies.

## Keeping progress safe

Progress lives in the browser's localStorage, so clearing website data erases
it. **Settings → Save progress to a file** writes a backup you can restore
from later.

## Testing

```sh
.verify/setup.sh                                    # once
.verify/venv/bin/python .verify/smoke.py            # after any change
.verify/venv/bin/python .verify/playthrough.py      # plays every game to its win screen
```

See `CLAUDE.md` for the full harness, the content authoring rules, and how the
pieces fit together.
