#!/usr/bin/env python3
"""Generate many problems on every math track and check each answer is right.

Usage:
    .verify/venv/bin/python .verify/tracks.py [rounds]

The generators are the part of the game most likely to be quietly wrong — an
off-by-one in a sequence, a pattern whose "next" isn't what the tiles offer, a
sort group whose odd one out isn't actually odd. This drives the real
MAKERS through the page and re-derives each answer independently.

Exit code 0 only if every generated problem checks out.
"""
import os, re, sys, json, time

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ROUNDS = int(sys.argv[1]) if len(sys.argv) > 1 else 200

opts = Options()
opts.add_argument("--headless")
service = Service(executable_path=os.path.join(HERE, "geckodriver"), log_output=os.devnull)
d = webdriver.Firefox(options=opts, service=service)

failures = []


def fail(msg):
    print("  FAIL  " + msg)
    failures.append(msg)


def sample(track, rounds, tier=None):
    """Ask the page for `rounds` problems from one track."""
    return d.execute_script("""
        var track = arguments[0], n = arguments[1], tier = arguments[2];
        if (tier) Save.update(function (p) { p.progress.seqTier = tier; });
        TEST.state.track = track;
        var out = [];
        for (var i = 0; i < n; i++) {
            var q = TEST.makers[track]();
            out.push({ text: q.text, answer: String(q.answer),
                       choices: q.choices || null });
        }
        return out;
    """, track, rounds, tier)


def nums(text):
    return [int(x) for x in re.findall(r"-?\d+", text)]


