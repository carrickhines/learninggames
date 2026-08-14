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
from selenium.common.exceptions import ElementNotInteractableException

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
    """Prefer a real click; fall back to a scripted one.

    The menus scroll inside #menu rather than the window, and Firefox's
    driver refuses to click an element it can't scroll into view by its own
    rules — even when the element is perfectly reachable. Scrolling the
    container ourselves and clicking through JS keeps the test honest about
    what it is doing."""
    el = d.find_element(By.CSS_SELECTOR, sel)
    d.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
    try:
        el.click()
    except ElementNotInteractableException:
        d.execute_script("arguments[0].click();", el)


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
    """shared/reward.js: offer -> start -> countdown ticks -> cancel."""
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


def booted(label):
    """window.TEST is assigned on the last line of each game's script, so its
    absence means the script threw on the way down — which the window error
    trap can't see, because it is installed only after the page has parsed."""
    check(label + ": the script ran to the end",
          d.execute_script("return typeof window.TEST !== 'undefined';"))


def battle_smoke(relpath, track, mode, label):
    """Menu -> pick track -> pick mode -> start -> a question is on screen."""
    load(relpath)
    check(label + ": styles resolved", styles_resolved())
    booted(label)
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

    print("\nShop")
    click("#shopBtn")
    time.sleep(0.5)
    items = d.find_elements(By.CSS_SELECTOR, ".shop-item")
    check("shop: every item is racked", len(items) == d.execute_script("return Save.SHOP.length;"),
          "%d cards" % len(items))
    check("shop: a broke hero can't afford the good stuff",
          len(d.find_elements(By.CSS_SELECTOR, ".shop-item.broke")) > 0)
    check("shop: the starter gear reads as worn",
          len(d.find_elements(By.CSS_SELECTOR, ".shop-item.worn")) >= 2)

    # try to buy something with no money
    d.execute_script("""
        var els = document.querySelectorAll('.shop-item');
        for (var i = 0; i < els.length; i++)
            if (els[i].textContent.indexOf('Sharp Sword') === 0 ||
                els[i].textContent.indexOf('⚔️Sharp Sword') === 0) { els[i].click(); return; }
        els[1].click();
    """)
    time.sleep(0.4)
    check("shop: buying while broke is refused and explained",
          "more gold needed" in text("#shopFlash"), text("#shopFlash"))
    check("shop: the refusal cost nothing", d.execute_script("return Save.me().gold;") == 0)

    # now with money
    d.execute_script("Save.award(1000, 0); renderShop();")
    d.execute_script("""
        var els = document.querySelectorAll('.shop-item');
        for (var i = 0; i < els.length; i++)
            if (els[i].textContent.indexOf('Leather Vest') >= 0) { els[i].click(); return; }
    """)
    time.sleep(0.4)
    check("shop: buying armor works", d.execute_script("return Save.owns('vest');"))
    check("shop: armor is equipped on purchase",
          d.execute_script("return Save.loadout().maxHp;") == 6)
    check("shop: the gold was spent", d.execute_script("return Save.me().gold;") == 1000 - 80)
    check("shop: no JS errors", errs() == [], str(errs()))

    print("\nCollection")
    click("#shopBackBtn")
    click("#cardsBtn")
    time.sleep(0.5)
    total = d.execute_script("return Save.allCards().length;")
    check("cards: every card has a slot",
          len(d.find_elements(By.CSS_SELECTOR, ".mcard")) == total, "%d slots" % total)
    check("cards: uncaught monsters are locked",
          len(d.find_elements(By.CSS_SELECTOR, ".mcard.locked")) == total)
    check("cards: the count reads zero", text("#cardCount") == "0 of %d" % total)
    d.execute_script("Save.awardCard('m-slime'); Save.awardCard('m-slime'); renderCards();")
    time.sleep(0.3)
    check("cards: a caught monster unlocks its slot",
          len(d.find_elements(By.CSS_SELECTOR, ".mcard.locked")) == total - 1)
    check("cards: the caught count went up", text("#cardCount") == "1 of %d" % total)
    check("cards: no JS errors", errs() == [], str(errs()))
    click("#cardsBackBtn")
    time.sleep(0.5)

    print("\niPad time token")
    check("hub: no redeem button without a token",
          not d.find_element(By.ID, "redeemBtn").is_displayed())
    bought = d.execute_script("return [Save.buy('ipad'), Save.me().gold, Save.me().inventory.tokens];")
    d.execute_script("renderHome();")
    time.sleep(0.3)
    check("hub: buying a token reveals the redeem button",
          d.find_element(By.ID, "redeemBtn").is_displayed(), str(bought))
    click("#redeemBtn")
    time.sleep(0.5)
    check("token: redeeming opens the countdown screen", d.execute_script(
        "return document.getElementById('redeem').classList.contains('show');"))
    check("token: the token was spent", d.execute_script("return Save.me().inventory.tokens;") == 0)
    mins = int(d.execute_script("return document.querySelector('.r-mins').textContent"))
    check("token: the reward rolls 5-10 minutes", 5 <= mins <= 10, str(mins))
    reward_smoke("token")
    click("#redeemBackBtn")
    time.sleep(0.4)
    check("token: leaving the screen stops the timer", d.execute_script(
        "return document.getElementById('home').classList.contains('show');"))

    print("\nMath RPG")
    battle_smoke("math/index.html", "mul", "normal", "math/mul")
    # the armor bought above must actually be worn in the fight
    check("math: armor adds a heart",
          len(d.find_elements(By.CSS_SELECTOR, "#playerHp .pip")) == 6)
    check("math: the foes come from the hero's world", d.execute_script(
        "return TEST.FOES[0].id === 'm-slime';"))
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

    print("\nLanguage RPG")
    battle_smoke("language/index.html", "letters", "easy", "lang/letters")
    check("lang: armor adds a heart",
          len(d.find_elements(By.CSS_SELECTOR, "#playerPips .pip")) == 6)
    check("lang: the foes come from the hero's world", d.execute_script(
        "return TEST.FOES[0].id === 'l-slime';"))
    battle_smoke("language/index.html", "sounds", "easy", "lang/sounds")
    battle_smoke("language/index.html", "opposites", "easy", "lang/opposites")
    check("lang: the picture choices are tappable",
          len(d.find_elements(By.CSS_SELECTOR, ".picbtn")) == 3)
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

    print("\nStory Quest")
    load("story/index.html")
    check("story: styles resolved", styles_resolved())
    booted("story")
    cards = d.find_elements(By.CSS_SELECTOR, "#questRow .choice")
    check("story: quest cards listed", len(cards) >= 8, "found %d" % len(cards))
    cards[0].click()
    click("#startBtn")
    time.sleep(1.0)
    check("story: first scene rendered", len(text(".story-text")) > 20)
    check("story: choices offered", len(d.find_elements(By.CSS_SELECTOR, ".choice-card")) >= 2)
    check("story: no JS errors", errs() == [], str(errs()))
    print("\nLittle hero story games")
    load("story/index.html")
    check("story: the little-hero games are listed",
          len(d.find_elements(By.CSS_SELECTOR, "#miniRow .choice")) == 2)

    # Story Order: tap the steps in the right order and the round completes
    d.execute_script("document.querySelector('[data-mini=\"order\"]').click();")
    time.sleep(0.8)
    booted("story/order")
    check("order: the slots match the number of steps",
          len(d.find_elements(By.CSS_SELECTOR, ".order-slot")) ==
          d.execute_script("return TEST.state.item.steps.length;"))
    before = gold()
    d.execute_script("""
        var steps = TEST.state.item.steps;
        function tapNext(i) {
            if (i >= steps.length) return;
            var cards = document.querySelectorAll('.order-card');
            for (var k = 0; k < cards.length; k++) {
                if (cards[k].querySelector('.pic').textContent === steps[i][0] &&
                    !cards[k].classList.contains('used')) {
                    cards[k].click();
                    break;
                }
            }
            setTimeout(function () { tapNext(i + 1); }, 60);
        }
        tapNext(0);
    """)
    time.sleep(2.2)
    check("order: a finished round pays gold", gold() > before, "%d -> %d" % (before, gold()))
    check("order: the round counter advanced",
          d.execute_script("return TEST.state.round;") >= 1)
    check("order: no JS errors", errs() == [], str(errs()))

    # Finish the Story
    load("story/index.html")
    d.execute_script("document.querySelector('[data-mini=\"finish\"]').click();")
    time.sleep(0.8)
    check("finish: three endings are offered",
          len(d.find_elements(By.CSS_SELECTOR, ".choice-card")) == 3)
    before = gold()
    d.execute_script("""
        var ok = TEST.state.item.choices.filter(function (c) { return c.ok; })[0];
        var cards = document.querySelectorAll('.choice-card');
        for (var i = 0; i < cards.length; i++)
            if (cards[i].textContent === ok.t) { cards[i].click(); break; }
    """)
    time.sleep(1.6)
    check("finish: the right ending pays gold", gold() > before, "%d -> %d" % (before, gold()))
    check("finish: no JS errors", errs() == [], str(errs()))

    load("story/index.html")
    cards = d.find_elements(By.CSS_SELECTOR, "#questRow .choice")
    cards[0].click()
    click("#startBtn")
    time.sleep(1.0)

    # click the one choice the scene marks as right
    earns_smoke("story", """
        var ok = TEST.scene().choices.filter(function (c) { return c.ok; })[0];
        var cards = document.querySelectorAll('.choice-card');
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].textContent === ok.t) { cards[i].click(); break; }
        }
    """)
finally:
    d.quit()

print("")
if failures:
    print("%d CHECK(S) FAILED:" % len(failures))
    for f in failures:
        print("  - " + f)
    sys.exit(1)
print("All smoke checks passed.")
