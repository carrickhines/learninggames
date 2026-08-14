#!/usr/bin/env python3
"""Fast smoke test: every page loads, styles resolve, and the games are playable.

Usage:
    .verify/venv/bin/python .verify/smoke.py

Run this after every phase. It drives the real games in headless Firefox and
asserts on *behavior*, not just on pixels — if the inline script throws, or a
shared CSS/JS file 404s, the assertions below fail loudly.

Exit code is 0 only if every check passes.
"""
import os, sys, time

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

opts = Options()
opts.add_argument("--headless")
opts.add_argument("--width=960")
opts.add_argument("--height=820")
service = Service(executable_path=os.path.join(HERE, "geckodriver"), log_output=os.devnull)
d = webdriver.Firefox(options=opts, service=service)
d.set_window_size(960, 900)

failures = []


def check(label, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + label + (("  -- " + detail) if detail and not ok else ""))
    if not ok:
        failures.append(label)


def load(relpath):
    """Load a page and install an error trap for anything that throws later."""
    d.get("file://" + os.path.join(ROOT, relpath))
    time.sleep(0.8)  # let the fadeIn settle
    d.execute_script(
        "window.__errs = window.__errs || [];"
        "window.addEventListener('error', function (e) { window.__errs.push(String(e.message)); });"
    )


def errs():
    return d.execute_script("return window.__errs || []")


def click(sel):
    d.find_element(By.CSS_SELECTOR, sel).click()


def text(sel):
    return d.find_element(By.CSS_SELECTOR, sel).text.strip()


def exists(sel):
    return len(d.find_elements(By.CSS_SELECTOR, sel)) > 0


def styles_resolved():
    """The #app frame gets its rounded dark panel from the shared stylesheet.
    If the CSS failed to load, the radius is 0px and the page is unstyled."""
    return d.execute_script(
        "var a = document.getElementById('app'); if (!a) return false;"
        "return parseFloat(getComputedStyle(a).borderRadius) > 8;"
    )


def battle_smoke(relpath, track, mode, label):
    """Menu -> pick track -> pick mode -> start -> a question is on screen."""
    load(relpath)
    check(label + ": styles resolved", styles_resolved())
    check(label + ": menu visible", exists("#menu"))
    click('[data-track="%s"]' % track)
    click('[data-mode="%s"]' % mode)
    click("#startBtn")
    time.sleep(1.2)
    playing = d.execute_script(
        "var g = document.getElementById('battle') || document.getElementById('game');"
        "return !!g && g.getBoundingClientRect().height > 100;"
    )
    check(label + ": battle screen is up", playing)
    check(label + ": a foe is on screen", d.execute_script(
        "var s = document.querySelector('.sprite.foe'); return !!s && s.textContent.trim().length > 0;"))
    check(label + ": no JS errors", errs() == [], str(errs()))


try:
    print("\nMath RPG")
    battle_smoke("math/index.html", "mul", "normal", "math/mul")
    battle_smoke("math/index.html", "add", "easy", "math/add")
    check("math/add: number blocks rendered", d.execute_script(
        "return document.querySelectorAll('.tower .block').length > 0;"))

    print("\nLanguage RPG")
    battle_smoke("language/index.html", "letters", "easy", "lang/letters")
    battle_smoke("language/index.html", "fixit", "normal", "lang/fixit")

    print("\nStory Quest")
    load("story/index.html")
    check("story: styles resolved", styles_resolved())
    cards = d.find_elements(By.CSS_SELECTOR, "#menu .choice")
    check("story: quest cards listed", len(cards) >= 8, "found %d" % len(cards))
    cards[0].click()
    click("#startBtn")
    time.sleep(1.0)
    check("story: first scene rendered", len(text(".story-text")) > 20)
    check("story: choices offered", len(d.find_elements(By.CSS_SELECTOR, ".choice-card")) >= 2)
    check("story: no JS errors", errs() == [], str(errs()))
finally:
    d.quit()

print("")
if failures:
    print("%d CHECK(S) FAILED:" % len(failures))
    for f in failures:
        print("  - " + f)
    sys.exit(1)
print("All smoke checks passed.")
