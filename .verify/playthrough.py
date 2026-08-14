#!/usr/bin/env python3
"""Play each game all the way to its win screen, through the real UI.

Usage:
    .verify/venv/bin/python .verify/playthrough.py

smoke.py checks that a game starts and pays for one answer. This checks the
whole loop: every foe defeated, the win screen reached, gold and XP banked,
cards dropped, and the profile still intact afterwards. It answers by reading
the current question out of the page and clicking the right thing, at real
speed — a couple of minutes for all three.

Exit code 0 only if every run reaches its win screen.
"""
import os, re, sys, time

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


def click(sel):
    el = d.find_element(By.CSS_SELECTOR, sel)
    d.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
    try:
        el.click()
    except ElementNotInteractableException:
        d.execute_script("arguments[0].click();", el)


def load(relpath):
    d.get("file://" + os.path.join(ROOT, relpath))
    time.sleep(0.9)
    d.execute_script(
        "window.__errs = window.__errs || [];"
        "window.addEventListener('error', function (e) { window.__errs.push(String(e.message)); });"
    )


def errs():
    return d.execute_script("return window.__errs || []")


def text(sel):
    """textContent rather than Selenium's .text, which reads empty for an
    element the driver thinks isn't visible yet."""
    return d.execute_script(
        "var e = document.querySelector(arguments[0]);"
        "return e ? e.textContent.trim() : '';", sel)


def showing(screen_id):
    return d.execute_script(
        "var s = document.getElementById(arguments[0]);"
        "return !!s && s.classList.contains('show');", screen_id)


def fresh_hero(name):
    load("index.html")
    d.execute_script("Save.reset(); Save.createProfile(arguments[0], '🦖');", name)


def gold():
    return d.execute_script("return Save.me().gold;")


def cards_held():
    return d.execute_script(
        "var c = Save.me().cards, n = 0;"
        "for (var k in c) n += c[k]; return n;")


# ---------------------------------------------------------------- Math RPG
def play_math(track):
    """Answer every problem correctly until the win screen appears."""
    load("math/index.html")
    click('[data-track="%s"]' % track)
    click('[data-mode="easy"]')
    click("#startBtn")
    time.sleep(1.0)

    for _ in range(120):
        if showing("endScreen"):
            break
        # the game holds state.answer; type it and attack
        d.execute_script("""
            if (TEST.state.busy) return;
            if (TEST.state.choices) {
                var tiles = document.querySelectorAll('#tiles .tile');
                for (var i = 0; i < tiles.length; i++)
                    if (tiles[i].textContent === String(TEST.state.answer)) { tiles[i].click(); return; }
            } else {
                document.getElementById('answer').value = String(TEST.state.answer);
                document.getElementById('attackBtn').click();
            }
        """)
        time.sleep(0.75)
    return showing("endScreen")


# ------------------------------------------------------------ Language RPG
def play_language(track):
    load("language/index.html")
    click('[data-track="%s"]' % track)
    click('[data-mode="easy"]')
    click("#startBtn")
    time.sleep(1.0)

    for _ in range(160):
        if showing("win") or showing("lose"):
            break
        # Every language question carries its answer; the shape of the answer
        # UI varies by track, so try each in turn.
        d.execute_script("""
            var q = TEST.state.question;
            if (!q || TEST.state.answered) return;
            var want = String(q.answer);

            // picture / word / letter cards
            var cards = document.querySelectorAll('#answers .picbtn, #answers .wordcard, #answers .block');
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].textContent.trim() === want) { cards[i].click(); return; }
            }
            // tappable sentence tokens (Fix It!, Grammar Hunt, Mark It! commas)
            var toks = document.querySelectorAll('.word-tok');
            for (var i = 0; i < toks.length; i++) {
                var t = toks[i].textContent.replace(/[.,!?]$/, '');
                if (t === want || t === String(q.wrong) || t === String(q.after)) { toks[i].click(); return; }
            }
            // builders: tap the chunks or letters in order
            if (q.parts || q.word) {
                var need = q.parts || String(q.word).split('');
                var slot = document.querySelectorAll('#qBig .slot.filled, .fslot.filled').length;
                var want2 = need[slot];
                var blocks = document.querySelectorAll('#answers .block');
                for (var i = 0; i < blocks.length; i++) {
                    if (blocks[i].textContent.trim() === want2 &&
                        !blocks[i].classList.contains('used')) { blocks[i].click(); return; }
                }
            }
        """)
        time.sleep(0.6)
    return showing("win")


