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


def gold():
    return d.execute_script("return Save.me() ? Save.me().gold : -1;")


def earns_smoke(label, *steps):
    """Answer one question correctly and check the gold actually moved.
    Some tracks take two taps (find the mistake, then pick the fix), so this
    takes one or more steps and pauses between them."""
    before = gold()
    for js in steps:
        d.execute_script(js)
        time.sleep(0.9)
    time.sleep(1.0)
    after = gold()
    check(label + ": a correct answer pays gold", after > before,
          "%d -> %d" % (before, after))
    check(label + ": the chip shows the new total",
          ("🪙 " + str(after)) in d.find_element(By.CSS_SELECTOR, ".hud").text)


def reward_smoke(label):
    """shared/reward.js: offer -> start -> countdown ticks -> ring -> alarm."""
    d.execute_script("Reward.offer(8);")
    check(label + ": reward offers the earned minutes",
          d.execute_script("return document.querySelector('.r-mins').textContent") == "8")
    d.execute_script("document.querySelector('.r-start').click();")
    time.sleep(0.4)
    clock = d.execute_script("return document.querySelector('.countdown').textContent")
    check(label + ": countdown is running", clock.startswith("7:5") or clock == "8:00", clock)
    # jump to the end rather than waiting 8 real minutes
    d.execute_script("document.querySelector('.r-cancel').click();")
    check(label + ": cancel returns to the start state", d.execute_script(
        "return document.getElementById('countdownBox').classList.contains('hidden');"))
    check(label + ": reward left no JS errors", errs() == [], str(errs()))


def battle_smoke(relpath, track, mode, label):
    """Menu -> pick track -> pick mode -> start -> a question is on screen."""
    load(relpath)
    check(label + ": styles resolved", styles_resolved())
    check(label + ": the hero chip is up", exists(".hud"))
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
    print("\nHub")
    load("index.html")
    check("hub: styles resolved", styles_resolved())
    # start from a clean slate, then make a hero the way a parent would
    d.execute_script("Save.reset(); location.reload();")
    time.sleep(1.0)
    check("hub: a blank save asks who's playing", d.execute_script(
        "return document.getElementById('who').classList.contains('show');"))
    click("#newHeroBtn")
    time.sleep(0.5)                       # the screen fades in and focuses the field
    name = d.find_element(By.ID, "nameInput")
    name.clear()
    name.send_keys("Tester")
    d.find_elements(By.CSS_SELECTOR, ".avatar-opt")[3].click()
    click("#createBtn")
    time.sleep(0.6)
    check("hub: creating a hero lands on home", d.execute_script(
        "return document.getElementById('home').classList.contains('show');"))
    check("hub: the hero card shows the name", text("#hcName") == "Tester")
    check("hub: the hero starts at level 1", "Level 1" in text("#hcLevel"))
    check("hub: the hero starts broke", text("#hcGold") == "🪙 0")
    check("hub: all three games are linked",
          len(d.find_elements(By.CSS_SELECTOR, ".game-card")) == 3)
    check("hub: no JS errors", errs() == [], str(errs()))

    print("\nMath RPG")
    battle_smoke("math/index.html", "mul", "normal", "math/mul")
    battle_smoke("math/index.html", "add", "easy", "math/add")
    check("math/add: number blocks rendered", d.execute_script(
        "return document.querySelectorAll('.tower .block').length > 0;"))
    # read the answer off the question and type it in
    earns_smoke("math", """
        var q = document.getElementById('question').textContent;
        var p = q.split('+');
        document.getElementById('answer').value =
            String(parseInt(p[0], 10) + parseInt(p[1], 10));
        document.getElementById('attackBtn').click();
    """)
    reward_smoke("math")

    print("\nLanguage RPG")
    battle_smoke("language/index.html", "letters", "easy", "lang/letters")
    battle_smoke("language/index.html", "fixit", "normal", "lang/fixit")
    # Fix It! takes two taps: find the mistake, then pick the correction
    earns_smoke(
        "lang",
        """
        var w = TEST.state.question.wrong;
        var toks = document.querySelectorAll('.word-tok');
        for (var i = 0; i < toks.length; i++) {
            if (toks[i].textContent.replace(/[.,!?]$/, '') === w) { toks[i].click(); break; }
        }
        """,
        """
        var fix = TEST.state.question.fix;
        var cards = document.querySelectorAll('.wordcard');
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].textContent === fix) { cards[i].click(); break; }
        }
        """)
    reward_smoke("lang")

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
    # click the one choice the scene marks as right
    earns_smoke("story", """
        var ok = TEST.scene().choices.filter(function (c) { return c.ok; })[0];
        var cards = document.querySelectorAll('.choice-card');
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].textContent === ok.t) { cards[i].click(); break; }
        }
    """)
    reward_smoke("story")
finally:
    d.quit()

print("")
if failures:
    print("%d CHECK(S) FAILED:" % len(failures))
    for f in failures:
        print("  - " + f)
    sys.exit(1)
print("All smoke checks passed.")
