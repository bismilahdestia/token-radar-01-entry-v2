// The token radar's model, radar-3: one snapshot of the protocol universe in, one ranked
// board out.
//
// The board ranks every pre-token protocol the snapshot can rank (the watchlist is the floor,
// never the ceiling), strongest first. A protocol is pre-token when its record carries no token
// (no market cap, no CoinGecko id, no symbol). Protocols whose token already trades are kept
// apart in a live set and shown at the market's own value, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures -- TVL, seven-day growth, and how
// long the protocol has run with no token. No protocol name is ever special-cased: one function
// scores every row, and the dashboard states the formula so a reader can check it.
//
//   base        = tvl_usd x BASE_MULTIPLE                     (0.30)
//   growth      = clamp(change_7d, -60, +150) per cent (unknown: 0)
//   growthMult  = 1 + (growth / 100) x GROWTH_WEIGHT         (0.55)
//   momentum    = 1.15 when growth >= +30, 1.08 when >= +15,
//                 0.85 when growth <= -30, 0.92 when <= -15, else 1.00
//   maturity    = 0.70 + 0.30 x min(age_days, 1095) / 1095   (age unknown: 365)
//   discovery   = 1.10 when age_days < 180 and growth > +10, else 1.00
//   patience    = 1.12 when age_days >= 730 and tvl_usd >= floor, else 1.00
//   implied     = max(1, round(base x growthMult x momentum x maturity x discovery x patience))
//
// Why these terms, and what changed from radar-2: a launch is worth a share of the value
// already locked in the protocol, so the base tracks TVL at 0.30, the share a new token's
// launch valuation most often prices against locked value. Growth bends the value, but a
// single wild week must not decide the board, so growth is clamped tighter (-60/+150) and
// weighted 0.55 instead of 0.75. Momentum is now four tiers instead of one cliff at +/-25%:
// a protocol at +18% and one at +40% are in different regimes and the model says so. Age
// bends the value up over three years (1095 days) instead of four, because a protocol that
// has run three years with no token has had the longest time to plan one. Two terms are new.
// Discovery rewards the young fast grower -- under 180 days old and up more than 10% in a
// week -- because the radar exists to find launches early, and a young protocol gaining TVL
// fast is gaining the users a launch would reward. Patience rewards the large old protocol
// still without a token, the classic launch candidate, at 1.12 instead of 1.10.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  momentum_strong_up: number;
  momentum_mild_up: number;
  momentum_mild_down: number;
  momentum_strong_down: number;
  momentum_strong: number;
  momentum_mild: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  discovery_age_days: number;
  discovery_growth: number;
  discovery_mult: number;
  patience_age_days: number;
  patience_mult: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
  growth_weight: 0.55,
  growth_floor: -60,
  growth_cap: 150,
  momentum_strong_up: 30,
  momentum_mild_up: 15,
  momentum_mild_down: -15,
  momentum_strong_down: -30,
  momentum_strong: 1.15,
  momentum_mild: 1.08,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  discovery_age_days: 180,
  discovery_growth: 10,
  discovery_mult: 1.1,
  patience_age_days: 730,
  patience_mult: 1.12,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** How many young fast growers the Early movers strip carries. */
export const MOVER_ROWS = 8;

/** How many freshly listed protocols the New listings strip carries. */
export const FRESH_ROWS = 8;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    momentum_multiplier: number;
    maturity_multiplier: number;
    discovery_multiplier: number;
    patience_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with everything the sandbox needs to re-rank it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_pct: number;
  growth_multiplier: number;
  momentum_multiplier: number;
  maturity_multiplier: number;
  discovery_multiplier: number;
  patience_multiplier: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A young pre-token protocol growing fast: the early radar's movers. */
export interface MoverRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  rank: number;
}

/** A pre-token protocol listed recently: the early radar's fresh listings. */
export interface FreshRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  rank: number;
}

/** Everything the dashboard needs: the board, the live set, the movers, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  movers: MoverRow[];
  fresh: FreshRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The momentum tier for a raw seven-day growth figure: four tiers, no single cliff. */