try:
    d.get("file://" + os.path.join(ROOT, "index.html"))
    time.sleep(0.6)
    d.execute_script("Save.reset(); Save.createProfile('TrackTester', '🧪');")
    d.get("file://" + os.path.join(ROOT, "math/index.html"))
    time.sleep(0.9)

    # ---------- arithmetic: re-do the sum from the printed problem ----------
    OPS = {
        "add": ("+", lambda a, b: a + b),
        "count": ("+", lambda a, b: a + b),
        "sub": ("−", lambda a, b: a - b),
        "mul": ("×", lambda a, b: a * b),
        "div": ("÷", lambda a, b: a // b),
    }
    for track, (sym, fn) in OPS.items():
        bad = 0
        for q in sample(track, ROUNDS):
            a, b = [int(x) for x in q["text"].split(sym)]
            if str(fn(a, b)) != q["answer"]:
                bad += 1
        print(("  PASS  " if not bad else "  FAIL  ") + "%s: %d problems" % (track, ROUNDS))
        if bad:
            fail("%s: %d wrong answers" % (track, bad))

    # count-on only ever adds 1, 2 or 3
    steps = set(int(q["text"].split("+")[1]) for q in sample("count", ROUNDS))
    if not steps <= {1, 2, 3}:
        fail("count: step sizes outside 1-3: %s" % sorted(steps))
    else:
        print("  PASS  count: only adds 1, 2 or 3")

    # subtraction always leaves something to count
    if any(int(q["answer"]) < 1 for q in sample("sub", ROUNDS)):
        fail("sub: a difference dropped below 1")
    else:
        print("  PASS  sub: every difference is at least 1")

    # times tables stay in the 2-12 range
    facs = set()
    for q in sample("mul", ROUNDS):
        facs.update(nums(q["text"]))
    if not facs <= set(range(2, 13)):
        fail("mul: factors outside 2-12: %s" % sorted(facs - set(range(2, 13))))
    else:
        print("  PASS  mul: both factors stay in 2-12")

    # division is always clean, and the quotient lands back in 2-12
    bad = [q for q in sample("div", ROUNDS)
           if nums(q["text"])[0] % nums(q["text"])[1] or not 2 <= int(q["answer"]) <= 12]
    if bad:
        fail("div: %d problems with a remainder or an out-of-range quotient" % len(bad))
    else:
        print("  PASS  div: divides evenly, quotient in 2-12")

    # ---------- next number / one more, one less ----------
    if any(int(q["answer"]) != nums(q["text"])[0] + 1 for q in sample("next", ROUNDS)):
        fail("next: answer is not the following number")
    else:
        print("  PASS  next: always the number after")

    bad = 0
    for q in sample("oneless", ROUNDS):
        n = nums(q["text"])[0]
        want = n + 1 if "more" in q["text"] else n - 1
        if str(want) != q["answer"] or int(q["answer"]) < 1:
            bad += 1
    print(("  PASS  " if not bad else "  FAIL  ") + "oneless: %d problems" % ROUNDS)
    if bad:
        fail("oneless: %d wrong or below 1" % bad)

    # ---------- skip counting ----------
    for mastered in (False, True):
        d.execute_script(
            "var v = arguments[0];"
            "Save.update(function (p) { p.progress.skipMastered = v; });", mastered)
        seen = set()
        bad = 0
        for q in sample("skip", ROUNDS):
            seq = nums(q["text"])
            step = seq[1] - seq[0]
            seen.add(step)
            if seq[2] - seq[1] != step or str(seq[2] + step) != q["answer"]:
                bad += 1
        want = {2, 3, 5, 10} if mastered else {5, 10}
        label = "with 2s and 3s unlocked" if mastered else "before mastery"
        if bad:
            fail("skip (%s): %d broken sequences" % (label, bad))
        elif not seen <= want:
            fail("skip (%s): unexpected steps %s" % (label, sorted(seen - want)))
        else:
            print("  PASS  skip (%s): steps %s" % (label, sorted(seen)))

    # ---------- make 10 ----------
    bad = 0
    for q in sample("bonds", ROUNDS):
        n = nums(q["text"])[0]
        if n + int(q["answer"]) != 10 or not 1 <= n <= 9:
            bad += 1
    print(("  PASS  " if not bad else "  FAIL  ") + "bonds: every pair makes exactly 10")
    if bad:
        fail("bonds: %d pairs don't make 10" % bad)

    # ---------- coins ----------
    rows = d.execute_script("""
        TEST.state.track = 'coins';
        var out = [];
        for (var i = 0; i < arguments[0]; i++) {
            var q = TEST.makers.coins();
            out.push({ coins: TEST.state.coins.slice(), answer: q.answer });
        }
        return out;
    """, ROUNDS)
    bad = [r for r in rows if sum(r["coins"]) != r["answer"]]
    check_ok = not bad
    print(("  PASS  " if check_ok else "  FAIL  ") + "coins: the total matches the coins shown")
    if bad:
        fail("coins: %d totals don't match the coins, e.g. %s" % (len(bad), bad[0]))

    bad = [r for r in rows if not r["coins"] or len(r["coins"]) > 5]
    if bad:
        fail("coins: %d purses are empty or too many to count" % len(bad))
    else:
        print("  PASS  coins: between one and five coins each time")
    kinds = set(c for r in rows for c in r["coins"])
    if not kinds <= {1, 5, 10, 25}:
        fail("coins: unexpected denominations %s" % sorted(kinds - {1, 5, 10, 25}))
    else:
        print("  PASS  coins: only real denominations (%s)" % sorted(kinds))
    big = [r for r in rows if r["answer"] > 60]
    if big:
        fail("coins: %d totals over 60c, too much for a six-year-old" % len(big))
    else:
        print("  PASS  coins: totals stay countable")
    # sorted biggest-first, the way you'd actually count them
    if any(r["coins"] != sorted(r["coins"], reverse=True) for r in rows):
        fail("coins: not laid out biggest first")
    else:
        print("  PASS  coins: laid out biggest first")

    # ---------- clock ----------
    rows = d.execute_script("""
        TEST.state.track = 'clock';
        var out = [];
        for (var i = 0; i < arguments[0]; i++) {
            var q = TEST.makers.clock();
            out.push({ time: TEST.state.time, answer: q.answer, choices: q.choices });
        }
        return out;
    """, ROUNDS)
    bad = [r for r in rows
           if r["answer"] != "%d:%02d" % (r["time"]["h"], r["time"]["m"])]
    if bad:
        fail("clock: %d answers don't match the hands drawn, e.g. %s" % (len(bad), bad[0]))
    else:
        print("  PASS  clock: the answer matches the hands drawn")
    bad = [r for r in rows if r["answer"] not in r["choices"]]
    if bad:
        fail("clock: %d answers aren't among the choices" % len(bad))
    else:
        print("  PASS  clock: the answer is always offered")
    bad = [r for r in rows if len(set(r["choices"])) != len(r["choices"])]
    if bad:
        fail("clock: %d have a duplicate choice, so two tiles are both right" % len(bad))
    else:
        print("  PASS  clock: no duplicate choices")
    hours = set(r["time"]["h"] for r in rows)
    mins = set(r["time"]["m"] for r in rows)
    if not hours <= set(range(1, 13)) or not mins <= {0, 30}:
        fail("clock: times outside 1-12 o'clock and half past: %s %s"
             % (sorted(hours - set(range(1, 13))), sorted(mins - {0, 30})))
    else:
        print("  PASS  clock: o'clock and half past only, until quarters unlock")

    # ---------- fractions ----------
    rows = d.execute_script("""
        TEST.state.track = 'fract';
        var out = [];
        for (var i = 0; i < arguments[0]; i++) {
            var q = TEST.makers.fract();
            out.push({ text: q.text, answer: String(q.answer),
                       choices: q.choices, bars: TEST.state.bars.slice() });
        }
        return out;
    """, ROUNDS)

    def val(f):
        n, dd = f.split("/")
        return int(n) / int(dd)

    bad = [r for r in rows if r["answer"] not in r["choices"]]
    if bad:
        fail("fractions: %d answers aren't among the choices" % len(bad))
    else:
        print("  PASS  fractions: the answer is always offered")

    bad = [r for r in rows if len(set(r["choices"])) != len(r["choices"])]
    if bad:
        fail("fractions: %d have a duplicate choice" % len(bad))
    else:
        print("  PASS  fractions: no duplicate choices")

    # the bars drawn must be the fractions being asked about
    comp = [r for r in rows if r["text"] == "Which is bigger?"]
    bad = [r for r in comp
           if sorted(r["choices"]) != sorted("%d/%d" % (b["n"], b["d"]) for b in r["bars"])]
    if bad:
        fail("fractions: %d comparisons draw bars that aren't the choices" % len(bad))
    else:
        print("  PASS  fractions: the bars drawn are the fractions offered")

    # "which is bigger" must have a bigger one
    bad = [r for r in comp if val(r["choices"][0]) == val(r["choices"][1])]
    if bad:
        fail("fractions: %d comparisons are between two equal fractions" % len(bad))
    else:
        print("  PASS  fractions: never asks which is bigger of two equals")
    bad = [r for r in comp
           if val(r["answer"]) != max(val(c) for c in r["choices"])]
    if bad:
        fail("fractions: %d comparisons name the smaller one, e.g. %s" % (len(bad), bad[0]))
    else:
        print("  PASS  fractions: the bigger fraction is the answer")

    # equivalents really are equivalent, and the decoys really aren't
    eq = [r for r in rows if "same as" in r["text"]]
    bad = []
    for r in eq:
        shown = r["text"].split(" is")[0]
        if abs(val(shown) - val(r["answer"])) > 1e-9:
            bad.append(r["text"])
        if any(abs(val(c) - val(shown)) < 1e-9 for c in r["choices"] if c != r["answer"]):
            bad.append(r["text"] + " (a decoy is also equal)")
    if bad:
        fail("fractions: %d equivalents are wrong, e.g. %s" % (len(bad), bad[0]))
    else:
        print("  PASS  fractions: equivalents are equal and decoys are not")

    # adding: same denominator, under a whole, and never adding the bottoms
    add = [r for r in rows if " + " in r["text"]]
    bad = []
    for r in add:
        left, right = r["text"].split(" + ")
        ln, ld = [int(x) for x in left.split("/")]
        rn, rd = [int(x) for x in right.split("/")]
        an, ad = [int(x) for x in r["answer"].split("/")]
        if ld != rd or ad != ld or an != ln + rn:
            bad.append(r["text"] + " -> " + r["answer"])
        if an >= ad:
            bad.append(r["text"] + " makes a whole or more")
    if bad:
        fail("fractions: %d additions are wrong, e.g. %s" % (len(bad), bad[0]))
    else:
        print("  PASS  fractions: additions share a denominator and stay under a whole")

    dens = set(b["d"] for r in rows for b in r["bars"])
    if max(dens) > 12:
        fail("fractions: denominators up to %d, too many parts to see" % max(dens))
    else:
        print("  PASS  fractions: bars stay countable (up to %d parts)" % max(dens))
    bad = [r for r in rows for b in r["bars"] if b["n"] > b["d"] or b["n"] < 1]
    if bad:
        fail("fractions: %d bars fill more parts than they have" % len(bad))
    else:
        print("  PASS  fractions: no bar fills more than it has")

    # ---------- patterns ----------
    bad_choice = bad_len = 0
    for q in sample("pattern", ROUNDS):
        if not q["choices"] or q["answer"] not in q["choices"]:
            bad_choice += 1
        if len(set(q["choices"] or [])) != 3:
            bad_len += 1
    if bad_choice:
        fail("pattern: %d problems whose answer isn't among the tiles" % bad_choice)
    elif bad_len:
        fail("pattern: %d problems without 3 distinct tiles" % bad_len)
    else:
        print("  PASS  pattern: answer always among 3 distinct tiles")

    # the sequence really does repeat, so the answer is derivable
    bad = 0
    for q in sample("pattern", ROUNDS):
        toks = q["text"].replace("❓", "").split()
        # find the shortest repeating unit that explains the whole sequence
        unit = next((k for k in range(1, len(toks))
                     if all(toks[i] == toks[i % k] for i in range(len(toks)))), None)
        if unit is None or toks[len(toks) % unit] != q["answer"]:
            bad += 1
    if bad:
        fail("pattern: %d sequences whose next token isn't the answer" % bad)
    else:
        print("  PASS  pattern: the next token really is the answer")

    # ---------- sort it ----------
    bad = 0
    groups = d.execute_script("return TEST.sortGroups;")
    for q in sample("sort", ROUNDS):
        if not q["choices"] or q["answer"] not in q["choices"] or len(q["choices"]) != 4:
            bad += 1
    if bad:
        fail("sort: %d problems without the odd one among 4 tiles" % bad)
    else:
        print("  PASS  sort: odd one out always among 4 tiles")

    overlap = [g["q"] for g in groups if set(g["same"]) & set(g["odd"])]
    if overlap:
        fail("sort: a group lists the same emoji as both belonging and odd: %s" % overlap)
    else:
        print("  PASS  sort: no emoji is both belonging and odd")

    short = [g["q"] for g in groups if len(g["same"]) < 3 or len(g["odd"]) < 1]
    if short:
        fail("sort: group too small to make a question: %s" % short)
    else:
        print("  PASS  sort: every group can fill a question")

    # ---------- rule hunter, tier by tier ----------
    for tier in range(1, 6):
        rows = sample("rule", ROUNDS, tier)
        bad = 0
        for q in rows:
            if q["choices"]:
                # tier 5's name-the-rule form
                if q["answer"] not in q["choices"] or len(set(q["choices"])) != 3:
                    bad += 1
                continue
            seq = nums(q["text"])
            ans = int(q["answer"])
            if tier == 5:
                continue          # "what is number N?" is checked below
            if tier == 4:
                # two interleaved rules: the answer continues the alternation
                a = seq[1] - seq[0]
                if ans != seq[-1] + a:
                    bad += 1
            elif len(set(seq[i + 1] - seq[i] for i in range(len(seq) - 1))) == 1:
                step = seq[1] - seq[0]
                if ans != seq[-1] + step:
                    bad += 1
            else:
                ratio = seq[1] / seq[0] if seq[0] else 0
                if ratio and abs(ans - seq[-1] * ratio) > 1e-9:
                    bad += 1
        if bad:
            fail("rule tier %d: %d sequences the answer doesn't continue" % (tier, bad))
        else:
            kinds = "tiles" if any(r["choices"] for r in rows) else "numbers"
            print("  PASS  rule tier %d: %d problems (%s)" % (tier, ROUNDS, kinds))

    # tier 5's jump-ahead form, checked directly
    rows = [q for q in sample("rule", ROUNDS * 2, 5) if not q["choices"]]
    bad = 0
    for q in rows:
        seq = nums(q["text"])
        nth = seq[-1]                      # the "what is the Nth number?" N
        start, step = seq[0], seq[1] - seq[0]
        if int(q["answer"]) != start + step * (nth - 1):
            bad += 1
    if bad:
        fail("rule tier 5: %d wrong far-ahead answers" % bad)
    else:
        print("  PASS  rule tier 5: %d far-ahead answers correct" % len(rows))

    # The jump-ahead question teaches that you needn't list every term to know
    # one. That idea drowns if the arithmetic is hard: "8, 17, 26, 35 ... the
    # 10th?" is 8 + 9x9 in your head. So either the sequence is the multiples
    # of its step (making the answer a times-table fact), or the step is one
    # of the easy ones.
    hard, far = [], []
    for q in rows:
        seq = nums(q["text"])
        nth = seq[-1]
        start, step = seq[0], seq[1] - seq[0]
        if start != step and step not in (2, 5, 10):
            hard.append(q["text"])
        if nth > 12:
            far.append(q["text"])
    if hard:
        fail("rule tier 5: %d questions need awkward mental multiplication, e.g. %s"
             % (len(hard), hard[0]))
    else:
        print("  PASS  rule tier 5: the arithmetic stays tractable")
    if far:
        fail("rule tier 5: %d ask for a position past 12, e.g. %s" % (len(far), far[0]))
    else:
        print("  PASS  rule tier 5: never asks past the 12th position")

    # most of them should be a straight times-table fact
    tables = [q for q in rows if nums(q["text"])[0] == nums(q["text"])[1] - nums(q["text"])[0]]
    share = len(tables) / len(rows) if rows else 0
    if not 0.55 <= share <= 0.95:
        fail("rule tier 5: %.0f%% are times-table shaped, want most of them" % (share * 100))
    else:
        print("  PASS  rule tier 5: %.0f%% are a times-table fact" % (share * 100))

    # and the wording should read as a position, not a value
    if any("what is number" in q["text"] for q in rows):
        fail('rule tier 5: still says "what is number N" rather than "the Nth number"')
    else:
        print("  PASS  rule tier 5: asks for the Nth number, not number N")

    # the ladder must actually climb, and stop at 5
    d.execute_script("Save.update(function (p) { p.progress.seqTier = 1; p.progress.seqCorrect = 0; });")
    d.execute_script("TEST.state.track = 'rule';")
    tiers = []
    for i in range(30):
        d.execute_script("TEST.bumpRuleTier();")
        tiers.append(d.execute_script("return Save.me().progress.seqTier;"))
    if tiers[4] != 2 or tiers[-1] != 5:
        fail("rule ladder: expected tier 2 after 5 correct and a cap at 5, got %s" % tiers)
    else:
        print("  PASS  rule ladder: climbs every 5 correct and caps at tier 5")
finally:
    d.quit()

print("")
if failures:
    print("%d TRACK CHECK(S) FAILED" % len(failures))
    sys.exit(1)
print("All track checks passed.")
