/* =====================================================================
 *  Smart Income Tax Calculator — UI layer
 *  Reads rules from tax-rules.js, calculates with engine.js.
 * ===================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const PRESETS = window.TAX_PRESETS;
  const CATS = window.TAXPAYER_CATEGORIES;
  const AREAS = window.TAX_AREAS;
  const INVEST = window.INVESTMENT_TYPES;
  const MONTHS = window.MONTHS_BN;
  const DEFAULTS = window.DEFAULT_INPUTS;
  const KEY = { inputs: 'sitc.inputs.v2', rules: 'sitc.rules.v2', history: 'sitc.history.v2', theme: 'sitc.theme', view: 'sitc.view' };

  /* ---------------- storage (never throws) ---------------- */
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ---------------- formatting ---------------- */
  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const bn = (s) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
  const fmt = (n) => bn(Math.round(Number(n) || 0).toLocaleString('en-IN'));
  const tk = (n) => '৳ ' + fmt(n);
  const pct = (n, d = 1) => bn((Math.round((Number(n) || 0) * 10 ** d) / 10 ** d).toString()) + '%';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** 425000 -> "৪ লাখ ২৫ হাজার টাকা" */
  function words(n) {
    n = Math.round(Number(n) || 0);
    if (n <= 0) return '';
    const crore = Math.floor(n / 1e7);
    const lakh = Math.floor((n % 1e7) / 1e5);
    const th = Math.floor((n % 1e5) / 1e3);
    const rest = n % 1e3;
    const parts = [];
    if (crore) parts.push(bn(crore) + ' কোটি');
    if (lakh) parts.push(bn(lakh) + ' লাখ');
    if (th) parts.push(bn(th) + ' হাজার');
    if (rest) parts.push(bn(rest));
    return parts.join(' ') + ' টাকা';
  }

  const BAND_COLORS = ['--band-0', '--band-1', '--band-2', '--band-3', '--band-4', '--band-5', '--band-6'];
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function bandColor(rate, maxRate) {
    if (rate <= 0) return cssVar('--band-0');
    const steps = BAND_COLORS.length - 1;
    const idx = Math.max(1, Math.min(steps, Math.ceil((rate / Math.max(maxRate, 1)) * steps)));
    return cssVar(BAND_COLORS[idx]);
  }

  /* ---------------- state ---------------- */
  let inputs = Object.assign({}, DEFAULTS, store.get(KEY.inputs, {}));
  let customRules = store.get(KEY.rules, {});
  if (!PRESETS.some((p) => p.id === inputs.presetId)) inputs.presetId = DEFAULTS.presetId;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];
  function rulesFor(id) {
    const base = clone(presetById(id));
    const custom = customRules[id];
    return custom ? Object.assign(base, clone(custom), { id: base.id, label: base.label, isCustom: true }) : base;
  }
  const currentRules = () => rulesFor(inputs.presetId);

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------------- theme ---------------- */
  const THEMES = ['auto', 'light', 'dark'];
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    $('themeBtn').textContent = t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🌓';
    $('themeBtn').title = 'থিম: ' + (t === 'light' ? 'লাইট' : t === 'dark' ? 'ডার্ক' : 'সিস্টেম অনুযায়ী');
  }
  let theme = store.get(KEY.theme, 'auto');
  applyTheme(theme);
  $('themeBtn').addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    store.set(KEY.theme, theme);
    applyTheme(theme);
    recalc();
    toast($('themeBtn').title);
  });
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => recalc());
  }

  /* ---------------- tabs ---------------- */
  function showView(name) {
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === name)));
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
    store.set(KEY.view, name);
    if (name === 'guide') renderGuide();
    if (name === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

  /* ---------------- build form ---------------- */
  function fillSelect(el, items, getVal, getLabel) {
    el.innerHTML = items.map((it) => `<option value="${esc(getVal(it))}">${esc(getLabel(it))}</option>`).join('');
  }
  function buildForm() {
    fillSelect($('presetId'), PRESETS, (p) => p.id, (p) => p.label + (p.current ? ' — চলতি' : '') + (customRules[p.id] ? ' (কাস্টম)' : ''));
    fillSelect($('category'), CATS, (c) => c.key, (c) => c.label);
    fillSelect($('area'), AREAS, (a) => a.key, (a) => a.label);
    const monthOpts = MONTHS.map((m, i) => ({ v: i, l: m }));
    fillSelect($('incrementMonth'), [{ v: -1, l: 'ইনক্রিমেন্ট নেই' }].concat(monthOpts.slice(1)), (o) => o.v, (o) => o.l);
    fillSelect($('festivalBonusMonth'), monthOpts, (o) => o.v, (o) => o.l);
    fillSelect($('otherBonusMonth'), monthOpts, (o) => o.v, (o) => o.l);

    $('investFields').innerHTML = INVEST.map((t) => `
      <div class="field">
        <label for="inv_${t.key}">${esc(t.label)}</label>
        <div class="money"><input id="inv_${t.key}" type="number" min="0" step="100" inputmode="decimal" /></div>
        <div class="hint" id="hint_inv_${t.key}">${esc(t.hint || '')}</div>
      </div>`).join('');
  }

  const NUMERIC = Object.keys(DEFAULTS).filter((k) => typeof DEFAULTS[k] === 'number');

  function writeForm() {
    Object.keys(DEFAULTS).forEach((k) => {
      const el = $(k);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!inputs[k];
      else el.value = inputs[k];
    });
    document.querySelectorAll('#pfBaseSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === inputs.pfBase)));
    syncVisibility();
  }

  function syncVisibility() {
    $('grossAfterField').style.opacity = Number(inputs.incrementMonth) < 0 ? '.45' : '1';
    $('grossAfter').disabled = Number(inputs.incrementMonth) < 0;
    $('basicPctField').hidden = inputs.pfBase !== 'basic';
    document.querySelectorAll('[data-words]').forEach((h) => { h.textContent = words(inputs[h.dataset.words]); });
  }

  function bindForm() {
    Object.keys(DEFAULTS).forEach((k) => {
      const el = $(k);
      if (!el) return;
      const handler = () => {
        if (el.type === 'checkbox') inputs[k] = el.checked;
        else if (NUMERIC.includes(k)) inputs[k] = el.value === '' ? 0 : Number(el.value);
        else inputs[k] = el.value;
        store.set(KEY.inputs, inputs);
        syncVisibility();
        scheduleRecalc();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    document.querySelectorAll('#pfBaseSeg button').forEach((b) => b.addEventListener('click', () => {
      inputs.pfBase = b.dataset.val;
      store.set(KEY.inputs, inputs);
      writeForm();
      recalc();
    }));
  }

  /* ---------------- calculation + render ---------------- */
  let timer;
  function scheduleRecalc() { clearTimeout(timer); timer = setTimeout(recalc, 120); }

  let last = null;
  function recalc() {
    const rules = currentRules();
    const r = window.TaxEngine.compute(inputs, rules);
    last = { r, rules };
    renderHeader(rules);
    renderHero(r, rules);
    renderFlow(r, rules);
    renderSlabs(r, rules);
    renderRebate(r, rules);
    renderMonths(r);
    renderChart(r);
    if (!$('view-guide').hidden) renderGuide();
  }

  function catLabel(key) { const c = CATS.find((x) => x.key === key); return c ? c.label : key; }

  function renderHeader(rules) {
    const p = presetById(rules.id);
    $('brandSub').textContent = 'বাংলাদেশ · ' + p.label;
    $('presetHint').textContent = `${p.incomeYear} · ${p.source}` + (rules.isCustom ? ' · আপনার কাস্টম মান' : '');
    $('ruleBadge').textContent = 'করবর্ষ ' + p.assessmentYear + (rules.isCustom ? ' · কাস্টম' : '');
    const th = window.TaxEngine.thresholdFor(rules, inputs.category, inputs.disabledChildren);
    $('categoryHint').innerHTML = `করমুক্ত আয়সীমা: <strong>${tk(th)}</strong>` +
      ((rules.verify || []).includes(inputs.category) ? ' <span class="badge" title="গেজেটের সঙ্গে মিলিয়ে নিন">যাচাই করুন</span>' : '');
    const dps = (rules.investmentCaps || {}).dps;
    const h = $('hint_inv_dps');
    if (h && dps) h.textContent = `বছরে সর্বোচ্চ ${tk(dps)} পর্যন্ত গণনা হয়`;
  }

  function renderHero(r) {
    const status = !r.taxPaid ? 'বছরে মোট প্রদেয়' : r.balanceDue > 0 ? `রিটার্নে বাকি ${tk(r.balanceDue)}` : r.refund > 0 ? `ফেরতযোগ্য ${tk(r.refund)}` : 'পুরো কর পরিশোধিত';
    $('hero').innerHTML = `
      <div class="stat primary"><div class="k">নিট প্রদেয় কর</div><div class="v">${tk(r.netTax)}</div><div class="s">${status}</div></div>
      <div class="stat"><div class="k">মাসে গড়ে</div><div class="v">${tk(r.monthlyAverage)}</div><div class="s">১২ মাসে ভাগ করলে</div></div>
      <div class="stat"><div class="k">কার্যকর করহার</div><div class="v">${pct(r.effectiveRate, 2)}</div><div class="s">সর্বোচ্চ ধাপ ${pct(r.marginalRate, 0)}</div></div>
      <div class="stat"><div class="k">করযোগ্য আয়</div><div class="v">${tk(r.taxableIncome)}</div><div class="s">মোট আয় ${tk(r.totalIncome)}</div></div>`;
  }

  function li(label, value, cls = '', sub = '') {
    return `<li class="${cls}"><span class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="val">${value}</span></li>`;
  }

  function renderFlow(r, rules) {
    const ex = rules.salaryExemption;
    const rows = [
      li('বার্ষিক মূল বেতন', tk(r.salaryGross), '', 'ইনক্রিমেন্টসহ ১২ মাস'),
      li('বোনাস ও উৎসব ভাতা', tk(r.bonusTotal)),
      li('নিয়োগকর্তার PF অংশ', tk(r.employerPF), '', 'বেতন আয়ের অংশ হিসেবে গণ্য'),
      li('= মোট বেতন আয়', tk(r.salaryIncome)),
      li('− বেতন আয়ের অব্যাহতি', '− ' + tk(r.exemption), 'minus', `মোট বেতনের ১/${bn(ex.divisor)} অথবা ${tk(ex.cap)}, যেটি কম`),
      r.otherIncome ? li('+ অন্যান্য আয়', tk(r.otherIncome)) : '',
      li('= করযোগ্য আয়', tk(r.taxableIncome), 'total'),
      li('স্ল্যাব অনুযায়ী কর', tk(r.grossTax), '', `করমুক্ত সীমা ${tk(r.threshold)} বাদে`),
      li('− বিনিয়োগ কর রেয়াত', '− ' + tk(r.rebate), 'minus'),
      r.minimumApplied ? li('ন্যূনতম কর প্রযোজ্য', tk(r.minimumTax), '', 'রেয়াতের পর কর ন্যূনতমের কম হওয়ায়') : '',
      li('= নিট প্রদেয় কর', tk(r.netTax), 'total'),
      r.taxPaid ? li('− ইতিমধ্যে পরিশোধিত', '− ' + tk(r.taxPaid), 'minus') : '',
      r.taxPaid ? li(r.refund > 0 ? '= ফেরতযোগ্য' : '= রিটার্নে পরিশোধ করতে হবে', tk(r.refund > 0 ? r.refund : r.balanceDue), 'total') : ''
    ];
    $('flow').innerHTML = rows.join('');

    const notes = [];
    if (r.taxableIncome <= r.threshold) {
      notes.push(`<div class="note good">✅ আপনার করযোগ্য আয় করমুক্ত সীমার (${tk(r.threshold)}) মধ্যে — <strong>কোনো কর দিতে হবে না</strong>। তবে TIN থাকলে রিটার্ন জমা দিতে হবে (শূন্য করের রিটার্ন)।</div>`);
    }
    if (r.minimumApplied) {
      notes.push(`<div class="note info">ℹ️ রেয়াতের পর আপনার কর ${tk(r.taxAfterRebate)} — যা ন্যূনতম করের চেয়ে কম। তাই ন্যূনতম কর <strong>${tk(r.minimumTax)}</strong> দিতে হবে।</div>`);
    }
    if ((rules.verify || []).includes(inputs.category)) {
      notes.push(`<div class="note warn">⚠️ “${esc(catLabel(inputs.category))}” শ্রেণির করমুক্ত সীমা (${tk(rules.thresholds[inputs.category])}) এই আয়বর্ষের গেজেটের সঙ্গে মিলিয়ে নিন। ভিন্ন হলে ⚙️ সেটিংস থেকে এক ক্লিকে বদলাতে পারবেন।</div>`);
    }
    $('flowNotes').innerHTML = notes.join('');
  }

  function bandLabel(row, i) {
    if (row.isFree) return `প্রথম ${tk(row.width)}`;
    if (row.width == null) return 'বাকি সব আয়';
    return `${i === 1 ? 'পরবর্তী' : 'পরবর্তী'} ${tk(row.width)}`;
  }
  function bandRange(row) {
    const from = row.from === 0 ? 0 : row.from + 1;
    return row.to === Infinity ? `${fmt(from)} টাকার উপরে` : `${fmt(from)} – ${fmt(row.to)}`;
  }

  function renderSlabs(r) {
    const maxRate = Math.max(...r.slabRows.map((x) => x.rate));
    const total = Math.max(1, r.taxableIncome);
    $('bandbar').innerHTML = r.slabRows.filter((x) => x.taxed > 0)
      .map((x) => `<span style="width:${(x.taxed / total) * 100}%;background:${bandColor(x.rate, maxRate)}" title="${pct(x.rate, 0)}: ${tk(x.taxed)}"></span>`).join('');
    $('bandLegend').innerHTML = r.slabRows.filter((x) => x.taxed > 0)
      .map((x) => `<span><i style="background:${bandColor(x.rate, maxRate)}"></i>${pct(x.rate, 0)} — ${tk(x.taxed)}</span>`).join('');

    const tb = $('slabTable').querySelector('tbody');
    tb.innerHTML = r.slabRows.map((x, i) => `
      <tr class="${x.taxed > 0 ? 'active-band' : 'inactive'}">
        <td>${bandLabel(x, i)}<div class="sub">${bandRange(x)}</div></td>
        <td class="r"><span class="rate-pill" style="background:${bandColor(x.rate, maxRate)}">${pct(x.rate, 0)}</span></td>
        <td class="r">${x.taxed > 0 ? tk(x.taxed) : '—'}</td>
        <td class="r">${x.taxed > 0 ? tk(x.tax) : '—'}</td>
      </tr>`).join('');
    $('slabTable').querySelector('tfoot').innerHTML =
      `<tr><td>মোট</td><td></td><td class="r">${tk(r.taxableIncome)}</td><td class="r">${tk(r.grossTax)}</td></tr>`;
  }

  function renderRebate(r, rules) {
    const rb = rules.rebate;
    const win = r.rebateLimitedBy;
    const cand = (key, label, val) => li((win === key ? '✔ ' : '') + label, tk(val), win === key ? 'total' : '');
    let html = `<div class="formula">রেয়াত = সর্বনিম্ন ( করযোগ্য আয়ের ${pct(rb.incomePct, 0)}, যোগ্য বিনিয়োগের ${pct(rb.investPct, 0)}, ${tk(rb.cap)} )</div>
      <ul class="flow">
        ${cand('income', `করযোগ্য আয়ের ${pct(rb.incomePct, 0)}`, r.rebateByIncome)}
        ${cand('invest', `যোগ্য বিনিয়োগের ${pct(rb.investPct, 0)}`, r.rebateByInvest)}
        ${cand('cap', 'সর্বোচ্চ সীমা', r.rebateCap)}
      </ul>`;

    const rows = r.investRows.filter((x) => x.entered > 0).map((x) =>
      `<tr><td>${esc(x.label)}</td><td class="r">${tk(x.entered)}</td><td class="r">${tk(x.counted)}${x.cap != null && x.entered > x.cap ? ' <span class="badge">সীমা</span>' : ''}</td></tr>`);
    if (r.pfInvest > 0) rows.push(`<tr><td>প্রভিডেন্ট ফান্ড (দুই অংশ)</td><td class="r">${tk(r.pfInvest)}</td><td class="r">${tk(r.pfInvest)}</td></tr>`);
    html += `<div class="table-wrap" style="margin-top:12px"><table>
      <thead><tr><th>বিনিয়োগ খাত</th><th class="r">জমা</th><th class="r">গণনাযোগ্য</th></tr></thead>
      <tbody>${rows.join('') || '<tr><td colspan="3" class="sub">এখনো কোনো বিনিয়োগ নেই</td></tr>'}</tbody>
      <tfoot><tr><td>মোট যোগ্য বিনিয়োগ</td><td></td><td class="r">${tk(r.eligibleInvest)}</td></tr></tfoot></table></div>`;

    if (r.grossTax <= 0) {
      html += `<div class="note good">✅ আপনার কোনো কর নেই, তাই বিনিয়োগ রেয়াতের প্রয়োজন নেই।</div>`;
    } else if (r.investShortfall > 0 && r.potentialSaving > 0) {
      html += `<div class="note warn">💡 পূর্ণ রেয়াত (${tk(r.maxRebate)}) পেতে মোট <strong>${tk(r.investForMaxRebate)}</strong> বিনিয়োগ দরকার।
        আরও <strong>${tk(r.investShortfall)}</strong> বিনিয়োগ করলে আরও প্রায় <strong>${tk(r.potentialSaving)}</strong> কর বাঁচবে।
        <div class="sub" style="margin-top:4px">${words(r.investShortfall)} · আয়বর্ষ শেষ হওয়ার (৩০ জুন) আগে বিনিয়োগ করতে হবে</div></div>`;
    } else if (r.minimumApplied) {
      html += `<div class="note info">ℹ️ ন্যূনতম কর প্রযোজ্য হওয়ায় আরও বিনিয়োগে কর কমবে না।</div>`;
    } else {
      html += `<div class="note good">✅ আপনি পূর্ণ রেয়াত পাচ্ছেন। এর বেশি বিনিয়োগে কর আর কমবে না।</div>`;
    }
    $('rebateBox').innerHTML = html;
  }

  function renderMonths(r) {
    $('monthTable').querySelector('tbody').innerHTML = r.months.map((m) => `
      <tr><td>${MONTHS[m.index]}</td><td class="r">${fmt(m.gross)}</td><td class="r">${m.bonus ? fmt(m.bonus) : '—'}</td>
      <td class="r">${fmt(m.employeePF)}</td><td class="r">${fmt(m.employerPF)}</td><td class="r">${fmt(m.tax)}</td><td class="r"><strong>${fmt(m.net)}</strong></td></tr>`).join('');
    const t = r.totals;
    $('monthTable').querySelector('tfoot').innerHTML = `<tr><td>মোট</td><td class="r">${fmt(t.gross)}</td><td class="r">${fmt(t.bonus)}</td>
      <td class="r">${fmt(t.employeePF)}</td><td class="r">${fmt(t.employerPF)}</td><td class="r">${fmt(t.tax)}</td><td class="r">${fmt(t.net)}</td></tr>`;
  }

  function renderChart(r) {
    const svg = $('chart');
    const W = 760, H = 260, P = { l: 56, r: 10, t: 12, b: 28 };
    const cw = W - P.l - P.r, ch = H - P.t - P.b;
    const series = [
      { key: 'net', label: 'হাতে পাবেন', color: cssVar('--chart-net') },
      { key: 'employeePF', label: 'PF (আপনার)', color: cssVar('--chart-pf') },
      { key: 'tax', label: 'আয়কর', color: cssVar('--chart-tax') }
    ];
    const max = Math.max(1, ...r.months.map((m) => m.gross + m.bonus));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    let out = '';
    for (let v = 0; v <= top + 1; v += step) {
      const y = P.t + ch - (v / top) * ch;
      out += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" />`;
      out += `<text x="${P.l - 8}" y="${y + 4}" text-anchor="end">${shortNum(v)}</text>`;
    }
    const gw = cw / 12, bw = Math.min(34, gw * 0.62);
    r.months.forEach((m, i) => {
      let y = P.t + ch;
      const x = P.l + i * gw + (gw - bw) / 2;
      const tip = `${MONTHS[i]}: হাতে ${tk(m.net)}, PF ${tk(m.employeePF)}, কর ${tk(m.tax)}`;
      out += `<g><title>${tip}</title>`;
      series.forEach((s) => {
        const h = (Math.max(0, m[s.key]) / top) * ch;
        y -= h;
        if (h > 0) out += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${s.color}" />`;
      });
      out += `</g><text x="${x + bw / 2}" y="${H - 9}" text-anchor="middle">${MONTHS[i].slice(0, 3)}</text>`;
    });
    svg.innerHTML = out;
    $('chartLegend').innerHTML = series.map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('');
  }
  function niceStep(x) {
    const p = 10 ** Math.floor(Math.log10(Math.max(1, x)));
    const f = x / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function shortNum(v) {
    if (v >= 1e7) return bn(+(v / 1e7).toFixed(1)) + ' কো';
    if (v >= 1e5) return bn(+(v / 1e5).toFixed(1)) + ' লা';
    if (v >= 1e3) return bn(Math.round(v / 1e3)) + ' হা';
    return bn(v);
  }

  /* ---------------- guide ---------------- */
  function slabRowsForGuide(rules, threshold) {
    const bands = window.TaxEngine.buildBands(rules, threshold);
    let lower = 0;
    return bands.map((b, i) => {
      const upper = b.width == null ? Infinity : lower + b.width;
      const row = { label: b.isFree ? `প্রথম ${tk(b.width)}` : b.width == null ? 'বাকি সব আয়' : `পরবর্তী ${tk(b.width)}`, range: bandRange({ from: lower, to: upper }), rate: b.rate, maxTax: b.width == null ? null : (b.width * b.rate) / 100, cumTax: 0 };
      lower = upper;
      return row;
    }).map((row, i, arr) => { row.cumTax = arr.slice(0, i + 1).reduce((a, x) => a + (x.maxTax || 0), 0); return row; });
  }

  function renderGuide() {
    const rules = currentRules();
    const p = presetById(rules.id);
    const general = rules.thresholds.general;
    const maxRate = Math.max(...rules.slabs.map((s) => Number(s.rate)));
    const rows = slabRowsForGuide(rules, general);
    const ex = rules.salaryExemption, rb = rules.rebate, mt = rules.minimumTax;
    const verify = rules.verify || [];

    // Worked example: monthly gross 1 lakh, no bonus
    const exInputs = Object.assign({}, DEFAULTS, { category: 'general', grossBefore: 100000, incrementMonth: -1, festivalBonus: 0, otherBonus: 0, employerPfPct: 0, employeePfPct: 0, pfCountsAsInvestment: false, otherIncome: 0, inv_dps: 120000, inv_sanchay: 0, inv_shares: 0, inv_insurance: 0, inv_other: 0, taxPaid: 0, disabledChildren: 0 });
    const e = window.TaxEngine.compute(exInputs, rules);

    const compare = PRESETS.map((pr) => {
      const rr = rulesFor(pr.id);
      return `<tr${pr.id === rules.id ? ' class="active-band"' : ''}><td>${esc(pr.shortLabel)}${pr.current ? ' <span class="badge green">চলতি</span>' : ''}</td>
        <td class="r">${tk(rr.thresholds.general)}</td><td class="r">${tk(rr.thresholds.women)}</td>
        <td class="r">${pct(rr.slabs[0].rate, 0)}</td><td class="r">${pct(rr.slabs[rr.slabs.length - 1].rate, 0)}</td></tr>`;
    }).join('');

    $('guideRoot').innerHTML = `
      <div class="guide-hero">
        <h2>বাংলাদেশের আয়কর নিয়ম — ${esc(p.label)}</h2>
        <p>${esc(p.incomeYear)} সময়ের আয়ের উপর · ভিত্তি: ${esc(p.source)}${rules.isCustom ? ' · (আপনার কাস্টম মান দেখানো হচ্ছে)' : ''}</p>
        <div class="chips">
          <span class="chip">করমুক্ত সীমা ${tk(general)} থেকে</span>
          <span class="chip">কর ${pct(rules.slabs[0].rate, 0)} – ${pct(maxRate, 0)}</span>
          <span class="chip">রেয়াত সর্বোচ্চ ${tk(rb.cap)}</span>
          <span class="chip">রিটার্নের শেষ তারিখ ${esc(p.returnDeadline)}</span>
        </div>
      </div>

      ${(p.notes && p.notes.length) ? `<div class="card"><h3>🆕 এই বছরে যা নতুন / গুরুত্বপূর্ণ</h3><ul>${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}

      <div class="card">
        <h3>১. করমুক্ত আয়সীমা — কে কত টাকা পর্যন্ত কর দেবেন না</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>করদাতার শ্রেণি</th><th class="r">করমুক্ত আয়সীমা</th></tr></thead>
          <tbody>${CATS.map((c) => `<tr${c.key === inputs.category ? ' class="active-band"' : ''}><td>${esc(c.label)}${c.key === inputs.category ? ' <span class="badge green">আপনি</span>' : ''}</td>
            <td class="r">${tk(rules.thresholds[c.key])}${verify.includes(c.key) ? ' <span class="badge">যাচাই করুন</span>' : ''}<div class="sub">${words(rules.thresholds[c.key])}</div></td></tr>`).join('')}
            <tr><td>প্রতিবন্ধী সন্তানের পিতা/মাতা/আইনগত অভিভাবক</td><td class="r">প্রতি সন্তানে অতিরিক্ত ${tk(rules.disabledChildBonus)}</td></tr>
          </tbody></table></div>
        <p class="sub">প্রতিবন্ধী সন্তানের এই অতিরিক্ত ছাড় বাবা-মা দুজনেই করদাতা হলে যেকোনো একজন পাবেন।</p>
      </div>

      <div class="card">
        <h3>২. করহার — প্রতিটি স্ল্যাবে কত শতাংশ কর</h3>
        <p>কর ধাপে ধাপে হিসাব হয়: আয়ের প্রথম অংশে কোনো কর নেই, এরপর প্রতিটি ধাপের টাকার উপর শুধু সেই ধাপের হার প্রযোজ্য। নিচের টেবিলটি সাধারণ করদাতার জন্য; অন্য শ্রেণির ক্ষেত্রে শুধু প্রথম (করমুক্ত) ধাপটি বড় হয়, বাকি ধাপ একই।</p>
        <div class="table-wrap"><table>
          <thead><tr><th>আয়ের ধাপ</th><th>আয়ের পরিসর (টাকা)</th><th class="r">হার</th><th class="r">এই ধাপে সর্বোচ্চ কর</th><th class="r">এ পর্যন্ত মোট কর</th></tr></thead>
          <tbody>${rows.map((x) => `<tr><td>${x.label}</td><td>${x.range}</td>
            <td class="r"><span class="rate-pill" style="background:${bandColor(x.rate, maxRate)}">${pct(x.rate, 0)}</span></td>
            <td class="r">${x.maxTax == null ? '—' : tk(x.maxTax)}</td><td class="r">${x.maxTax == null ? '—' : tk(x.cumTax)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="card">
        <h3>৩. বেতনভোগীদের অব্যাহতি</h3>
        <p>বেতন থেকে আসা মোট আয়ের <strong>১/${bn(ex.divisor)} অংশ</strong> অথবা <strong>${tk(ex.cap)}</strong> — যেটি কম, সেই পরিমাণ আয় করমুক্ত। এটি বাদ দেওয়ার পরের অংশই করযোগ্য। বাড়িভাড়া, চিকিৎসা, যাতায়াত ভাতার আলাদা অব্যাহতি এখন আর নেই — সবগুলো এই একটি অব্যাহতির মধ্যে।</p>
        <div class="formula">অব্যাহতি = সর্বনিম্ন ( মোট বেতন আয় ÷ ${bn(ex.divisor)}, ${tk(ex.cap)} )</div>
        <ul>
          <li>মোট বেতন আয়ে মূল বেতন, সব ভাতা, উৎসব ভাতা, বোনাস এবং স্বীকৃত PF-এ নিয়োগকর্তার অংশ যোগ হয়।</li>
          <li>বার্ষিক বেতন আয় ${tk(ex.cap * ex.divisor)} ছাড়ালে অব্যাহতি সর্বোচ্চ ${tk(ex.cap)}-এ আটকে যায়।</li>
        </ul>
      </div>

      <div class="card">
        <h3>৪. বিনিয়োগ কর রেয়াত — কত লাখ পর্যন্ত ছাড়</h3>
        <p>নির্দিষ্ট খাতে বিনিয়োগ করলে হিসাব করা কর থেকে সরাসরি একটি অংশ বাদ যায় (রেয়াত)। রেয়াত হবে নিচের তিনটির মধ্যে <strong>যেটি সবচেয়ে কম</strong>:</p>
        <div class="formula">
          ক) করযোগ্য আয়ের ${pct(rb.incomePct, 0)}<br>
          খ) প্রকৃত যোগ্য বিনিয়োগের ${pct(rb.investPct, 0)}<br>
          গ) ${tk(rb.cap)} (${words(rb.cap)})
        </div>
        <p><strong>সহজ নিয়ম:</strong> করযোগ্য আয়ের প্রায় ${pct((rb.incomePct / rb.investPct) * 100, 0)} বিনিয়োগ করলে পূর্ণ রেয়াত পাওয়া যায়। এর বেশি বিনিয়োগে কর আর কমে না। সর্বোচ্চ রেয়াত ${tk(rb.cap)} পেতে বিনিয়োগ লাগে ${tk((rb.cap * 100) / rb.investPct)}।</p>
        <div class="two-col">
          <div>
            <strong>যোগ্য বিনিয়োগ খাত</strong>
            <ul>${INVEST.map((t) => `<li>${esc(t.label)}${t.capKey && rules.investmentCaps[t.capKey] ? ` — বছরে সর্বোচ্চ ${tk(rules.investmentCaps[t.capKey])}` : ''}<div class="sub">${esc(t.hint || '')}</div></li>`).join('')}
              <li>স্বীকৃত প্রভিডেন্ট ফান্ডে নিজের ও নিয়োগকর্তার অংশ</li>
              <li>অনুমোদিত সুপারঅ্যানুয়েশন / গ্র্যাচুইটি ফান্ডে জমা</li></ul>
          </div>
          <div>
            <strong>খেয়াল রাখুন</strong>
            <ul>
              <li>বিনিয়োগ একই আয়বর্ষে (১ জুলাই – ৩০ জুন) করতে হবে।</li>
              <li>বিনিয়োগের প্রমাণপত্র (সার্টিফিকেট, ব্যাংক স্টেটমেন্ট) রিটার্নের সঙ্গে রাখুন।</li>
              <li>রেয়াত দিয়ে কর ন্যূনতম করের নিচে নামানো যায় না।</li>
              <li>বিনিয়োগের টাকা বৈধ ও প্রদর্শিত উৎস থেকে হতে হবে।</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>৫. ন্যূনতম কর</h3>
        <p>করযোগ্য আয় করমুক্ত সীমা ছাড়ালে, রেয়াতের পর হিসাব যত কমই আসুক, অন্তত নিচের পরিমাণ কর দিতে হবে:</p>
        <div class="table-wrap"><table><thead><tr><th>এলাকা</th><th class="r">ন্যূনতম কর</th></tr></thead>
          <tbody>${AREAS.map((a) => `<tr><td>${esc(a.label)}</td><td class="r">${tk(mt[a.key])}</td></tr>`).join('')}</tbody></table></div>
      </div>

      <div class="card">
        <h3>৬. উদাহরণ — মাসিক বেতন ১ লাখ টাকা</h3>
        <p class="sub">সাধারণ করদাতা, বোনাস ও PF ছাড়া, ডিপিএসে বছরে ${tk(120000)} জমা</p>
        <ul class="flow">
          ${li('বার্ষিক বেতন আয়', tk(e.salaryIncome))}
          ${li('− অব্যাহতি', '− ' + tk(e.exemption), 'minus')}
          ${li('= করযোগ্য আয়', tk(e.taxableIncome), 'total')}
          ${e.slabRows.filter((x) => x.taxed > 0).map((x) => li(`${tk(x.taxed)} × ${pct(x.rate, 0)}`, tk(x.tax))).join('')}
          ${li('= মোট কর', tk(e.grossTax))}
          ${li('− বিনিয়োগ রেয়াত', '− ' + tk(e.rebate), 'minus', `সর্বনিম্ন(${tk(e.rebateByIncome)}, ${tk(e.rebateByInvest)}, ${tk(e.rebateCap)})`)}
          ${li('= নিট কর', tk(e.netTax), 'total', `মাসে প্রায় ${tk(e.netTax / 12)}`)}
        </ul>
      </div>

      <div class="card">
        <h3>৭. রিটার্ন জমা ও অন্যান্য জরুরি তথ্য</h3>
        <ul>
          <li><strong>রিটার্ন জমার শেষ তারিখ (কর দিবস):</strong> ${esc(p.returnDeadline)}। দেরিতে জমা দিলে জরিমানা ও বিলম্ব সুদ লাগতে পারে।</li>
          <li><strong>কারা রিটার্ন দেবেন:</strong> যাঁদের আয় করমুক্ত সীমা ছাড়ায়, এবং যাঁদের TIN আছে — আয় সীমার নিচে হলেও।</li>
          <li><strong>রিটার্ন জমার প্রমাণ (PSR):</strong> ব্যাংক ঋণ, ক্রেডিট কার্ড, সঞ্চয়পত্র কেনা, ট্রেড লাইসেন্স ইত্যাদি বহু সেবায় লাগে।</li>
          <li><strong>অনলাইন রিটার্ন:</strong> NBR-এর ই-রিটার্ন সিস্টেম (etaxnbr.gov.bd) থেকে ঘরে বসেই জমা দেওয়া যায়।</li>
          <li><strong>সম্পদের উপর সারচার্জ:</strong> নিট সম্পদ ৪ কোটি টাকা ছাড়ালে প্রদেয় করের উপর অতিরিক্ত ১০%–৩৫% সারচার্জ প্রযোজ্য (সম্পদের পরিমাণ অনুযায়ী)।</li>
        </ul>
      </div>

      <div class="card">
        <h3>৮. বছর অনুযায়ী তুলনা</h3>
        <div class="table-wrap"><table><thead><tr><th>আয়বর্ষ</th><th class="r">সাধারণ সীমা</th><th class="r">নারী/প্রবীণ</th><th class="r">প্রথম ধাপ</th><th class="r">সর্বোচ্চ হার</th></tr></thead>
          <tbody>${compare}</tbody></table></div>
      </div>

      <div class="note warn">⚠️ এই গাইড সাধারণ ধারণার জন্য। আইন ও প্রজ্ঞাপন পরিবর্তন হতে পারে — চূড়ান্ত তথ্যের জন্য <strong>জাতীয় রাজস্ব বোর্ড (nbr.gov.bd)</strong>-এর অর্থ আইন ও প্রজ্ঞাপন দেখুন। কোনো মান ভিন্ন হলে ⚙️ সেটিংস থেকে বদলে নিন — পুরো অ্যাপ সেই অনুযায়ী হিসাব করবে।</div>`;
  }

  /* ---------------- settings ---------------- */
  let editId = null;
  let draft = null;

  function renderSettings() {
    if (!editId) editId = inputs.presetId;
    draft = clone(rulesFor(editId));
    drawSettings();
  }

  function numField(path, label, hint = '') {
    const val = path.split('.').reduce((o, k) => (o == null ? o : o[k]), draft);
    return `<div class="field"><label>${label}</label>
      <input type="number" min="0" step="any" data-path="${path}" value="${val == null ? '' : val}" />
      <div class="hint">${hint}</div></div>`;
  }

  function drawSettings() {
    const p = presetById(editId);
    const d = draft;
    $('settingsRoot').innerHTML = `
      <div class="card">
        <div class="card-head">
          <div><h2>⚙️ নিয়ম ও স্ল্যাব সেটিংস</h2>
          <p class="sub">নতুন বাজেট বা প্রজ্ঞাপন এলে এখান থেকেই সব মান বদলান। পরিবর্তন শুধু আপনার ব্রাউজারে সংরক্ষিত থাকে।</p></div>
        </div>
        <div class="field"><label for="editPreset">কোন বছরের নিয়ম সম্পাদনা করবেন</label>
          <select id="editPreset">${PRESETS.map((x) => `<option value="${x.id}"${x.id === editId ? ' selected' : ''}>${esc(x.label)}${customRules[x.id] ? ' (কাস্টম)' : ''}</option>`).join('')}</select>
          <div class="hint">${esc(p.source)} · ${esc(p.incomeYear)}</div></div>
      </div>

      <div class="card">
        <h3>১. করমুক্ত আয়সীমা (টাকা)</h3>
        <div class="settings-grid">
          ${CATS.map((c) => numField('thresholds.' + c.key, esc(c.label), words(d.thresholds[c.key]))).join('')}
          ${numField('disabledChildBonus', 'প্রতিবন্ধী সন্তান প্রতি অতিরিক্ত', words(d.disabledChildBonus))}
        </div>
      </div>

      <div class="card">
        <h3>২. করহার স্ল্যাব (করমুক্ত সীমার পর)</h3>
        <p class="sub">ধাপগুলো ক্রম অনুযায়ী। শেষ ধাপের আকার খালি রাখলে “বাকি সব আয়” ধরা হবে।</p>
        <div class="table-wrap"><table class="slab-edit">
          <thead><tr><th>#</th><th>ধাপের আকার (টাকা)</th><th>হার (%)</th><th></th></tr></thead>
          <tbody>${d.slabs.map((s, i) => `<tr>
            <td>${bn(i + 1)}</td>
            <td><input type="number" min="0" step="any" data-slab="${i}" data-f="width" value="${s.width == null ? '' : s.width}" placeholder="বাকি সব" /></td>
            <td><input class="w-rate" type="number" min="0" max="100" step="any" data-slab="${i}" data-f="rate" value="${s.rate}" /></td>
            <td><button class="btn danger sm" data-del="${i}" type="button" aria-label="মুছুন">✕</button></td></tr>`).join('')}</tbody>
        </table></div>
        <button class="btn ghost sm" id="addSlab" type="button" style="margin-top:10px">+ নতুন ধাপ যোগ করুন</button>
      </div>

      <div class="card">
        <h3>৩. অব্যাহতি, রেয়াত ও ন্যূনতম কর</h3>
        <div class="settings-grid">
          ${numField('salaryExemption.divisor', 'বেতন অব্যাহতি: মোট বেতনের ১/…', 'যেমন ৩ মানে এক-তৃতীয়াংশ')}
          ${numField('salaryExemption.cap', 'বেতন অব্যাহতির সর্বোচ্চ (টাকা)', words(d.salaryExemption.cap))}
          ${numField('rebate.incomePct', 'রেয়াত: করযোগ্য আয়ের %')}
          ${numField('rebate.investPct', 'রেয়াত: বিনিয়োগের %')}
          ${numField('rebate.cap', 'রেয়াতের সর্বোচ্চ (টাকা)', words(d.rebate.cap))}
          ${numField('investmentCaps.dps', 'ডিপিএসের বার্ষিক সীমা (টাকা)', words(d.investmentCaps.dps))}
          ${AREAS.map((a) => numField('minimumTax.' + a.key, 'ন্যূনতম কর — ' + esc(a.label))).join('')}
        </div>
      </div>

      <div class="card">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="saveRules" type="button">✔ সেভ করে প্রয়োগ করুন</button>
          <button class="btn ghost" id="resetRules" type="button">↺ এই বছরের ডিফল্টে ফিরুন</button>
          <button class="btn ghost" id="exportRules" type="button">⬇️ JSON এক্সপোর্ট</button>
          <label class="btn ghost" for="importRules" style="cursor:pointer">⬆️ JSON ইমপোর্ট</label>
          <input id="importRules" type="file" accept="application/json,.json" hidden />
        </div>
        <p class="sub" style="margin-top:10px">ডেভেলপারদের জন্য: স্থায়ীভাবে নতুন বছর যোগ করতে <code>js/tax-rules.js</code> ফাইলে একটি preset যোগ করুন।</p>
      </div>`;

    $('editPreset').addEventListener('change', (e) => { editId = e.target.value; renderSettings(); });
    $('settingsRoot').querySelectorAll('input[data-path]').forEach((el) => el.addEventListener('input', () => {
      const keys = el.dataset.path.split('.');
      let o = draft;
      keys.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
      o[keys[keys.length - 1]] = el.value === '' ? 0 : Number(el.value);
      const hint = el.parentElement.querySelector('.hint');
      if (hint && !/^(rebate\.(income|invest)Pct|salaryExemption\.divisor)$/.test(el.dataset.path)) hint.textContent = words(el.value);
    }));
    $('settingsRoot').querySelectorAll('input[data-slab]').forEach((el) => el.addEventListener('input', () => {
      const s = draft.slabs[Number(el.dataset.slab)];
      if (el.dataset.f === 'width') s.width = el.value === '' ? null : Number(el.value);
      else s.rate = Number(el.value) || 0;
    }));
    $('settingsRoot').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      draft.slabs.splice(Number(b.dataset.del), 1);
      if (!draft.slabs.length) draft.slabs.push({ width: null, rate: 0 });
      drawSettings();
    }));
    $('addSlab').addEventListener('click', () => {
      const lastS = draft.slabs[draft.slabs.length - 1];
      if (lastS && lastS.width == null) { lastS.width = 500000; }
      draft.slabs.push({ width: null, rate: lastS ? Number(lastS.rate) + 5 : 10 });
      drawSettings();
    });
    $('saveRules').addEventListener('click', saveRules);
    $('resetRules').addEventListener('click', () => {
      delete customRules[editId];
      store.set(KEY.rules, customRules);
      buildForm(); writeForm();
      renderSettings(); recalc();
      toast('ডিফল্ট নিয়মে ফেরানো হয়েছে');
    });
    $('exportRules').addEventListener('click', () => {
      download(`tax-rules-${editId}.json`, JSON.stringify(stripRules(draft), null, 2), 'application/json');
    });
    $('importRules').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      f.text().then((txt) => {
        const obj = JSON.parse(txt);
        if (!obj.thresholds || !Array.isArray(obj.slabs)) throw new Error('bad');
        draft = Object.assign(clone(presetById(editId)), obj);
        drawSettings();
        toast('ইমপোর্ট হয়েছে — সেভ চাপুন');
      }).catch(() => toast('ফাইলটি সঠিক নিয়ম-ফাইল নয়'));
    });
  }

  function stripRules(r) {
    const { thresholds, disabledChildBonus, slabs, salaryExemption, rebate, minimumTax, investmentCaps } = r;
    return { thresholds, disabledChildBonus, slabs, salaryExemption, rebate, minimumTax, investmentCaps };
  }

  function saveRules() {
    // Clean slabs: keep order, only the last one may be open-ended.
    const slabs = draft.slabs.map((s) => ({ width: s.width == null || s.width === '' ? null : Math.max(0, Number(s.width)), rate: Math.max(0, Number(s.rate) || 0) }));
    for (let i = 0; i < slabs.length - 1; i++) if (slabs[i].width == null) slabs[i].width = 0;
    draft.slabs = slabs.filter((s, i) => i === slabs.length - 1 || s.width > 0);
    if (Number(draft.salaryExemption.divisor) < 1) draft.salaryExemption.divisor = 1;
    customRules[editId] = Object.assign(stripRules(draft), { verify: [] });
    store.set(KEY.rules, customRules);
    inputs.presetId = editId;
    store.set(KEY.inputs, inputs);
    buildForm(); writeForm();
    recalc();
    drawSettings();
    toast('নিয়ম সেভ হয়েছে — হিসাব আপডেট হয়েছে');
  }

  /* ---------------- history ---------------- */
  function renderHistory() {
    const h = store.get(KEY.history, []);
    const el = $('historyList');
    if (!h.length) { el.textContent = 'এখনো কিছু সেভ করা হয়নি।'; return; }
    el.innerHTML = h.map((x, i) => `<div class="history-item">
      <div><strong>${esc(x.name)}</strong><div class="sub">${bn(new Date(x.ts).toLocaleDateString('en-GB'))} · নিট কর ${tk(x.netTax)}</div></div>
      <div style="display:flex;gap:6px"><button class="btn ghost sm" data-load="${i}" type="button">খুলুন</button><button class="btn danger sm" data-rm="${i}" type="button" aria-label="মুছুন">✕</button></div></div>`).join('');
    el.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
      const item = h[Number(b.dataset.load)];
      inputs = Object.assign({}, DEFAULTS, item.inputs);
      store.set(KEY.inputs, inputs);
      writeForm(); recalc();
      toast('হিসাব খোলা হয়েছে');
    }));
    el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      h.splice(Number(b.dataset.rm), 1);
      store.set(KEY.history, h);
      renderHistory();
    }));
  }
  $('saveScenario').addEventListener('click', () => {
    if (!last) return;
    const h = store.get(KEY.history, []);
    const p = presetById(inputs.presetId);
    h.unshift({ ts: Date.now(), name: `${p.shortLabel} · বেতন ${fmt(inputs.grossBefore)}`, inputs: clone(inputs), netTax: last.r.netTax });
    store.set(KEY.history, h.slice(0, 20));
    renderHistory();
    toast('হিসাব সেভ হয়েছে');
  });
  $('clearHistory').addEventListener('click', () => {
    if (!confirm('সব সংরক্ষিত হিসাব মুছে ফেলবেন?')) return;
    store.del(KEY.history);
    renderHistory();
  });
  $('resetInputs').addEventListener('click', () => {
    inputs = Object.assign({}, DEFAULTS);
    store.set(KEY.inputs, inputs);
    writeForm(); recalc();
    toast('ইনপুট ডিফল্টে ফেরানো হয়েছে');
  });

  /* ---------------- export / print ---------------- */
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('exportCsv').addEventListener('click', () => {
    if (!last) return;
    const r = last.r;
    const lines = [['Month', 'Salary', 'Bonus', 'Employee PF', 'Employer PF', 'Tax', 'Net to bank']];
    const en = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    r.months.forEach((m) => lines.push([en[m.index], m.gross, m.bonus, m.employeePF, m.employerPF, m.tax, m.net].map((v) => (typeof v === 'number' ? Math.round(v) : v))));
    const t = r.totals;
    lines.push(['Total', t.gross, t.bonus, t.employeePF, t.employerPF, t.tax, t.net].map((v) => (typeof v === 'number' ? Math.round(v) : v)));
    lines.push([]);
    lines.push(['Taxable income', Math.round(r.taxableIncome)]);
    lines.push(['Tax before rebate', Math.round(r.grossTax)]);
    lines.push(['Investment rebate', Math.round(r.rebate)]);
    lines.push(['Net tax payable', r.netTax]);
    download('income-tax-sheet.csv', '﻿' + lines.map((l) => l.join(',')).join('\n'), 'text/csv;charset=utf-8');
  });
  $('printBtn').addEventListener('click', () => {
    if ($('view-calc').hidden && $('view-guide').hidden) showView('calc');
    window.print();
  });

  /* ---------------- boot ---------------- */
  $('year').textContent = bn(new Date().getFullYear());
  buildForm();
  writeForm();
  bindForm();
  renderHistory();
  recalc();
  const savedView = store.get(KEY.view, 'calc');
  if (savedView !== 'calc' && $('view-' + savedView)) showView(savedView);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
  }
})();
