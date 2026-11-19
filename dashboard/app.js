// Token Radar's dashboard (radar-3). It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a rank-1 spotlight, the early movers, a per-protocol
// detail view with the model's own inputs and the protocol's farm plan, and a model sandbox
// that re-ranks the board live. No network: every byte it shows is in data.js.
//
// The page mirrors lib/model.ts exactly: impliedOf is the radar-3 formula (base, growth,
// momentum tiers, maturity, discovery, patience) and farmSteps is the same eight-step
// derivation, so the numbers the page shows and the numbers board.json carries are the same
// arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = {
    q: '', chain: 'all', category: 'all', tab: 'pre-token', view: 'all',
    sort: 'implied', dir: -1, selected: null, minTvl: 0, growthOnly: false,
    shown: 60, baseMult: DATA.model.base_multiple, growthW: DATA.model.growth_weight
  };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // radar-3, as lib/model.ts scores it: base x growth x momentum x maturity x discovery x patience.
  function impliedOf(row, model) {
    var m = model || DATA.model;
    var raw = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, raw));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var momentum = raw >= m.momentum_strong_up ? m.momentum_strong
      : raw >= m.momentum_mild_up ? m.momentum_mild
      : raw <= m.momentum_strong_down ? 2 - m.momentum_strong
      : raw <= m.momentum_mild_down ? 2 - m.momentum_mild : 1;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var discovery = age < m.discovery_age_days && raw > m.discovery_growth ? m.discovery_mult : 1;
    var patience = age >= m.patience_age_days && row.tvl_usd >= DATA.floor_usd ? m.patience_mult : 1;
    return Math.max(1, Math.round(row.tvl_usd * m.base_multiple * growthMult * momentum * maturity * discovery * patience));
  }

  // The sandbox model: the two sliders a reader may move, everything else as scored.
  function sandboxModel() {
    var m = {};
    for (var k in DATA.model) m[k] = DATA.model[k];
    m.base_multiple = state.baseMult;
    m.growth_weight = state.growthW;
    return m;
  }
  function sandboxChanged() {
    return state.baseMult !== DATA.model.base_multiple || state.growthW !== DATA.model.growth_weight;
  }
  // Rows with the sandbox's implied values and ranks, strongest first.
  function rankedRows() {
    var m = sandboxModel();
    var list = DATA.rows.map(function (r) {
      return { row: r, implied: impliedOf(r, m) };
    });
    list.sort(function (a, b) { return b.implied - a.implied || (a.row.slug < b.row.slug ? -1 : 1); });
    list.forEach(function (x, i) { x.rank = i + 1; });
    return list;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 300;
    if (p.tvl_usd >= 1e9) return 200;
    if (p.tvl_usd >= 1e8) return 120;
    return 60;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 75;
    if (age < 365) return 60;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open, so the protocol records you as a lender.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield aggregator') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open through at least one fee cycle.';
    if (c.indexOf('yield') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s main yield vault on " + chain + ' and keep the shares until the hold ends.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then use the bridged funds inside its app instead of bridging straight back.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('liquid restaking') >= 0 || c.indexOf('restaked btc') >= 0 || c.indexOf('restaking') >= 0 || c.indexOf('staking') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and keep the receipt token in the same wallet.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trading') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position, then close it the same week.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' on ' + name + ' and place one market position on ' + chain + ', then settle it and keep the receipt.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('onchain capital') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares, so the vault records you as an allocator.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it in the farming wallet.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield-bearing asset on " + chain + ' through ' + name + ' and hold it for the full qualifying window.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active for the whole hold.';
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + ' and cast one vote or place one position on ' + name + ' so the wallet shows governance activity.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Spend $' + capital + ' through ' + name + ' on ' + chain + ' in two separate transactions a week apart, and keep both receipts.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold it for the full qualifying window.';
    if (c.indexOf('otc') >= 0 || c.indexOf('interest rate') >= 0) return 'Open a $' + capital + ' position on ' + name + ' on ' + chain + ' and hold it until the hold ends, then close it in one transaction.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open for the full qualifying window.';
  }
  function secondFeatureFor(p, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'Borrow $20 of USDC against the deposit on ' + name + ' on ' + chain + ' and repay it within 7 days.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0) return 'Swap $25 of USDC for the pool\u2019s other asset on ' + name + ' on ' + chain + ' and add it to the same position.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Claim or restake the staking rewards on ' + name + ' on ' + chain + ' once during the hold.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Close the hedge on ' + name + ' and open a second small one a week later, so the wallet shows two trading weeks.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $25 back through ' + name + ' after a week, so the wallet shows a round trip instead of a one-way move.';
    if (c.indexOf('governance') >= 0) return 'Vote once more on ' + name + ' during the hold, on a different proposal than the first vote.';
    return 'Use a second feature of ' + name + ' on ' + chain + ', such as a swap, a borrow or a vote, once during the hold.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var secondChain = p.chains && p.chains.length > 1 ? p.chains[1] : null;
    var spread = secondChain !== null
      ? 'Repeat a smaller position of $' + Math.max(25, Math.floor(capital / 2)) + ' on ' + secondChain + ' so the wallet shows activity on two chains.'
      : 'Add one second action type, such as a swap or a borrow, so the wallet shows more than one kind of activity.';
    var gas = capital >= 200 ? 8 : capital >= 120 ? 6 : 4;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: spread, cost: 'about $' + (secondChain !== null ? Math.max(25, Math.floor(capital / 2)) : 10) + ' of capital and $2 of gas', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never let two weeks pass with no activity.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: secondFeatureFor(p, chain), cost: 'about $25 of capital and $2 of gas', time: '10 minutes' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot, and halfway through open the protocol\u2019s own points page to confirm the wallet is being tracked.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, never from a link in a chat or an email.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, then unwind in one transaction and keep about $3 of the chain\u2019s gas token so the wallet can move again.', cost: 'about $3 of gas to exit', time: '5 minutes to log, 10 minutes to exit' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('view')) state.view = params.get('view');
    if (params.get('minTvl')) state.minTvl = parseInt(params.get('minTvl'), 10) || 0;
    if (params.get('growthOnly')) state.growthOnly = params.get('growthOnly') === '1';
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.view !== 'all') params.set('view', state.view);
    if (state.minTvl > 0) params.set('minTvl', String(state.minTvl));
    if (state.growthOnly) params.set('growthOnly', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var ranked = rankedRows();
    var q = state.q.trim().toLowerCase();
    return ranked.filter(function (x) {
      var r = x.row;
      if (state.view === 'watchlist' && !r.watchlist) return false;
      if (state.view === 'early' && r.watchlist) return false;
      if (state.view === 'movers' && !(r.age_days !== null && r.age_days <= 365 && (r.change_7d || 0) > 0)) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.minTvl > 0 && r.tvl_usd < state.minTvl) return false;
      if (state.growthOnly && !(r.change_7d !== null && r.change_7d > 0)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var ra = a.row, rb = b.row, av, bv;
      if (key === 'name') { av = ra.name.toLowerCase(); bv = rb.name.toLowerCase(); }
      else if (key === 'tvl') { av = ra.tvl_usd; bv = rb.tvl_usd; }
      else if (key === 'growth') { av = ra.change_7d === null ? -Infinity : ra.change_7d; bv = rb.change_7d === null ? -Infinity : rb.change_7d; }
      else if (key === 'age') { av = ra.age_days === null ? Infinity : ra.age_days; bv = rb.age_days === null ? Infinity : rb.age_days; }
      else { av = a.implied; bv = b.implied; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return ra.slug < rb.slug ? -1 : ra.slug > rb.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.board_size + ' pre-token protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' more pre-token protocols below that floor, so the board finds launches early instead of listing only the biggest names. Wrapped, staked and bridged products of tokens that already trade are left out: WBTC is Bitcoin on Ethereum, not a launch waiting to happen. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function spotlight() {
    var top = rankedRows()[0];
    if (!top) return null;
    var r = top.row;
    var why = (r.change_7d !== null && r.change_7d > 0 ? fmtPct(r.change_7d) + ' in 7 days' : 'steady TVL') +
      ' · ' + fmtAge(r.age_days) + ' with no token on record' +
      (r.watchlist ? ' · on the watchlist' : ' · found early, below the floor');
    return el('section', { class: 'spotlight', 'aria-label': 'Top pick' },
      el('div', null,
        el('h2', { text: 'Top pick — rank 1 of ' + DATA.board_size }),
        el('div', { class: 'pick', text: r.name }),
        el('p', { class: 'why', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.join(', ') : 'an unnamed chain') + ' — ' + why + '.' })
      ),
      el('div', { class: 'value' },
        el('b', { text: fmtUsd(top.implied) }),
        el('span', { text: 'implied value · ' + fmtUsd(r.tvl_usd) + ' TVL' })
      ),
      el('button', { class: 'button primary', type: 'button', text: 'See the farm plan', onclick: function () { openDetail(r.slug); } })
    );
  }

  function strip(title, items, valueFn) {
    if (!items || items.length === 0) return null;
    return el('section', { class: 'strip' },
      el('h2', { text: title }),
      el('div', { class: 'cards' }, items.slice(0, 4).map(function (r) {
        return el('button', { type: 'button', class: 'card', onclick: function () { openDetail(r.slug); } },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + fmtAge(r.age_days) + ' old' }),
          el('span', { class: 'val', text: valueFn(r) })
        );
      }))
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; state.shown = 60; writeHash(); render(); });
    var catSel = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSel.addEventListener('change', function () { state.category = catSel.value; state.shown = 60; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; state.shown = 60; writeHash(); render(); });
    var tvlSel = el('select', { id: 'minTvl', 'aria-label': 'Minimum TVL' },
      [[0, 'Any TVL'], [5e7, 'TVL $50M+'], [1e8, 'TVL $100M+'], [1e9, 'TVL $1B+']].map(function (pair) {
        return el('option', { value: String(pair[0]), text: pair[1], selected: pair[0] === state.minTvl ? 'selected' : null });
      })
    );
    tvlSel.addEventListener('change', function () { state.minTvl = parseInt(tvlSel.value, 10) || 0; state.shown = 60; writeHash(); render(); });
    var growthBox = el('input', { type: 'checkbox', id: 'growthOnly', checked: state.growthOnly ? 'checked' : null });
    growthBox.addEventListener('change', function () { state.growthOnly = growthBox.checked; state.shown = 60; writeHash(); render(); });
    var sortSel = el('select', { id: 'sort', 'aria-label': 'Sort the board' },
      ['implied', 'tvl', 'growth', 'age', 'name'].map(function (k) {
        return el('option', { value: k, text: { implied: 'Implied value', tvl: 'TVL', growth: '7d growth', age: 'Age', name: 'Name' }[k], selected: k === state.sort ? 'selected' : null });
      })
    );
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; render(); });
    function viewBtn(view, label) {
      return el('button', { type: 'button', 'aria-pressed': state.view === view ? 'true' : 'false', text: label, onclick: function () { state.view = view; state.shown = 60; writeHash(); render(); } });
    }
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    var shown = state.tab === 'pre-token' ? filteredRows().length + ' rows match' : DATA.live.length + ' live-token protocols';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('label', { for: 'minTvl', text: 'Minimum TVL' }), tvlSel),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Growth' }), el('label', { class: 'check', for: 'growthOnly' }, growthBox, document.createTextNode('Growing only (7d > 0)'))),
      el('div', { class: 'field' }, el('label', { for: 'sort', text: 'Sort by' }), sortSel),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'View' }), el('div', { class: 'tabs' }, viewBtn('all', 'All'), viewBtn('watchlist', 'Watchlist'), viewBtn('early', 'Early'), viewBtn('movers', 'Movers'))),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: shown })
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.view = 'all'; state.minTvl = 0; state.growthOnly = false; state.shown = 60; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied || 1;
    var shown = list.slice(0, state.shown);
    var tbody = el('tbody');
    shown.forEach(function (x) {
      var r = x.row;
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(x.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', null, document.createTextNode(r.name), r.watchlist ? el('span', { class: 'badge', text: 'WATCHLIST' }) : el('span', { class: 'badge early', text: 'EARLY' })),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((x.implied / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(x.implied) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    var note = 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' +
      (list.length > state.shown ? ' Showing the first ' + state.shown + ' of ' + list.length + ' matching rows.' : '') +
      (sandboxChanged() ? ' Re-ranked by your sandbox model.' : '');
    var panel = el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: note }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Rank' }),
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: '7d' }),
            el('th', { scope: 'col', text: 'Age' }),
            el('th', { scope: 'col', text: 'Implied value' }),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
    if (list.length > state.shown) {
      panel.appendChild(el('div', { class: 'more' },
        el('button', { class: 'button', type: 'button', text: 'Show 60 more (' + (list.length - state.shown) + ' left)', onclick: function () { state.shown += 60; render(); } })
      ));
    }
    return panel;
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x momentum x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x discovery x patience )'
      ),
      el('p', { class: 'sub', text: 'Momentum is ' + m.momentum_strong + ' at +' + m.momentum_strong_up + '% or more, ' + m.momentum_mild + ' at +' + m.momentum_mild_up + '%, ' + (2 - m.momentum_strong).toFixed(2) + ' at ' + m.momentum_strong_down + '% or less, ' + (2 - m.momentum_mild).toFixed(2) + ' at ' + m.momentum_mild_down + '%, else 1. Discovery is ' + m.discovery_mult + ' for a protocol under ' + m.discovery_age_days + ' days old growing more than +' + m.discovery_growth + '% in a week, else 1. Patience is ' + m.patience_mult + ' for a protocol at least ' + m.patience_age_days + ' days old with TVL at or above the $' + Math.round(DATA.floor_usd / 1e6) + 'M floor, else 1. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. The board says a protocol records no token, never that it has none.' })
    );
  }

  function sandboxPanel() {
    var m = DATA.model;
    function slider(id, label, min, max, step, value, oninput) {
      var out = el('output', { for: id, text: String(value) });
      var input = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step), value: String(value) });
      // 'change' fires when the slider is released: re-rendering on every 'input' would rebuild
      // the slider under the reader's pointer.
      input.addEventListener('change', function () { out.textContent = input.value; oninput(parseFloat(input.value)); });
      return el('div', null, el('label', { for: id }, label + ' ', out), input);
    }
    var reset = el('button', { class: 'button', type: 'button', text: 'Reset model', onclick: function () { state.baseMult = m.base_multiple; state.growthW = m.growth_weight; render(); } });
    return el('section', { class: 'panel sandbox' },
      el('h2', { text: 'Model sandbox' }),
      el('p', { class: 'sub', text: 'Move a slider and the board re-ranks with your numbers, using the same formula. The submitted board keeps the house model.' }),
      el('div', { class: 'sliders' },
        slider('sb-base', 'Base multiple (TVL x)', 0.05, 0.5, 0.01, state.baseMult, function (v) { state.baseMult = v; render(); }),
        slider('sb-growth', 'Growth weight', 0, 1.5, 0.05, state.growthW, function (v) { state.growthW = v; render(); }),
        reset
      ),
      el('p', { class: 'sandbox-note', text: sandboxChanged() ? 'Showing your sandbox ranking. Reset to return to the submitted board.' : 'Sliders at the submitted model.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var found = rankedRows().filter(function (x) { return x.row.slug === slug; })[0];
    if (!found) return;
    var row = found.row;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var check = impliedOf(row, DATA.model);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + found.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · Watchlist' : ' · Early') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Momentum multiplier' }), el('b', { class: 'num', text: String(row.momentum_multiplier) })),
        el('div', null, el('span', { text: 'Discovery multiplier' }), el('b', { class: 'num', text: String(row.discovery_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Patience multiplier' }), el('b', { class: 'num', text: String(row.patience_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(found.implied) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(check) + (check === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — 8 steps, each with its cost and time' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') {
      shell.appendChild(spotlight());
      shell.appendChild(strip('Early movers — young and growing fast', DATA.movers, function (r) { return fmtPct(r.change_7d) + ' in 7d · ' + fmtUsd(r.implied_value_usd) + ' implied'; }));
      shell.appendChild(strip('New listings — listed in the last 90 days', DATA.fresh, function (r) { return fmtAge(r.age_days) + ' old · ' + fmtUsd(r.tvl_usd) + ' TVL'; }));
    }
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      shell.appendChild(modelPanel());
      shell.appendChild(sandboxPanel());
    }
    shell.appendChild(el('p', { class: 'foot', text: 'Source: ' + DATA.source + '. The snapshot is frozen: it does not move and is not updated. A protocol on this board records no token; that is DefiLlama\u2019s record, not proof it has none. Implied values are this radar\u2019s own estimates.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
