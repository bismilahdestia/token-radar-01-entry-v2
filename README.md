# Token Radar — radar-3

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bismilahdestia/token-radar-01-entry-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bismilahdestia/token-radar-01-entry-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar I can build: a program that reads a frozen snapshot
of every protocol DefiLlama tracks, finds the ones that record no token yet,
ranks them by what a launch would be worth, and hands in a dashboard that shows
the board, a detail view for each protocol, and the steps to farm it.

## What it does

`main.ts` (Node 22, standard library only) reads `/input/snapshot.json`, scores
every rankable pre-token protocol with the radar-3 model in `lib/model.ts`, and
writes `/output/board.json`, `/output/data.js`, the dashboard, three screenshots
and `/output/dossier.json` (via `vendor/makefun-board.ts`).

- **227 rows**: all 40 watchlist protocols, plus 187 early pre-token protocols
  below the $50M floor. Live-token protocols are set aside at their market cap,
  never mixed into the ranking.
- **radar-3 value model**: implied value follows from the snapshot's own figures
  only — TVL, seven-day growth, and how long the protocol has run with no token.
  `implied = round(tvl x 0.30 x (1 + clamp(growth, -60, +150)/100 x 0.55)
  x momentum x maturity x discovery x patience)`, with four momentum tiers,
  a three-year maturity curve, a discovery premium for young fast growers
  (under 180 days, over +10% in a week) and a patience premium for large old
  protocols still without a token. No protocol name is special-cased.
- **Farm plans**: 8 steps per protocol, each with its cost and time, derived
  from the protocol's category, chains, TVL and age — including an exit step.
- **Dashboard**: sortable board, search + category + chain + minimum-TVL +
  growing-only filters, Watchlist / Early / Movers views, a rank-1 spotlight,
  a per-protocol detail view with the full model equation, a live-token tab,
  and a model sandbox that re-ranks the board with your own numbers.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

The run is deterministic: the same snapshot bytes always write the same
output bytes. No network at runtime.

## What changed from radar-2 (v1)

- Model: growth clamped tighter (-60/+150) and weighted 0.55; momentum is four
  tiers instead of one cliff; maturity runs over 3 years; new discovery term
  for young fast growers; patience premium raised to 1.12.
- Farm plans: 7 steps to 8, with a second-feature step and an exit step, and
  capital tiers re-based on TVL ($60/$120/$200/$300).
- Dashboard: rank-1 spotlight, minimum-TVL and growing-only filters, an
  EARLY badge on non-watchlist rows, show-more pagination, and the discovery
  multiplier in the detail view.
- Screenshots: re-rendered from this dashboard in a real headless browser.