# -------------------------------------------------------------- Story Quest
def play_quest(idx):
    load("story/index.html")
    cards = d.find_elements(By.CSS_SELECTOR, "#questRow .choice")
    d.execute_script("arguments[0].click();", cards[idx])
    click("#startBtn")
    time.sleep(1.0)

    for _ in range(120):
        if showing("win") or showing("lose"):
            break
        d.execute_script("""
            if (TEST.state.busy) return;
            // a treasure chest is showing: pick its right answer
            var chest = document.querySelector('.chest-banner');
            if (chest) {
                var sc = TEST.scene();
                if (sc.chest) {
                    var opts = document.querySelectorAll('.choices .choice-card');
                    for (var i = 0; i < opts.length; i++)
                        if (opts[i].textContent === sc.chest.right) { opts[i].click(); return; }
                }
            }
            // otherwise the scene's one right choice
            var ok = TEST.scene().choices.filter(function (c) { return c.ok; })[0];
            var cards = document.querySelectorAll('.choices .choice-card');
            for (var i = 0; i < cards.length; i++)
                if (cards[i].textContent === ok.t) { cards[i].click(); return; }
        """)
        time.sleep(0.7)
    return showing("win")


def play_mini(mode):
    load("story/index.html")
    d.execute_script("document.querySelector('[data-mini=\"%s\"]').click();" % mode)
    time.sleep(0.8)

    for _ in range(120):
        if showing("win") or showing("lose"):
            break
        d.execute_script("""
            if (TEST.state.busy) return;
            if (TEST.state.mode === 'order') {
                var steps = TEST.state.item.steps;
                var want = steps[TEST.state.placed.length];
                if (!want) return;
                var cards = document.querySelectorAll('.order-card');
                for (var i = 0; i < cards.length; i++)
                    if (cards[i].querySelector('.pic').textContent === want[0] &&
                        !cards[i].classList.contains('used')) { cards[i].click(); return; }
            } else {
                var ok = TEST.state.item.choices.filter(function (c) { return c.ok; })[0];
                var cards = document.querySelectorAll('.choices .choice-card');
                for (var i = 0; i < cards.length; i++)
                    if (cards[i].textContent === ok.t) { cards[i].click(); return; }
            }
        """)
        time.sleep(0.45)
    return showing("win")


