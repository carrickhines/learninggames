#!/usr/bin/env python3
"""Check the authored content against the rules the CLAUDE.mds lay down.

Usage:
    .verify/venv/bin/python .verify/content.py

Every content list in these games carries authoring rules that, when broken,
produce a question with two right answers or none — and nothing at runtime
notices. This reads the real arrays out of the pages and checks them.

Exit code 0 only if every rule holds.
"""
import os, re, sys, time

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

opts = Options()
opts.add_argument("--headless")
service = Service(executable_path=os.path.join(HERE, "geckodriver"), log_output=os.devnull)
d = webdriver.Firefox(options=opts, service=service)

failures = []


def check(label, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + label + (("  -- " + detail) if detail and not ok else ""))
    if not ok:
        failures.append(label)


def js(expr):
    return d.execute_script("return " + expr)


try:
    d.get("file://" + os.path.join(ROOT, "index.html"))
    time.sleep(0.5)
    d.execute_script("Save.reset(); Save.createProfile('ContentTester', '🧪');")

    # =================== Language RPG ===================
    print("\nLanguage RPG")
    d.get("file://" + os.path.join(ROOT, "language/index.html"))
    time.sleep(1.0)

    tracks = js("TEST.TRACKS")
    ids = [t["id"] for t in tracks]
    check("tracks: ids are unique", len(set(ids)) == len(ids))
    check("tracks: every track has a deck and a maker",
          all(js("!!TEST.track('%s').pool() && !!TEST.track('%s').make" % (i, i)) for i in ids))
    check("tracks: every deck has content",
          all(js("TEST.track('%s').pool().length" % i) > 0 for i in ids))
    check("tracks: every track has a card in the menu",
          all(len(d.find_elements("css selector", '[data-track="%s"]' % i)) == 1 for i in ids))
    check("tracks: the menu shows nothing that isn't a track",
          len(d.find_elements("css selector", "#menu .choice[data-track]")) == len(ids))

    # ---- Beginning Sounds ----
    sounds = js("TEST.SOUNDS")
    initials = [fam[0][0][0].lower() for fam in sounds]
    check("sounds: no two families share an initial sound",
          len(set(initials)) == len(initials),
          "repeated: %s" % [c for c in initials if initials.count(c) > 1])
    bad = [fam for fam in sounds if len(set(w[0][0].lower() for w in fam)) != 1]
    check("sounds: every word in a family starts with the family's sound",
          not bad, str(bad))
    check("sounds: every family has at least 2 words",
          all(len(fam) >= 2 for fam in sounds))
    emojis = [w[1] for fam in sounds for w in fam]
    check("sounds: no emoji repeats across families",
          len(set(emojis)) == len(emojis),
          "repeated: %s" % [e for e in emojis if emojis.count(e) > 1])
    check("sounds: enough families to fill the decoys", len(sounds) >= 3)

    # ---- Opposites ----
    oppos = js("TEST.OPPOS")
    check("opposites: every entry is a pair", all(len(p) == 2 for p in oppos))
    oemoji = [w[1] for p in oppos for w in p]
    check("opposites: no emoji repeats across pairs",
          len(set(oemoji)) == len(oemoji),
          "repeated: %s" % [e for e in oemoji if oemoji.count(e) > 1])
    owords = [w[0] for p in oppos for w in p]
    check("opposites: no word repeats across pairs",
          len(set(owords)) == len(owords))
    check("opposites: enough pairs to fill the decoys", len(oppos) >= 3)

    # ---- the older rules, still worth holding ----
    fixit = js("TEST.track('fixit').pool()")
    bad = [f for f in fixit
           if f["bad"].split().count(f["wrong"]) +
              f["bad"].split().count(f["wrong"] + ".") +
              f["bad"].split().count(f["wrong"] + ",") +
              f["bad"].split().count(f["wrong"] + "!") +
              f["bad"].split().count(f["wrong"] + "?") != 1]
    check("fixit: the wrong word appears exactly once", not bad,
          "%d sentences" % len(bad) + (": " + bad[0]["bad"] if bad else ""))
    bad = [f for f in fixit if f["fix"] in f["decoys"]]
    check("fixit: no decoy is the correct fix", not bad)

    # FORGE stores only the parts, not the finished word, so "the parts spell a
    # real word" can't be checked without a dictionary. What can be checked is
    # that each build is actually a build.
    forge = js("TEST.track('forge').pool()")
    bad = [f for f in forge if len(f["p"]) < 2 or any(not c.strip() for c in f["p"])]
    check("forge: every build has at least two non-empty chunks", not bad, str(bad[:1]))
    bad = [f for f in forge if not f["m"].strip()]
    check("forge: every build has a clue to build from", not bad)
    bad = [f for f in forge if set(f["p"]) & set(f["d"])]
    check("forge: no decoy chunk is also a real part", not bad, str(bad[:1]))

    syllb = js("TEST.track('syllable').pool()")
    bad = [w for w in syllb if set(w["p"]) & set(w["d"])]
    check("syllable: no decoy chunk is also a real part", not bad, str(bad[:1]))

    twins = js("TEST.track('twins').pool()")
    bad = [t for t in twins if t["a"] in t["d"]]
    check("twins: no decoy is the answer", not bad)

    grammar = js("TEST.track('grammar').pool()")
    bad = [g for g in grammar
           if [w.strip(".,!?") for w in g["s"].split()].count(g["a"]) != 1]
    check("grammar: the target word appears exactly once", not bad,
          "%d sentences" % len(bad))

    # ---- record.html must know about every clip the game can ask for ----
    rec = open(os.path.join(ROOT, "language/record.html"), encoding="utf-8").read()
    phrases = set(re.findall(r"Voice\.play\(\['(P_\w+)'",
                             open(os.path.join(ROOT, "language/index.html"), encoding="utf-8").read()))
    missing = [p for p in phrases if ("'%s'" % p) not in rec]
    check("record.html: every game phrase can be recorded", not missing, str(missing))

    # =================== Story Quest ===================
    print("\nStory Quest")
    d.get("file://" + os.path.join(ROOT, "story/index.html"))
    time.sleep(1.0)
    quests = js("TEST.QUESTS")

    bad = []
    for qi, q in enumerate(quests):
        for si, sc in enumerate(q["scenes"]):
            oks = [c for c in sc["choices"] if c.get("ok")]
            if len(oks) != 1:
                bad.append("%s scene %d has %d right answers" % (q["title"], si + 1, len(oks)))
    check("quests: every scene has exactly one right choice", not bad, str(bad[:3]))

    bad = []
    for q in quests:
        for si, sc in enumerate(q["scenes"]):
            for c in sc["choices"]:
                if not c.get("ok") and not c.get("oops"):
                    bad.append("%s scene %d: a wrong choice with no consequence" % (q["title"], si + 1))
    check("quests: every wrong choice explains itself", not bad, str(bad[:3]))

    bad = []
    for q in quests:
        for si, sc in enumerate(q["scenes"]):
            ch = sc.get("chest")
            if not ch:
                continue
            if len(ch["a"]) != 3:
                bad.append("%s scene %d: chest has %d answers" % (q["title"], si + 1, len(ch["a"])))
            if ch["right"] not in ch["a"]:
                bad.append("%s scene %d: chest answer isn't among its options" % (q["title"], si + 1))
            if len(set(ch["a"])) != len(ch["a"]):
                bad.append("%s scene %d: chest has a duplicate option" % (q["title"], si + 1))
    check("quests: every chest has 3 distinct options including the answer", not bad, str(bad[:3]))

    # ---- little hero games ----
    order = js("TEST.ORDER_SETS")
    check("order: every set has a title and at least 3 steps",
          all(s_["title"] and len(s_["steps"]) >= 3 for s_ in order))
    bad = [s_["title"] for s_ in order
           if len(set(st[0] for st in s_["steps"])) != len(s_["steps"])]
    check("order: no picture repeats inside a set", not bad,
          str(bad) + " (a repeat makes two steps indistinguishable)")
    bad = [s_["title"] for s_ in order if any(not st[1].strip() for st in s_["steps"])]
    check("order: every step has a label", not bad)
    check("order: enough sets to fill a game without repeating",
          len(order) > js("TEST.MINI_ROUNDS"),
          "%d sets for %d rounds" % (len(order), js("TEST.MINI_ROUNDS")))

    finish = js("TEST.FINISH_STORIES")
    bad = [f["text"][:40] for f in finish
           if len([c for c in f["choices"] if c.get("ok")]) != 1]
    check("finish: every story has exactly one right ending", not bad, str(bad))
    bad = [f["text"][:40] for f in finish
           if any(not c.get("ok") and not c.get("oops") for c in f["choices"])]
    check("finish: every wrong ending explains itself", not bad, str(bad))
    bad = [f["text"][:40] for f in finish if len(f["choices"]) != 3]
    check("finish: every story offers three endings", not bad, str(bad))
    bad = [f["text"][:40] for f in finish
           if len(set(c["t"] for c in f["choices"])) != 3]
    check("finish: no two endings read the same", not bad, str(bad))
    check("finish: enough stories to fill a game without repeating",
          len(finish) > js("TEST.MINI_ROUNDS"))

    check("quests: every quest has a collectible card",
          len(quests) <= len(js("Save.STORY_CARDS")),
          "%d quests, %d cards" % (len(quests), len(js("Save.STORY_CARDS"))))

    # =================== Save data ===================
    print("\nShared data")
    d.get("file://" + os.path.join(ROOT, "index.html"))
    time.sleep(0.6)
    cards = js("Save.allCards()")
    ids = [c["id"] for c in cards]
    check("cards: every id is unique across the whole site",
          len(set(ids)) == len(ids),
          "repeated: %s" % [i for i in ids if ids.count(i) > 1])

    shop = js("Save.SHOP")
    sids = [i["id"] for i in shop]
    check("shop: every item id is unique", len(set(sids)) == len(sids))
    check("shop: every item has a name, a blurb and a price",
          all(i.get("name") and i.get("sub") and i.get("cost") is not None for i in shop))
    worlds = js("Save.WORLDS")
    unlockable = [i["world"] for i in shop if i["kind"] == "world"]
    check("shop: every world beyond the first can be bought",
          sorted(unlockable) == sorted(w["id"] for w in worlds[1:]),
          "%s vs %s" % (unlockable, [w["id"] for w in worlds[1:]]))
    # ---- the economy curve ----
    # A price edit shouldn't be able to quietly turn "months" back into "a
    # week". Simulate a day of play against the real price table and check
    # the top tier lands in the intended range.
    econ = js("Save.ECONOMY")
    worlds = js("Save.WORLDS")

    # what one math run pays in the starting world, at the table rates
    run_gold = (econ["correct"]["gold"] * 15          # ~15 questions a run
                + econ["foeDefeated"]["gold"] * 4
                + econ["runWon"]["gold"])
    day = run_gold * 5                                # ~30 min/day, ~5 runs
    check("economy: a day in the meadow pays a sane amount",
          150 <= day <= 700, "%d gold/day" % day)

    # worlds unlock over the first weeks, and each one raises the rate
    mults = [w["gold"] for w in worlds]
    check("economy: every world pays at least as well as the last",
          mults == sorted(mults) and mults[0] == 1, str(mults))
    world_costs = [i["cost"] for i in shop if i["kind"] == "world"]
    check("economy: worlds are priced in ascending order",
          world_costs == sorted(world_costs), str(world_costs))

    # days to afford everything, letting the rate rise as worlds are bought
    def days_to(target_gold):
        gold, days, rate, pending = 0, 0, 1.0, sorted(
            [(i["cost"], w["gold"]) for i in shop if i["kind"] == "world"
             for w in worlds if w["id"] == i.get("world")])
        while gold < target_gold and days < 3000:
            gold += day * rate
            days += 1
            while pending and gold >= pending[0][0]:
                cost, mult = pending.pop(0)
                gold -= cost
                rate = mult
        return days

    SLOTS = ("weapon", "armor", "pet", "trinket")

    # Tier 4 is the ceiling gold alone can reach — tier 5 also needs a card
    # set. So tier 4 is the honest measure of "how long does grinding take".
    tier4 = {k: max(i["cost"] for i in shop
                    if i["kind"] == k and not i.get("set"))
             for k in SLOTS}
    gold_ceiling = days_to(sum(tier4.values()))
    check("economy: the best gold-only gear takes months, not a week",
          60 <= gold_ceiling <= 200, "%d days of play" % gold_ceiling)

    # Tier 5 shouldn't ALSO be a gold wall — the card set is the gate, and
    # finishing a set only to be told you're broke would be a rotten moment.
    tier5 = {k: max(i["cost"] for i in shop if i["kind"] == k) for k in SLOTS}
    everything = days_to(sum(tier5.values()))
    check("economy: the set-gated tier is reachable soon after tier 4",
          everything - gold_ceiling <= 120,
          "%d days for tier 4, %d for everything" % (gold_ceiling, everything))
    check("economy: everything still takes many months",
          everything >= 100, "%d days" % everything)

    first = min(i["cost"] for i in shop if i["kind"] == "weapon" and i["cost"] > 0)
    check("economy: something is affordable in the first day or two",
          first <= day * 2, "first weapon %d vs %d/day" % (first, day))

    gated = [i for i in shop if i.get("set")]
    check("economy: the top tier of each slot is set-gated",
          sorted(i["kind"] for i in gated) == ["armor", "pet", "trinket", "weapon"],
          str(sorted(i["kind"] for i in gated)))
    check("economy: every gated item points at a real world",
          all(any(w["id"] == i["set"] for w in worlds) for i in gated))

    check("worlds: each has a full lineup for both battle games",
          all(len(w["foes"]["math"]) == 4 and len(w["foes"]["language"]) == 5 for w in worlds))
finally:
    d.quit()

print("")
if failures:
    print("%d CONTENT CHECK(S) FAILED" % len(failures))
    sys.exit(1)
print("All content checks passed.")
