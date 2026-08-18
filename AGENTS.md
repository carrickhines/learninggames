# Working on this repo

Design notes, content rules and the verification harness live in
[`CLAUDE.md`](CLAUDE.md). This file is the short list of things that must hold
for *any* change, by anyone.

---

## 1. Never lose a child's progress

**This is the one rule that outranks the others.**

Two kids play the deployed site on their iPads. Everything they have — gold,
gear, cards, map position, the pet they raised, months of it — lives in that
iPad's `localStorage` and **nowhere else**. There is no server, no account, no
backup we control. Pushing to `main` replaces the code underneath a save that
already exists. A save destroyed is a destroyed month, and to a seven-year-old
it is not recoverable by explaining what a schema is.

So:

### The storage keys are permanent

`lg_save_v1` (the hero) and `lg_log_v1` (the parent record). **Never rename
them, never namespace them, never "clean them up".** The `v1` in the key is
historical; the real schema version is the `v` field *inside* the blob. Renaming
a key is indistinguishable from wiping the save.

### Schema changes go through `migrate()`, and only ever add

When a change needs a new field, bump `VERSION` in `shared/save.js` and add a
`if (v < N)` block. Inside it:

- **Add missing fields; never remove, rename or re-key an existing one.**
  Old data you no longer read costs a few bytes and is free insurance.
- **Never reset a value to a default** because it looks stale. If a field's
  meaning changed, write a new field and leave the old one alone.
- **Migrations must be idempotent.** They run on load, and a load can happen
  twice. Running one twice must produce the same save as running it once —
  there's a test for exactly this.
- **Every earlier block still runs.** A save that has been on an iPad since v1
  must climb all the way to the current version in one load.

### Every shipped version keeps a fixture

`.verify/save-test.html` holds a `FIXTURES` map: one realistic save blob per
schema version that has ever been deployed. Each one is loaded and checked for
gold, XP, gear, owned items, tokens, cards, foils, worlds, map position, roads
already taken, quests, stats, pity counter, remembered track and mode, and that
a half-played stop still resumes into the same game.

- **When you bump `VERSION`, add a fixture for the version you are leaving.**
- **Never edit an old fixture.** Its value is that it is what really shipped.
  If a fixture fails, the migration is wrong — not the fixture.
- Prove a new fixture isn't vacuous: break the migration on purpose, watch the
  test fail, put it back. A green test that would stay green is worse than none.

### Content data is load-bearing too

`localStorage` stores *ids and indices*, not objects. So renaming or reordering
content silently repoints a saved reference at something else:

- **Never change a shop item's `id`, a card's `id`, or a world's id.** They are
  in `inventory.owned`, `inventory.weapon`, `cards`, `unlockedWorlds`.
- **Never remove or reorder a step in `MAP`.** `progress.map` is an index into
  that array — deleting step 4 teleports every hero past it backwards. Append
  to the end, or add a whole new trail.
- **When a `MAP` step gains a fork, the road that was already there must stay
  option 0.** `activeNode` stores `{ trail, i, o }`, so a stop half-played at
  deploy time resumes as `o: 0` and must land in the same game, track and mode.
  This is why every boss fork's first option is its original stop.
- Adding a new track, foe, card, region or shop item is always safe. It's the
  *existing* ones that are frozen.
- **Anything that has to pick content for a child reads `profile.row`**, never
  their progress. Both trails start at 0, so "which trail are they further
  along" answers `little` for every new hero — which is how the nine-year-old
  came to be set counting practice as his challenge of the day.

### Before every deploy

```bash
.verify/venv/bin/python .verify/upgrade.py
```

`.verify/upgrade.py` checks out **what is currently deployed**, plays on it
until it has written a real save — gold, gear, cards, worlds, map progress, a
boss stop left half-played — and then opens the **working tree** on top of that
save. Nothing may be lost, and the half-played stop must resume into the same
game it would have before. It exits non-zero and says *do not deploy* if not.

This is the check that matters most, because it exercises a save written by the
old code rather than one written by hand. Run it together with
`run-save-test.py`, which covers the older versions the fixtures still hold.

If the schema moved, also ask the parent to take a backup from **Settings →
Save progress to a file** on each iPad. It costs a tap and it is the only real
undo that exists.

---

## 2. It has to keep running from a file

No build step, no bundler, no dependencies, no `fetch` of anything. Shared code
loads through plain `<script src>` and `<link>`. Opening `index.html` from
`file://` must work exactly as the deployed site does — that's the fallback when
the network or Pages is having a day.

## 3. Nothing user-facing ships unverified

`.verify/` drives the real pages in headless Firefox. After a change run
`smoke.py`; after touching a generator run `tracks.py`; after touching content
run `content.py`; before shipping run `playthrough.py`. New drawing code gets a
screenshot looked at, not just a passing assertion.

A test that can't fail isn't a test. When you add one, make it fail first.

## 4. Pushing to `main` is the deploy

GitHub Pages serves `main` through `.github/workflows/pages.yml`. There is no
staging environment and the audience is two children who will be playing within
the hour. Merge deliberately.
