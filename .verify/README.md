# Headless screenshots

Visual verification for `index.html`, run from the terminal — no GUI needed.
It drives the **system Firefox** (already installed) with Selenium + geckodriver,
clicking through the real game so the screenshots reflect actual rendered state.

## Setup (once)

```bash
.verify/setup.sh
```

Creates a Python venv with Selenium and downloads the matching `geckodriver`.
Requires Python 3 and network access; reuses whatever `firefox` is on `PATH`.

## Capture

```bash
.verify/venv/bin/python .verify/shots.py            # default 960x820 viewport
.verify/venv/bin/python .verify/shots.py 820 1180   # e.g. an iPad-ish portrait
```

PNGs land in `.verify/shots/`:

| file                    | screen                                   |
|-------------------------|------------------------------------------|
| `menu.png`              | title / track + difficulty select        |
| `battle-mul.png`        | multiplication battle                    |
| `battle-add.png`        | addition battle with number blocks       |
| `battle-add-merged.png` | blocks after "Push together"             |
| `end-win.png`           | victory screen                           |

The venv, the geckodriver binary, and `shots/` are git-ignored; `shots.py`,
`setup.sh`, and this README are the reusable parts.

## Notes

- `shots.py` corrects for Firefox's window-vs-viewport size mismatch so the app
  gets its full design height (the centered box is `min(900px, 96vw) x
  min(720px, 96vh)`).
- Reading a `.png` back is how Claude Code "sees" the result during a session.
