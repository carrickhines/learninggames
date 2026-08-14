# Learning Games — Enhancement Spec

## Context
Educational RPG-style browser games for two children (ages 5 and 8), hosted as static HTML on GitHub Pages. Current loop: player-hero answers math/language questions; correct answers damage a monster, wrong answers damage the player; completing a section grants 1–10 minutes of iPad free time. Problem: the reward is terminal (happens outside the game), non-accumulating, and has no progression momentum.

## Goal
Add lightweight persistence and an in-world progression economy without introducing server/database infrastructure, and expand the learning content (especially sequencing) across both age levels.

---

## 1. Persistence Layer

**Primary approach: browser `localStorage`.**
- No server, no database, free, persists across sessions on the device.
- Fits the use case exactly: each child plays on their own iPad, so cross-device sync is not required. State lives where they play.
- Save the full game state as a serialized JSON blob; load on page open.

**State to persist (suggested schema):**
```json
{
  "player": { "name": "", "level": 1, "xp": 0, "gold": 0 },
  "inventory": { "weapons": [], "armor": [], "pets": [], "items": [] },
  "collection": { "monsterCards": [] },
  "progress": { "unlockedWorlds": [], "sectionsCompleted": [], "highestSequenceTier": 0 },
  "settings": { "difficultyByGame": {} }
}
```

**Resilience:** `localStorage` is tied to one browser/device and can be wiped by clearing browsing data. Add:
- An **Export Progress** button (downloads the save JSON as a file).
- An **Import Progress** button (restores from that file).
Crude but bulletproof; zero infrastructure.

**Optional future upgrade — Firebase (only if cross-device sync is later wanted):**
- Firebase is Google's backend-as-a-service. Relevant piece here is **Firestore** (hosted NoSQL DB) accessed directly from client-side JS.
- Front end stays on GitHub Pages; just load the Firebase SDK client-side and init with project config. Firebase Hosting is optional and not needed.
- **Auth model:** use **Anonymous Auth** — each device gets a persistent identity, no login screen. Firebase Auth issues a JWT that the SDK attaches to every request. **Firestore Security Rules** (declarative, enforced on Google's servers) scope each child's data to their own user ID, so one kid can't overwrite the other's save.
- Free tier comfortably covers two-child usage. Tradeoffs: vendor lock-in, less query control. Not needed unless sync is required.

---

## 2. Reward / Progression Redesign

**Diagnosis:** iPad-time reward is terminal and resets each session → no momentum. Keep the combat loop; move rewards *inside* the game world and make them persistent.

**Core economy:**
- Correct answers earn **gold** and/or **XP** that **carry over between sessions** (via the persistence layer above).
- Gold is spent in an in-game **shop**: better swords, armor, a pet companion, and unlocking new monster worlds/biomes.
- XP drives **leveling**, giving the child a character they own and visibly grow.

**Collection mechanic (retention hook):**
- Each defeated monster drops a **collectible card**. Drives a "catch the next one" pull and gives a completion goal beyond any single session.

**Design principle:** every correct answer should visibly stack toward something owned and persistent — that is the loop that makes RPGs compelling. Balance difficulty so rewards feel *earned*, not handed out (tune drop rates / gold-per-correct so progress is steady but not trivial).

---

## 3. Learning Content

### 3a. Sequencing (priority focus — high carryover to math, reading, planning, cause-and-effect, self-control)

**Age 5 — order & pattern:**
- **Story sequencing:** arrange 3–4 picture cards in correct order (wake → breakfast). Builds narrative logic → reading comprehension.
- **Pattern sequencing:** repeating shape/color patterns (proto-algebra: patterns have rules).
- **Number sequencing:** counting by 5s and 10s (already in use); extend to 2s and 3s once mastered.

**Age 8 — abstract rule-finding (ladder, each stage builds on the last):**
1. Single-operation number patterns (3, 6, 9 → "add 3").
2. Two-step / multiplicative patterns (2, 4, 8, 16 → add vs. double). **Key leap: from "what's the number" to "what's the rule."**
3. Backward / subtraction / division patterns (20, 17, 14) to keep him flexible, not addition-default.
4. Mixed / alternating sequences with two interleaved rules (1, 2, 4, 5, 7, 8 → +1 then +2). Stretches working memory.
5. Describe-the-rule or predict-far-ahead ("what's the 10th number?") → early algebraic reasoning without notation.

**Throughout:** make him *hunt for the rule* rather than just continue the pattern — that's where the real thinking lives.

### 3b. Additional proposed games (age 5)
- **Finish the story:** hear a sentence, pick what happens next (sequencing + comprehension).
- **Synonyms & opposites:** hot/cold, big/small (vocabulary).
- **Beginning sounds:** which words start with the same sound (phonological awareness — strong predictor of reading success). Complements existing rhyming game.
- **Pattern recognition:** red, blue, red, blue → next (proto-algebra).
- **Sorting:** by size / color / shape (categorization logic underpinning later math).
- **One more, one less:** builds number-sense flexibility.

### 3c. Existing content to retain
- Past-tense / morphology drills (catch vs. caught) — language-processing, not motor.
- Letter identification, rhyming.
- Math: "what's the next number," visual block-based addition; upcoming skip-counting by 5s/10s then 2s/3s.

---

## Implementation Priority
1. Add `localStorage` persistence + export/import (unblocks everything else).
2. Convert reward from iPad-time to persistent gold/XP + shop + inventory.
3. Add monster-card collection mechanic.
4. Build sequencing game modules for both age tiers.
5. Layer in remaining age-5 games.
6. (Defer) Firebase only if cross-device sync becomes a requirement.
