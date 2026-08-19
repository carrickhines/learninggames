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


MAP_STOPS_JS = (
    '      var out = [];\n'
    "      ['little', 'big'].forEach(function (tr) {\n"
    '        Save.mapTrail(tr).forEach(function (st) {\n'
    '          st.options.forEach(function (o) {\n'
    "            if (o.g === 'math' || o.g === 'language') out.push([tr, st.i, o.g, o.t, o.m]);\n"
    '          });\n'
    '        });\n'
    '      });\n'
    '      return out;\n'
)


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

    # ---- the difficulty ladder ----
    # Easy was 15s and Normal 14s: two modes that felt identical, then Expert
    # fell off a cliff. Each rung must be a real step down from the last.
    for game, path, unit in (("math", "math/index.html", 1000.0),
                             ("language", "language/index.html", 1.0)):
        d.get("file://" + os.path.join(ROOT, path))
        time.sleep(0.9)
        modes = js("TEST.MODES")
        secs = {k: modes[k]["total"] / unit for k in ("easy", "normal", "expert")}
        fast = {k: modes[k]["fast"] / unit for k in ("easy", "normal", "expert")}

        check("%s: each mode gives less time than the last" % game,
              secs["easy"] > secs["normal"] > secs["expert"],
              str(secs))
        # a rung has to be a real step, not a rounding error
        check("%s: the steps between modes are meaningful" % game,
              secs["normal"] <= secs["easy"] * 0.85 and
              secs["expert"] <= secs["normal"] * 0.85,
              str(secs))
        check("%s: even Expert leaves time to think" % game,
              secs["expert"] >= 15, "%.0fs" % secs["expert"])
        check("%s: Normal is not a race" % game,
              secs["normal"] >= 30, "%.0fs" % secs["normal"])
        check("%s: the fast zone is a bonus, not the whole bar" % game,
              all(0.15 <= fast[k] / secs[k] <= 0.45 for k in secs),
              str({k: round(fast[k] / secs[k], 2) for k in secs}))
        check("%s: Easy never punishes a slow answer" % game,
              modes["easy"]["penalty"] is False)
        check("%s: Normal and Expert do" % game,
              modes["normal"]["penalty"] and modes["expert"]["penalty"])

    # ---- per-track time ----
    # A question is not a question: recalling 7x8 is a different act from
    # finding the rule behind 1, 2, 4, 5, 7, 8. Each track scales the clock.
    for game, path, unit, slowest in (
            ("math", "math/index.html", 1000.0, "rule"),
            ("language", "language/index.html", 1.0, "fixit")):
        d.get("file://" + os.path.join(ROOT, path))
        time.sleep(0.9)
        scales = js("TEST.TRACK_TIME")

        check("%s: every track has a time scale" % game,
              all(v > 0 for v in scales.values()), str(scales))
        check("%s: nothing is faster than the baseline" % game,
              min(scales.values()) >= 1, str(scales))
        check("%s: the thinking tracks get noticeably longer" % game,
              max(scales.values()) >= 1.5,
              "slowest scale is %.1f" % max(scales.values()))

        # the clock the game actually uses, per track, on Normal
        def secs(track, tier=None):
            return d.execute_script("""
                var track = arguments[0], tier = arguments[1];
                TEST.state.mode = 'normal';
                TEST.state.track = track;
                if (tier) Save.update(function (p) { p.progress.seqTier = tier; });
                return TEST.timing().total;
            """, track, tier) / unit

        base = secs("mul" if game == "math" else "letters")
        slow = secs(slowest)
        check("%s: %s gets much longer than a recall question" % (game, slowest),
              slow >= base * 1.5, "%.0fs vs %.0fs" % (slow, base))
        check("%s: even the quickest track keeps the mode's floor" % game,
              base >= 30, "%.0fs" % base)

        # the bar and the double-hit window must be computed from one place,
        # or the white marker ends up lying about where the bonus ends
        parts = d.execute_script("var t = TEST.timing(); return [t.total, t.fast];")
        check("%s: the fast zone sits inside the bar" % game,
              0 < parts[1] < parts[0], str(parts))

    # Rule Hunter's upper rungs are harder again and get more time still
    d.get("file://" + os.path.join(ROOT, "math/index.html"))
    time.sleep(0.9)
    def rule_secs(tier):
        return d.execute_script("""
            var tier = arguments[0];
            TEST.state.mode = 'normal';
            TEST.state.track = 'rule';
            Save.update(function (p) { p.progress.seqTier = tier; });
            return TEST.timing().total;
        """, tier) / 1000.0
    t1, t5 = rule_secs(1), rule_secs(5)
    check("math: the hardest Rule Hunter rung gets more time than the first",
          t5 > t1 * 1.4, "rung 1 %.0fs, rung 5 %.0fs" % (t1, t5))
    check("math: even rung 1 of Rule Hunter is generous", t1 >= 60, "%.0fs" % t1)

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
    # A world has to be reachable one way or another, or its monsters exist
    # only as names on cards for creatures the kids have never met. Two ways
    # count: buy it in the shop and fight there in free play, or be the home
    # region of a stretch of map, since a map stop fights its own region's
    # lineup. A world that is neither is stranded.
    unlockable = set(i["world"] for i in shop if i["kind"] == "world")
    regions = js("Save.REGIONS")
    homed = set((r.get("cards") or r["id"]) for r in regions)
    stranded = [w["id"] for w in worlds[1:]
                if w["id"] not in unlockable and w["id"] not in homed]
    check("shop: every world is either buyable or somewhere on the map",
          not stranded, "no way to meet " + str(stranded))
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

    SLOTS = ("weapon", "armor", "pet", "trinket", "helm", "boots")

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

    # ---- card rarity ----
    # Expected drops per day of play, so a tweak to the odds can't quietly
    # turn the collection back into something you finish in a week.
    kos_per_day = 22                      # ~5 runs across the two battle games
    rar = econ["cardRarityOdds"]
    world_rarities = [f["r"] for w in worlds
                      for g in ("math", "language") for f in w["foes"][g]]
    avg = sum(econ["cardChance"] * rar[str(r)] for r in world_rarities) / len(world_rarities)
    per_day = kos_per_day * avg
    check("cards: a card is a rare event, not most fights",
          econ["cardChance"] <= 0.2, "%.0f%% base" % (econ["cardChance"] * 100))
    check("cards: a few a day at most, and at least one every other day",
          0.4 <= per_day <= 3.5, "%.1f cards/day" % per_day)

    # the pity counter must be a real floor without being the main source
    pity_days = econ["cardPity"] / kos_per_day
    check("cards: the pity counter guarantees one within a couple of days",
          0.5 <= pity_days <= 3, "%.1f days" % pity_days)

    check("cards: rarer tiers really are rarer",
          rar["1"] > rar["2"] > rar["3"], str(rar))
    check("cards: every world's last foe is legendary",
          all(w["foes"][g][-1]["r"] == 3 for w in worlds for g in ("math", "language")))
    check("cards: a foil is worth more than a plain copy", econ["foilWorth"] > 1)
    check("cards: a legendary spare is worth more than a common",
          econ["cardValue"]["3"] > econ["cardValue"]["1"])
    check("cards: a wild-card trade costs a real pile of spares",
          econ["wildCardCost"] >= 5, str(econ["wildCardCost"]))

    perks = js("Save.SET_PERKS")
    check("cards: every world's set is worth something",
          all(w["id"] in perks and perks[w["id"]].get("label") for w in worlds))

    # Every wearable slot's dearest item is gated on a finished card set, so
    # "the best gear" stays a collection problem rather than only a big
    # number. Checked per slot rather than against a fixed list of four, so
    # adding a slot can't quietly leave its top tier buyable with gold alone.
    gated = [i for i in shop if i.get("set")]
    ungated_top = [k for k in SLOTS
                   if max((i for i in shop if i["kind"] == k),
                          key=lambda i: i["cost"]).get("set") is None]
    check("economy: the top tier of every slot is set-gated",
          not ungated_top, "gold alone buys the best " + str(ungated_top))
    check("economy: every gated item points at a real world",
          all(any(w["id"] == i["set"] for w in worlds) for i in gated))

    check("worlds: each has a full lineup for both battle games",
          all(len(w["foes"]["math"]) == 4 and len(w["foes"]["language"]) == 5 for w in worlds))

    # =================== The hub's own claims ===================
    # The hub advertises how much there is to play in hand-written HTML. Those
    # numbers drifted badly once already — it still said 7 maths tracks when
    # there were 19 — so they are checked against the registries themselves.
    print("\nThe hub tells the truth")
    d.get("file://" + os.path.join(ROOT, "math/index.html"))
    time.sleep(1.0)
    # the registry, not MAKERS: MAKERS also holds the Rematch, which is
    # a mode rather than a track and never appears in the menu
    n_math = len(js("TEST.TRACKS"))
    d.get("file://" + os.path.join(ROOT, "language/index.html"))
    time.sleep(1.0)
    n_lang = len(js("TEST.TRACKS"))
    d.get("file://" + os.path.join(ROOT, "story/index.html"))
    time.sleep(1.0)
    n_quest = js("TEST.QUESTS.length")

    d.get("file://" + os.path.join(ROOT, "index.html"))
    time.sleep(0.8)
    claims = js("Array.prototype.map.call("
                "document.querySelectorAll('.games .game-card .who-for'),"
                "function (e) { return e.textContent; })")
    check("hub: it claims a count for each game", len(claims) == 3, str(claims))
    check("hub: the maths track count is right",
          str(n_math) in claims[0], "%s vs %d tracks" % (claims[0], n_math))
    check("hub: the language track count is right",
          str(n_lang) in claims[1], "%s vs %d tracks" % (claims[1], n_lang))
    check("hub: the quest count is right",
          str(n_quest) in claims[2], "%s vs %d quests" % (claims[2], n_quest))

    # ---- every map stop points at a track that exists ----
    # save.js has no idea what tracks the games actually declare, so a typo
    # in MAP -- t: 'onelesss' -- passes every shape check in save-test and
    # then opens a game with nothing to ask. Only a real page can settle it,
    # so read both registries and hold the whole trail against them.
    print("")
    print("The map points at real tracks")
    d.get("file://" + os.path.join(ROOT, "math/index.html"))
    time.sleep(1.2)
    math_tracks = set(js("Object.keys(window.TEST.makers || {})"))
    d.get("file://" + os.path.join(ROOT, "language/index.html"))
    time.sleep(1.2)
    lang_tracks = set(js("(window.TEST.TRACKS || []).map(function (t) { return t.id; })"))
    check("map: both games declare their tracks to the harness",
          len(math_tracks) > 0 and len(lang_tracks) > 0,
          "%d maths, %d language" % (len(math_tracks), len(lang_tracks)))

    d.get("file://" + os.path.join(ROOT, "index.html"))
    time.sleep(1.0)
    stops = js('(function () {' + MAP_STOPS_JS + '}())')
    unknown, badmode = [], []
    for tr, i, g, t, m in stops:
        if t not in (math_tracks if g == "math" else lang_tracks):
            unknown.append("%s %d: %s/%s" % (tr, i, g, t))
        if m not in ("easy", "normal", "expert"):
            badmode.append("%s %d: %s" % (tr, i, m))
    check("map: every stop names a track its game really has",
          not unknown, str(unknown[:4]))
    check("map: every stop names a real difficulty", not badmode, str(badmode[:4]))
    check("map: there are stops to check", len(stops) > 50, "%d stops" % len(stops))

finally:
    d.quit()

print("")
if failures:
    print("%d CONTENT CHECK(S) FAILED" % len(failures))
    sys.exit(1)
print("All content checks passed.")
