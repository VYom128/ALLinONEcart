# ALLinONEcart – Claude Code prompts

One file per phase. Open the file for the current phase (see "Current phase" in `CLAUDE.md`) and paste the prompts in order, one at a time.

| Phase | File | Prompts | Part |
|---|---|---|---|
| 0 | [PHASE_0_PROMPTS.md](PHASE_0_PROMPTS.md) – Project setup | 8 | MVP |
| 1 | [PHASE_1_PROMPTS.md](PHASE_1_PROMPTS.md) – Authentication and accounts | 7 | MVP |
| 2 | [PHASE_2_PROMPTS.md](PHASE_2_PROMPTS.md) – Stores, categories and extraction | 8 | MVP |
| 3 | [PHASE_3_PROMPTS.md](PHASE_3_PROMPTS.md) – Cart | 7 | MVP |
| 4 | [PHASE_4_PROMPTS.md](PHASE_4_PROMPTS.md) – Goals and motivation | 7 | MVP |
| 5 | [PHASE_5_PROMPTS.md](PHASE_5_PROMPTS.md) – Notifications, privacy and settings | 6 | MVP |
| 6 | [PHASE_6_PROMPTS.md](PHASE_6_PROMPTS.md) – Admin, hardening and MVP release | 9 | MVP |
| — | MVP gate: 40 % activation, 25 % day-30 retention | — | — |
| 7 | [PHASE_7_PROMPTS.md](PHASE_7_PROMPTS.md) – Exact-match price comparison | 7 | V2 |
| 8 | [PHASE_8_PROMPTS.md](PHASE_8_PROMPTS.md) – Price tracking and alerts | 5 | V2 |
| 9 | [PHASE_9_PROMPTS.md](PHASE_9_PROMPTS.md) – Affiliate links and Premium | 4 | V2 |
| 10 | [PHASE_10_PROMPTS.md](PHASE_10_PROMPTS.md) – Motivation V2, lists, sharing and AI | 6 | V2 |
| 11 | [PHASE_11_PROMPTS.md](PHASE_11_PROMPTS.md) – More platforms | 6 | V2 |

## Every phase follows the same pattern
1. **Read and plan (no code).** Claude Code reads `CLAUDE.md`, the roadmap and the listed spec sections, then gives you a plan. Correct the plan before approving it.
2. **Build steps.** Server first, then mobile. Each step ends with lint, typecheck, tests, seed and smoke, plus a commit.
3. **Finish the phase.** Claude Code verifies the checklist, updates `ROADMAP.md`, adds the phase's building blocks to `CLAUDE.md`, and commits.
4. Run `/clear` and start the next phase in a fresh session.

Phases 10 and 11 start by writing their own spec sections, because the spec only outlines them.

## After every prompt
- Tick the **Check after** boxes before pasting the next prompt.
- If something fails, paste this: *"This is failing: <error>. Fix the cause without deleting, skipping or weakening tests, then run the checks again and show me."*
- Watch for warning signs: tests deleted or skipped, golden numbers in `expectations.json` changed without a reason, or tests calling real store websites.
- Approve reasonable deviations, but make sure each one is recorded in spec §20 ("Decisions made").
