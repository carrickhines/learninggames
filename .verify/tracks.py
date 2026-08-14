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

    # tier 5's "what is number N?" form, checked directly
    rows = [q for q in sample("rule", ROUNDS * 2, 5) if not q["choices"]]
    bad = 0
    for q in rows:
        seq = nums(q["text"])
        nth = seq[-1]                      # the "what is number N?" N
        start, step = seq[0], seq[1] - seq[0]
        if int(q["answer"]) != start + step * (nth - 1):
            bad += 1
    if bad:
        fail("rule tier 5: %d wrong far-ahead answers" % bad)
    else:
        print("  PASS  rule tier 5: %d far-ahead answers correct" % len(rows))

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