export function momentumFor(rawGrowth: number, model: ModelConstants): number {
  if (rawGrowth >= model.momentum_strong_up) return model.momentum_strong;
  if (rawGrowth >= model.momentum_mild_up) return model.momentum_mild;
  if (rawGrowth <= model.momentum_strong_down) return 2 - model.momentum_strong;
  if (rawGrowth <= model.momentum_mild_down) return 2 - model.momentum_mild;
  return 1;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  floorUsd: number,
): { implied: number; growthPct: number; growthMult: number; momentumMult: number; maturityMult: number; discoveryMult: number; patienceMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const momentumMult = momentumFor(rawGrowth, model);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const discoveryMult = age !== null && age < model.discovery_age_days && rawGrowth > model.discovery_growth ? model.discovery_mult : 1;
  const patienceMult = age !== null && age >= model.patience_age_days && protocol.tvl_usd >= floorUsd ? model.patience_mult : 1;
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * momentumMult * maturityMult * discoveryMult * patienceMult));
  return { implied, growthPct, growthMult, momentumMult, maturityMult, discoveryMult, patienceMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * The house's own product rule, applied to every ranked row, not only the watchlist: a wrapped,
 * staked or bridged product of a token that already trades is not a protocol still waiting on a
 * launch of its own. WBTC is Bitcoin on Ethereum, Binance staked ETH is ETH in Binance's staking
 * product, and a bridge moves a token that already trades -- none of them is a launch candidate,
 * however large its TVL. The rule uses only the snapshot's own fields: the category, and the name.
 */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'CEX']);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export function isWrappedProduct(p: SnapshotProtocol): boolean {
  if (EXCLUDED_CATEGORIES.has(p.category ?? '')) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  if (EXCHANGE_PREFIX.test(p.name)) return true;
  return false;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not a wrapped, staked or bridged
 * product of a token that already trades, not an exchange, not a versioned pool. A liquid-staking
 * protocol whose name carries no wrapped or staked marker stays rankable: it is a protocol that
 * may still issue a token of its own.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isWrappedProduct(p) && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot,
  // but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, below the floor or above it. The
  // watchlist is a floor, never a ceiling: a protocol the list leaves out is no worse a subject,
  // and the radar exists to find it early.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, snapshot.floor_usd);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      momentum_multiplier: round4(s.momentumMult),
      maturity_multiplier: round4(s.maturityMult),
      discovery_multiplier: round4(s.discoveryMult),
      patience_multiplier: round4(s.patienceMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 300;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 120;
  return 60;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 75;
  if (age < 365) return 60;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open, so the protocol records you as a lender.`;
  if (c.includes('dex') || c.includes('yield aggregator') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one fee cycle.`;
  if (c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s main yield vault on ${chain} and keep the shares until the hold ends.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its app instead of bridging straight back.`;
  if (c.includes('liquid staking') || c.includes('liquid restaking') || c.includes('restaked btc') || c.includes('restaking') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it the same week.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and place one market position on ${chain}, then settle it and keep the receipt.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('onchain capital')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares, so the vault records you as an allocator.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} through ${name} and hold it for the full qualifying window.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the whole hold.`;
  if (c.includes('prediction') || c.includes('governance')) return `Deposit $${capital} and cast one vote or place one position on ${name} so the wallet shows governance activity.`;
  if (c.includes('payment') || c.includes('card')) return `Spend $${capital} through ${name} on ${chain} in two separate transactions a week apart, and keep both receipts.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold it for the full qualifying window.`;
  if (c.includes('otc') || c.includes('interest rate')) return `Open a $${capital} position on ${name} on ${chain} and hold it until the hold ends, then close it in one transaction.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open for the full qualifying window.`;
}

/** A second feature of the same protocol to touch, so the wallet shows more than one kind of activity. */
function secondFeatureFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp')) return `Borrow $20 of USDC against the deposit on ${name} on ${chain} and repay it within 7 days.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('farm')) return `Swap $25 of USDC for the pool's other asset on ${name} on ${chain} and add it to the same position.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim or restake the staking rewards on ${name} on ${chain} once during the hold.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge on ${name} and open a second small one a week later, so the wallet shows two trading weeks.`;
  if (c.includes('bridge')) return `Bridge $25 back through ${name} after a week, so the wallet shows a round trip instead of a one-way move.`;
  if (c.includes('governance')) return `Vote once more on ${name} during the hold, on a different proposal than the first vote.`;
  return `Use a second feature of ${name} on ${chain}, such as a swap, a borrow or a vote, once during the hold.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a hand-written
 * list of names: the same function plans every row. Every step names what it costs and how long
 * it takes, and the last step is the exit: how to unwind the position and what that costs.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const spread =
    secondChain !== null
      ? `Repeat a smaller position of $${Math.max(25, Math.floor(capital / 2))} on ${secondChain} so the wallet shows activity on two chains.`
      : `Add one second action type, such as a swap or a borrow, so the wallet shows more than one kind of activity.`;
  const gas = capital >= 200 ? 8 : capital >= 120 ? 6 : 4;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: spread,
      cost: `about $${secondChain !== null ? Math.max(25, Math.floor(capital / 2)) : 10} of capital and $2 of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never let two weeks pass with no activity.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: secondFeatureFor(p, chain),
      cost: 'about $25 of capital and $2 of gas',
      time: '10 minutes',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and halfway through open the protocol's own points page to confirm the wallet is being tracked.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, never from a link in a chat or an email.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then unwind in one transaction and keep about $3 of the chain's gas token so the wallet can move again.`,
      cost: 'about $3 of gas to exit',
      time: '5 minutes to log, 10 minutes to exit',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with everything the page needs to re-rank it. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_pct: row.model.growth_pct,
    growth_multiplier: row.model.growth_multiplier,
    momentum_multiplier: row.model.momentum_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    discovery_multiplier: row.model.discovery_multiplier,
    patience_multiplier: row.model.patience_multiplier,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watch.has(r.slug)).length;
  const rankBySlug = new Map(board.map((r) => [r.slug, r.rank]));
  const movers: MoverRow[] = board
    .filter((r) => r.age_days !== null && r.age_days <= 365 && (r.change_7d ?? -999) > 0)
    .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, MOVER_ROWS)
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      age_days: r.age_days,
      implied_value_usd: r.implied_value_usd,
      rank: rankBySlug.get(r.slug) ?? 0,
    }));
  const fresh: FreshRow[] = board
    .filter((r) => r.age_days !== null && r.age_days <= 90)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .slice(0, FRESH_ROWS)
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      age_days: r.age_days,
      implied_value_usd: r.implied_value_usd,
      rank: rankBySlug.get(r.slug) ?? 0,
    }));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, watch)),
    live,
    movers,
    fresh,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