try:
    print("\nMath RPG — a full run")
    fresh_hero("MathRunner")
    won = play_math("mul")
    check("math: a perfect run reaches the win screen", won)
    check("math: the run banked gold", gold() > 0, "gold %d" % gold())
    check("math: the run earned XP", d.execute_script("return Save.me().xp;") > 0)
    # Cards are rare now, so a four-foe run usually pays none. A drop resets
    # the pity counter, so cards+pity isn't the KO count — what must hold is
    # that the counter tracked the run and stayed inside its limit.
    pity = d.execute_script("return Save.me().progress.koSinceCard;")
    check("math: the pity counter tracked the run's KOs", pity <= 4,
          "pity %d after 4 monsters" % pity)
    check("math: the pity counter stays under its limit",
          pity < d.execute_script("return Save.ECONOMY.cardPity;"))
    check("math: a card drop resets the counter",
          cards_held() == 0 or pity < 4, "%d cards, pity %d" % (cards_held(), pity))
    check("math: the run was recorded", d.execute_script(
        "return Save.me().progress.runsWon.math;") == 1)
    check("math: no JS errors", errs() == [], str(errs()))

    # the grown-ups' record: one session, one entry per question answered
    log = d.execute_script("return Log.forProfile();")
    check("math: the run left exactly one session", len(log["sessions"]) == 1,
          "%d sessions" % len(log["sessions"]))
    sess = log["sessions"][0]
    check("math: one record per question answered, exactly",
          len(log["answers"]) == sess["r"] + sess["w"],
          "%d answers vs %d right + %d wrong"
          % (len(log["answers"]), sess["r"], sess["w"]))
    check("math: the run actually asked something",
          len(log["answers"]) >= 6, "%d answers" % len(log["answers"]))
    check("math: the record knows the game and track",
          sess["g"] == "math" and sess["k"] == "mul")
    check("math: a perfect run recorded no wrong answers", sess["w"] == 0)
    check("math: the questions were recorded, not blanks",
          all(a["q"] for a in log["answers"]))
    check("math: how long each answer took was recorded",
          all(a["ms"] >= 0 for a in log["answers"]))
    check("math: the session recorded the gold earned", sess["gold"] > 0)

    print("\nMath RPG — a tap-to-answer track")
    fresh_hero("PatternRunner")
    check("math: a pattern run reaches the win screen", play_math("pattern"))
    check("math: the pattern run banked gold", gold() > 0)

    print("\nLanguage RPG — a full run")
    fresh_hero("WordRunner")
    won = play_language("twins")
    check("language: a perfect run reaches the win screen", won)
    check("language: the run banked gold", gold() > 0, "gold %d" % gold())
    pity = d.execute_script("return Save.me().progress.koSinceCard;")
    check("language: the pity counter tracked the run's KOs", pity <= 5,
          "pity %d after 5 monsters" % pity)
    check("language: the run was recorded", d.execute_script(
        "return Save.me().progress.runsWon.language;") == 1)
    check("language: no JS errors", errs() == [], str(errs()))

    print("\nStory Quest — a full quest")
    fresh_hero("StoryRunner")
    won = play_quest(0)
    check("story: a careful reader finishes the quest", won)
    check("story: the quest banked gold", gold() > 0, "gold %d" % gold())
    check("story: the quest was marked done", d.execute_script(
        "return Save.me().progress.questsDone.length;") == 1)
    check("story: the quest dropped its card", cards_held() >= 1)
    check("story: no JS errors", errs() == [], str(errs()))
    log = d.execute_script("return Log.forProfile();")
    check("story: the quest was recorded as a session", len(log["sessions"]) == 1)
    check("story: every scene choice was recorded", len(log["answers"]) >= 10,
          "%d answers" % len(log["answers"]))

    print("\nStory Quest — the little-hero games")
    fresh_hero("LittleRunner")
    check("order: a full game reaches the win screen", play_mini("order"))
    check("order: the game banked gold", gold() > 0)
    fresh_hero("LittleRunner2")
    check("finish: a full game reaches the win screen", play_mini("finish"))
    check("finish: the game banked gold", gold() > 0)

    print("\nThe review list")
    fresh_hero("MissRunner")
    load("math/index.html")
    click('[data-track="mul"]')
    click('[data-mode="easy"]')
    click("#startBtn")
    time.sleep(1.0)
    # answer one question wrong on purpose, twice
    for _ in range(2):
        d.execute_script("""
            document.getElementById('answer').value = String(TEST.state.answer + 1);
            document.getElementById('attackBtn').click();
        """)
        time.sleep(2.2)
    d.execute_script("Log.flush();")
    missed = d.execute_script("return Log.missed();")
    check("a missed question reaches the review list", len(missed) > 0,
          "%d rows" % len(missed))
    if missed:
        check("the review list counts the misses",
              sum(m["misses"] for m in missed) == 2,
              str([(m["q"], m["misses"]) for m in missed]))
        check("the review list keeps what was answered instead",
              all(m["gave"] for m in missed))
        check("the review list keeps the question itself",
              all(m["q"] for m in missed))

    print("\nRewards never cover the question")
    fresh_hero("BannerRunner")
    load("math/index.html")
    click('[data-track="mul"]')
    click('[data-mode="easy"]')
    click("#startBtn")
    time.sleep(1.0)

    # Force a level-up and a card drop to be earned mid-battle, then play on
    # and check nothing ever lands on top of a live question.
    d.execute_script("""
        window.__overlap = 0;
        window.__seen = 0;
        // watch for a banner while a question is on screen
        window.__watch = setInterval(function () {
            var banner = document.querySelector('.levelup');
            if (!banner) return;
            window.__seen++;
            var q = document.getElementById('question');
            var battleUp = document.getElementById('battle').classList.contains('show');
            var qVisible = q && q.getBoundingClientRect().height > 0;
            if (battleUp && qVisible && !TEST.state.busy) window.__overlap++;
        }, 60);
        // one XP short of a level, so the next right answer crosses it
        Save.update(function (p) { p.xp = 99; });
    """)

    for _ in range(90):
        if showing("endScreen"):
            break
        d.execute_script("""
            if (TEST.state.busy) return;
            if (document.querySelector('.levelup')) return;   // a banner is up
            if (TEST.state.choices) {
                var t = document.querySelectorAll('#tiles .tile');
                for (var i = 0; i < t.length; i++)
                    if (t[i].textContent === String(TEST.state.answer)) { t[i].click(); return; }
            } else {
                document.getElementById('answer').value = String(TEST.state.answer);
                document.getElementById('attackBtn').click();
            }
        """)
        time.sleep(0.55)

    res = d.execute_script(
        "clearInterval(window.__watch);"
        "return { overlap: window.__overlap, seen: window.__seen };")
    check("rewards: a banner did appear during the run", res["seen"] > 0,
          "never saw one, so the check proves nothing")
    check("rewards: no banner ever covered a live question", res["overlap"] == 0,
          "%d frames with a banner over a question" % res["overlap"])
    check("rewards: nothing is left waiting at the end",
          d.execute_script("return Hud.pending();") == 0)
    check("rewards: the level was actually gained",
          d.execute_script("return Save.levelOf(Save.me()).level;") >= 2)
    check("rewards: no JS errors", errs() == [], str(errs()))

    print("\nThe map")
    fresh_hero("MapRunner")
    load("index.html")
    d.execute_script("document.getElementById('mapBtn').click();")
    time.sleep(0.6)
    total = d.execute_script("""
        return Save.mapTrail('little').reduce(
            function (n, s) { return n + s.options.length; }, 0);
    """)
    check("map: the trail is drawn",
          len(d.find_elements(By.CSS_SELECTOR, ".mapstop")) == total,
          "%d stops" % total)
    check("map: exactly one stop is playable",
          len(d.find_elements(By.CSS_SELECTOR, ".mapstop.next")) == 1)
    check("map: the rest are locked",
          len(d.find_elements(By.CSS_SELECTOR, ".mapstop.locked")) == total - 1)
    check("map: the hero is on the map",
          d.find_element(By.ID, "mapHero").is_displayed())

    # a locked stop refuses, and arms nothing
    d.execute_script("document.querySelectorAll('.mapstop.locked')[3].click();")
    time.sleep(0.3)
    check("map: a locked stop refuses", "Beat the stop before" in text("#mapFlash"),
          text("#mapFlash"))
    check("map: the refusal armed nothing",
          d.execute_script("return Save.activeNode();") is None)

    # play the first stop for real
    first = d.execute_script("return Save.MAP.little[0];")
    d.execute_script("document.querySelector('.mapstop.next').click();")
    time.sleep(1.6)
    check("map: tapping a stop opens its game",
          first["g"] in d.current_url, d.current_url)
    check("map: the game locked itself to the stop's track",
          d.execute_script("return TEST.state.track;") == first["t"])
    check("map: the game says which stop this is",
          "Stop 1" in d.execute_script(
              "var b = document.getElementById('nodeBar');"
              "return b ? b.textContent : '';"))

    for _ in range(120):
        if showing("endScreen"):
            break
        d.execute_script("""
            if (TEST.state.busy) return;
            if (TEST.state.choices) {
                var t = document.querySelectorAll('#tiles .tile');
                for (var i = 0; i < t.length; i++)
                    if (t[i].textContent === String(TEST.state.answer)) { t[i].click(); return; }
            } else {
                document.getElementById('answer').value = String(TEST.state.answer);
                document.getElementById('attackBtn').click();
            }
        """)
        time.sleep(0.7)
    check("map: the stop can be beaten", showing("endScreen"))
    check("map: beating it advanced the trail",
          d.execute_script("return Save.mapAt('little');") == 1)
    check("map: nothing is left armed",
          d.execute_script("return Save.activeNode();") is None)

    # the win screen should offer the map, not "play again"
    check("map: the win screen sends you back to the map",
          "map" in text("#playAgainBtn").lower(), text("#playAgainBtn"))
    click("#playAgainBtn")
    time.sleep(2.8)                       # the hero walks, then the chest opens

    check("map: beating a stop lands back on the map", showing("map"))
    check("map: the chest opened", d.execute_script(
        "return !document.getElementById('chestBox').classList.contains('hidden');"))
    # The gold is banked when the stop completes; the map reveals it. So check
    # the revealed amount is the configured one and the hero actually has it.
    shown = int(re.search(r"(\d+)", text("#chestLoot")).group(1))
    expect = d.execute_script("return Math.round(Save.ECONOMY.chestGold * Save.goldRate());")
    check("map: the chest paid the configured amount", shown == expect,
          "showed %d, expected %d" % (shown, expect))
    check("map: the hero actually has that gold", gold() >= shown,
          "%d gold vs a %d chest" % (gold(), shown))
    check("map: the chest says what was in it",
          "gold" in text("#chestLoot"), text("#chestLoot"))
    d.execute_script("document.getElementById('chestOk').click();")
    time.sleep(0.4)

    check("map: the beaten stop now shows as done",
          len(d.find_elements(By.CSS_SELECTOR, ".mapstop.done")) >= 1)
    check("map: the next stop opened up",
          len(d.find_elements(By.CSS_SELECTOR, ".mapstop.next")) == 1)
    check("map: the other trail is untouched",
          d.execute_script("return Save.mapAt('big');") == 0)
    check("map: the walk is not offered twice",
          d.execute_script("return Save.me().progress.mapWalk;") is None)

    # a fork: both routes are open, and taking one closes the other
    fork = d.execute_script("""
        var t = Save.mapTrail('little');
        for (var i = 0; i < t.length; i++) if (t[i].choice) return i;
        return null;
    """)
    check("map: the trail has a fork", fork is not None)
    d.execute_script(
        "var at = arguments[0];"
        "Save.update(function (p) { p.progress.map.little = at; });", fork)
    d.execute_script("openMap(null);")
    time.sleep(0.6)
    check("map: both routes of a fork are offered",
          len(d.find_elements(By.CSS_SELECTOR, ".mapstop.next")) == 2)
    check("map: the fork is signposted",
          len(d.find_elements(By.CSS_SELECTOR, ".forksign")) == 1)
    d.execute_script("Save.startNode('little', arguments[0], 1); Save.completeNode();", fork)
    d.execute_script("openMap(null);")
    time.sleep(0.5)
    check("map: the route taken reads as done",
          d.execute_script("return Save.nodeState('little', arguments[0], 1);", fork) == "done")
    check("map: the road not taken is faded",
          len(d.find_elements(By.CSS_SELECTOR, ".mapstop.untaken")) == 1)

    # a boss stop fights one big monster, not the usual lineup
    boss = d.execute_script("""
        var t = Save.mapTrail('little');
        for (var i = 0; i < t.length; i++) if (t[i].boss && !t[i].options[0].needs) return i;
        return null;
    """)
    check("map: the trail has a boss", boss is not None)
    d.execute_script("""
        var at = arguments[0];
        Save.update(function (p) { p.progress.map.little = at; });
        Save.startNode('little', at);
    """, boss)
    bossNode = d.execute_script("return Save.activeNode();")
    load(bossNode["g"] + "/index.html")
    time.sleep(0.6)
    check("map: a boss stop fights a single monster",
          d.execute_script("return TEST.FOES.length;") == 1)
    check("map: the boss is the named one",
          d.execute_script("return TEST.FOES[0].name;") == bossNode["foe"]["name"],
          d.execute_script("return TEST.FOES[0].name;"))
    check("map: the boss has more hearts than a common monster",
          d.execute_script("return TEST.FOES[0].hp;") >= 8)
    check("map: the boss shows its own pips",
          len(d.find_elements(By.CSS_SELECTOR, "#foeHp .pip, #foePips .pip")) ==
          bossNode["foe"]["hp"])

    # Free play must be unaffected by the map. Going through the hub is what
    # disarms a stop, so do that — the boss above was armed and never played.
    load("index.html")
    d.execute_script("Save.clearNode();")
    load("math/index.html")
    check("map: free play shows the menu, not a stop", showing("menu"))
    check("map: free play has no stop banner", d.execute_script(
        "var b = document.getElementById('nodeBar');"
        "return !b || b.classList.contains('hidden');"))
    click('[data-track="mul"]')
    click('[data-mode="easy"]')
    click("#startBtn")
    time.sleep(1.2)
    check("map: free play still starts a normal battle", showing("battle"))
    check("map: free play arms no stop",
          d.execute_script("return Save.activeNode();") is None)

    print("\nProgress survives")
    before = gold()
    load("index.html")
    check("hub: the gold is still there after navigating away",
          d.execute_script("return Save.me().gold;") == before,
          "%d vs %d" % (d.execute_script("return Save.me().gold;"), before))
    d.refresh()
    time.sleep(0.8)
    check("hub: the gold survives a reload",
          d.execute_script("return Save.me().gold;") == before)
finally:
    d.quit()

print("")
if failures:
    print("%d PLAYTHROUGH CHECK(S) FAILED" % len(failures))
    sys.exit(1)
print("All playthroughs finished.")
