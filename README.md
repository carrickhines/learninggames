# Learning Games

Three browser games for two kids, sharing one hero.

**▶ Play: https://carrickhines.github.io/learninggames/**

- **🔢 Math RPG** — counting, adding, times tables, algebra, pattern-finding
- **🔤 Language RPG** — letters, spelling, grammar, word play
- **📖 Story Quest** — reading comprehension as an adventure

Pick a hero on the hub and every game feeds the same character: right answers
earn gold and XP, gold buys swords, armor, pets, new worlds to fight in, and
iPad game time. Beaten monsters drop collectible cards. All of it persists
between sessions, per kid.

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
