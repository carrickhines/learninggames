# Verification harness

No test framework. Every script here drives the **real pages** in headless
Firefox (Selenium + geckodriver, reusing the system browser), so what passes is
what the kids will actually get.

## Setup (once)

```bash
.verify/setup.sh
```

Creates a Python venv with Selenium and downloads the matching `geckodriver`.
Requires Python 3 and network access; reuses whatever `firefox` is on `PATH`.

## The scripts

| Script | What it proves | Runtime |
|---|---|---|
| `smoke.py` | every page loads and its script runs to the end, styles resolve, each game starts and pays for a right answer, the hub / shop / cards / token flows work | ~1 min |
| `run-save-test.py` | runs `save-test.html` and `log-test.html`: profiles, XP→level rollover, buying and refusing, card drops and duplicates, boss weaknesses, pet growth, wild allies, export→wipe→import, a corrupt save, a `localStorage` that throws — **and that every schema version ever shipped still loads with nothing lost** | ~10 s |
| `tracks.py [rounds]` | generates hundreds of problems on every math track and re-derives each answer independently | ~1 min |
| `content.py` | the authoring rules that nothing at runtime can notice being broken — one right answer per question, no decoy that's secretly correct, unique card ids | ~30 s |
| `playthrough.py` | plays every game all the way to its win screen and checks the gold, XP, cards and progress that resulted, then that they survive a reload | ~3 min |
| `upgrade.py [ref]` | plays on the **deployed** build, then opens the working tree on the save it wrote — nothing lost, half-played stops still resume. Defaults to `origin/main` | ~40 s |
| `shots.py [w h]` | screenshots every screen to `shots/` | ~2 min |

Run `smoke.py` after any change. Run `content.py` after touching content and
`tracks.py` after touching a generator. `playthrough.py` before shipping, and
**`upgrade.py` before every deploy** — the kids' saves exist only on their
iPads, so a deploy that loses one cannot be undone.

```bash
.verify/venv/bin/python .verify/smoke.py
.verify/venv/bin/python .verify/shots.py 820 1180   # e.g. an iPad-ish portrait
```

## How they see inside the games

Each game assigns `window.TEST` on the last line of its script, exposing the
state and content the harness needs — the current question and its answer, the
foe lineup, the track registry. The games' own state is script-scoped, so
without this a driver script would have to guess answers by clicking around.

This doubles as a boot check: if `window.TEST` is missing, the script threw on
its way down. That matters because a throw *during parse* leaves no error for a
`window.onerror` trap installed after the page loads, so "no JS errors" alone
would report a completely broken page as fine.

## A trap worth naming

`Save.update(fn)` passes the *profile* to its callback. So this is wrong, and
fails silently by assigning the profile object to the field:

```js
d.execute_script("Save.update(function (p) { p.progress.seqTier = arguments[0]; });", 3)
```

`arguments[0]` inside the callback is `p`, not the value handed to
`execute_script`. Hoist it first:

```js
d.execute_script("var tier = arguments[0];"
                 "Save.update(function (p) { p.progress.seqTier = tier; });", 3)
```

This has bitten three separate checks, each time producing a test that passed
while measuring nothing.

## The save fixtures

`save-test.html` holds a `FIXTURES` map — one real save blob per schema version
that has ever been deployed — and checks each still loads with its gold, gear,
cards, map position and half-played stop intact. **Bumping `VERSION` means
adding a fixture for the version you're leaving, and never editing an old one.**
The kids' saves exist only on their iPads; see `CLAUDE.md`.

## Notes

- `shots.py` corrects for Firefox's window-vs-viewport size mismatch so the app
  gets its full design height (the frame is `min(900px, 96vw) x min(720px, 96vh)`).
- `shots.py` disables CSS animations before capturing. Headless Firefox stops
  advancing the animation clock after a window resize, which otherwise pins
  fade-ins and pop-ins at their first frame — and a screenshot suite wants
  settled states anyway.
- The menus scroll inside `#menu`, not the window, and Firefox's driver refuses
  to click an element it can't scroll into view by its own rules. The `click()`
  helpers scroll the container themselves and fall back to a scripted click.
- Reading a `.png` back is how Claude Code "sees" the result during a session.
- The venv, the geckodriver binary, and `shots/` are git-ignored.
