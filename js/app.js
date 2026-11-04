/* =====================================================================
 *  Smart Income Tax Calculator — UI layer
 *  Text comes from i18n.js, rules from tax-rules.js, maths from engine.js.
 * ===================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const E = window.TaxEngine;
  const CATS = window.TAXPAYER_CATEGORIES;
  const AREAS = window.TAX_AREAS;
  const INVEST = window.INVESTMENT_TYPES;
  const DEFAULTS = window.DEFAULT_INPUTS;
  const KEY = { inputs: 'sitc.inputs.v2', rules: 'sitc.rules.v2', history: 'sitc.history.v2', theme: 'sitc.theme', view: 'sitc.view', lang: 'sitc.lang' };

  /* ---------------- storage (never throws) ---------------- */
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ---------------- language ---------------- */
  let lang = store.get(KEY.lang, null) || ((navigator.language || '').toLowerCase().startsWith('bn') ? 'bn' : 'bn');
  if (!window.I18N[lang]) lang = 'bn';

  function t(key, vars) {
    let s = window.I18N[lang][key];
    if (s == null) s = window.I18N.bn[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
  const L = (o) => (o == null ? '' : typeof o === 'string' ? o : o[lang] || o.bn || '');
  const months = () => window.MONTHS[lang] || window.MONTHS.bn;

  /* ---------------- formatting ---------------- */
  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const dg = (s) => (lang === 'bn' ? String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]) : String(s));
  const fmt = (n) => dg(Math.round(Number(n) || 0).toLocaleString('en-IN'));
  const tk = (n) => '৳ ' + fmt(n);
  const pct = (n, d = 1) => dg((Math.round((Number(n) || 0) * 10 ** d) / 10 ** d).toString()) + '%';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** 425000 -> "৪ লাখ ২৫ হাজার টাকা" / "4 lakh 25 thousand taka" */
  function words(n) {
    n = Math.round(Number(n) || 0);
    if (n <= 0) return '';
    const crore = Math.floor(n / 1e7);
    const lakh = Math.floor((n % 1e7) / 1e5);
    const th = Math.floor((n % 1e5) / 1e3);
    const rest = n % 1e3;
    const parts = [];
    if (crore) parts.push(dg(crore) + ' ' + t('wCrore'));
    if (lakh) parts.push(dg(lakh) + ' ' + t('wLakh'));
    if (th) parts.push(dg(th) + ' ' + t('wThousand'));
    if (rest) parts.push(dg(rest));
    return parts.join(' ') + ' ' + t('wTaka');
  }

  const BAND_COLORS = ['--band-0', '--band-1', '--band-2', '--band-3', '--band-4', '--band-5', '--band-6'];
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function bandColor(rate, maxRate) {
    if (rate <= 0) return cssVar('--band-0');
    const steps = BAND_COLORS.length - 1;
    const idx = Math.max(1, Math.min(steps, Math.ceil((rate / Math.max(maxRate, 1)) * steps)));
    return cssVar(BAND_COLORS[idx]);
  }

  /* ---------------- years ---------------- */
  const YEARS = E.buildYears(window.TAX_RULE_SETS, window.ANNOUNCED_THRESHOLDS, window.YEAR_RANGE, new Date());
  const CURRENT = YEARS.find((y) => y.current) || YEARS[0];
  const yearById = (id) => YEARS.find((y) => y.id === id) || CURRENT;
  const resolveId = (id) => (id === 'current' || !YEARS.some((y) => y.id === id) ? CURRENT.id : id);
  const iyText = (y) => dg(`${y}-${String((y + 1) % 100).padStart(2, '0')}`);
  const ayText = (y) => iyText(y + 1);
  const spanText = (y) => t('yearSpan', { a: dg(y), b: dg(y + 1) });
  const deadlineText = (y) => t('deadline', { y: dg(y + 1) });
  function sourceText(r) {
    return r.kind === 'estimated' ? t('estSource', { base: iyText(r.basedOn) }) : L(r.source);
  }
  function yearLabel(r, withTags) {
    let s = t('yearLabel', { iy: iyText(r.startYear), ay: ayText(r.startYear) });
    if (withTags) {
      const tags = [];
      if (r.current) tags.push(t('tagCurrent'));
      if (r.kind === 'estimated') tags.push(t('tagEstimated'));
      if (customRules[r.id]) tags.push(t('tagCustom'));
      if (tags.length) s += ' — ' + tags.join(', ');
    }
    return s;
  }

  /* ---------------- state ---------------- */
  let inputs = Object.assign({}, DEFAULTS, store.get(KEY.inputs, {}));
  let customRules = store.get(KEY.rules, {});
  // Migrate ids from the first v2 release ('iy-2026-27' -> 'iy-2026')
  inputs.presetId = String(inputs.presetId || 'current').replace(/^iy-(\d{4})-\d{2}$/, 'iy-$1');
  Object.keys(customRules).forEach((k) => {
    const nk = k.replace(/^iy-(\d{4})-\d{2}$/, 'iy-$1');
    if (nk !== k) { customRules[nk] = customRules[k]; delete customRules[k]; }
  });

  const clone = (o) => JSON.parse(JSON.stringify(o));
  function rulesFor(id) {
    const base = clone(yearById(id));
    const custom = customRules[base.id];
    return custom ? Object.assign(base, clone(custom), { id: base.id, startYear: base.startYear, kind: base.kind, basedOn: base.basedOn, isCustom: true }) : base;
  }
  const currentRules = () => rulesFor(resolveId(inputs.presetId));

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  /* ---------------- theme ---------------- */
  const THEMES = ['auto', 'light', 'dark'];
  let theme = store.get(KEY.theme, 'auto');
  function applyTheme() {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    $('themeBtn').textContent = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🌓';
    $('themeBtn').title = t('themePrefix') + t(theme === 'light' ? 'themeLight' : theme === 'dark' ? 'themeDark' : 'themeAuto');
    $('themeBtn').setAttribute('aria-label', $('themeBtn').title);
  }
  $('themeBtn').addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    store.set(KEY.theme, theme);
    applyTheme();
    recalc();
    toast($('themeBtn').title);
  });
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => recalc());
  }

  /* ---------------- static text ---------------- */
  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = t('docTitle');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
      el.setAttribute('aria-label', el.title);
    });
    document.querySelectorAll('[data-num]').forEach((el) => { el.textContent = dg(el.dataset.num); });
    $('footer2').textContent = t('footer2', { y: dg(new Date().getFullYear()) });
    applyTheme();
  }

  function setLang(next) {
    if (!window.I18N[next] || next === lang) return;
    lang = next;
    store.set(KEY.lang, lang);
    applyStatic();
    buildForm();
    writeForm();
    renderHistory();
    recalc();
    if (!$('view-settings').hidden) renderSettings();
    toast(t('tLang'));
  }
  $('langBtn').addEventListener('click', () => setLang(lang === 'bn' ? 'en' : 'bn'));

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
  function fillSelect(el, items) {
    el.innerHTML = items.map((it) => `<option value="${esc(it.v)}">${esc(it.l)}</option>`).join('');
  }
  function buildForm() {
    fillSelect($('presetId'), YEARS.map((y) => ({ v: y.id, l: yearLabel(y, true) })));
    fillSelect($('category'), CATS.map((c) => ({ v: c.key, l: L(c.label) })));
    fillSelect($('area'), AREAS.map((a) => ({ v: a.key, l: L(a.label) })));
    const monthOpts = months().map((m, i) => ({ v: i, l: m }));
    fillSelect($('incrementMonth'), [{ v: -1, l: t('noIncrement') }].concat(monthOpts.slice(1)));
    fillSelect($('festivalBonusMonth'), monthOpts);
    fillSelect($('otherBonusMonth'), monthOpts);

    $('investFields').innerHTML = INVEST.map((it) => `
      <div class="field">
        <label for="inv_${it.key}">${esc(L(it.label))}</label>
        <div class="money"><input id="inv_${it.key}" type="number" min="0" step="100" inputmode="decimal" /></div>
        <div class="hint" id="hint_inv_${it.key}">${esc(L(it.hint))}</div>
      </div>`).join('');
    INVEST.forEach((it) => bindField('inv_' + it.key));
  }

  const NUMERIC = Object.keys(DEFAULTS).filter((k) => typeof DEFAULTS[k] === 'number');

  function writeForm() {
    Object.keys(DEFAULTS).forEach((k) => {
      const el = $(k);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!inputs[k];
      else if (k === 'presetId') el.value = resolveId(inputs.presetId);
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

  const bound = new WeakSet();
  function bindField(k) {
    const el = $(k);
    if (!el || bound.has(el)) return;
    bound.add(el);
    const handler = () => {
      if (el.type === 'checkbox') inputs[k] = el.checked;
      else if (k === 'presetId') inputs[k] = el.value === CURRENT.id ? 'current' : el.value;
      else if (NUMERIC.includes(k)) inputs[k] = el.value === '' ? 0 : Number(el.value);
      else inputs[k] = el.value;
      store.set(KEY.inputs, inputs);
      syncVisibility();
      scheduleRecalc();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  }
  function bindForm() {
    Object.keys(DEFAULTS).forEach(bindField);
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
    const r = E.compute(inputs, rules);
    last = { r, rules };
    renderHeader(rules);
    renderHero(r);
    renderFlow(r, rules);
    renderSlabs(r);
    renderRebate(r, rules);
    renderMonths(r);
    if (!$('view-guide').hidden) renderGuide();
  }

  function catLabel(key) { const c = CATS.find((x) => x.key === key); return c ? L(c.label) : key; }

  function renderHeader(rules) {
    $('brandSub').textContent = t('brandSub', { year: t('yearShort', { iy: iyText(rules.startYear) }) });
    $('presetHint').textContent = t('yearHint', { span: spanText(rules.startYear), source: sourceText(rules) }) + (rules.isCustom ? t('customHint') : '');
    $('ruleBadge').textContent = t('assessYear', { ay: ayText(rules.startYear) }) + (rules.kind === 'estimated' ? ' · ' + t('tagEstimated') : '') + (rules.isCustom ? ' · ' + t('tagCustom') : '');
    const th = E.thresholdFor(rules, inputs.category, inputs.disabledChildren);
    $('categoryHint').innerHTML = t('thresholdHint', { amt: tk(th) }) +
      ((rules.verify || []).includes(inputs.category) ? ` <span class="badge">${esc(t('verifyBadge'))}</span>` : '');
    const dps = (rules.investmentCaps || {}).dps;
    const h = $('hint_inv_dps');
    if (h && dps) h.textContent = t('dpsCapHint', { amt: tk(dps) });
  }

  function renderHero(r) {
    const status = !r.taxPaid ? t('yearTotal') : r.balanceDue > 0 ? t('balanceDue', { amt: tk(r.balanceDue) }) : r.refund > 0 ? t('refundable', { amt: tk(r.refund) }) : t('fullyPaid');
    $('hero').innerHTML = `
      <div class="stat primary"><div class="k">${t('netTax')}</div><div class="v">${tk(r.netTax)}</div><div class="s">${status}</div></div>
      <div class="stat"><div class="k">${t('perMonth')}</div><div class="v">${tk(r.monthlyAverage)}</div><div class="s">${t('perMonthSub')}</div></div>
      <div class="stat"><div class="k">${t('effRate')}</div><div class="v">${pct(r.effectiveRate, 2)}</div><div class="s">${t('topBand', { r: pct(r.marginalRate, 0) })}</div></div>
      <div class="stat"><div class="k">${t('taxableIncome')}</div><div class="v">${tk(r.taxableIncome)}</div><div class="s">${t('totalIncome', { amt: tk(r.totalIncome) })}</div></div>`;
  }

  function li(label, value, cls = '', sub = '') {
    return `<li class="${cls}"><span class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="val">${value}</span></li>`;
  }

  function estimatedNote(rules, key) {
    if (rules.kind !== 'estimated' || rules.isCustom) return '';
    const ann = rules.announcedGeneral ? t('nEstimatedAnn', { amt: tk(rules.announcedGeneral) }) : '';
    return `<div class="note info">${t(key, { iy: iyText(rules.startYear), base: iyText(rules.basedOn), ann })}</div>`;
  }

  function renderFlow(r, rules) {
    const ex = rules.salaryExemption;
    const rows = [
      li(t('fBasic'), tk(r.salaryGross), '', t('fBasicSub')),
      li(t('fBonus'), tk(r.bonusTotal)),
      li(t('fEmployerPf'), tk(r.employerPF), '', t('fEmployerPfSub')),
      li(t('fSalaryIncome'), tk(r.salaryIncome)),
      li(t('fExemption'), '− ' + tk(r.exemption), 'minus', t('fExemptionSub', { d: dg(ex.divisor), cap: tk(ex.cap) })),
      r.otherIncome ? li(t('fOtherIncome'), tk(r.otherIncome)) : '',
      li(t('fTaxable'), tk(r.taxableIncome), 'total'),
      li(t('fSlabTax'), tk(r.grossTax), '', t('fSlabTaxSub', { amt: tk(r.threshold) })),
      li(t('fRebate'), '− ' + tk(r.rebate), 'minus'),
      r.minimumApplied ? li(t('fMinTax'), tk(r.minimumTax), '', t('fMinTaxSub')) : '',
      li(t('fNet'), tk(r.netTax), 'total'),
      r.taxPaid ? li(t('fPaid'), '− ' + tk(r.taxPaid), 'minus') : '',
      r.taxPaid ? li(r.refund > 0 ? t('fRefund') : t('fDue'), tk(r.refund > 0 ? r.refund : r.balanceDue), 'total') : ''
    ];
    $('flow').innerHTML = rows.join('');

    const notes = [estimatedNote(rules, 'nEstimated')];
    if (r.taxableIncome <= r.threshold) notes.push(`<div class="note good">${t('nBelow', { amt: tk(r.threshold) })}</div>`);
    if (r.minimumApplied) notes.push(`<div class="note info">${t('nMin', { after: tk(r.taxAfterRebate), min: tk(r.minimumTax) })}</div>`);
    if (rules.kind !== 'estimated' && (rules.verify || []).includes(inputs.category)) {
      notes.push(`<div class="note warn">${t('nVerify', { cat: esc(catLabel(inputs.category)), amt: tk(rules.thresholds[inputs.category]) })}</div>`);
    }
    $('flowNotes').innerHTML = notes.join('');
  }

  function bandLabel(row) {
    if (row.isFree) return t('bandFirst', { amt: tk(row.width) });
    if (row.width == null) return t('bandRest');
    return t('bandNext', { amt: tk(row.width) });
  }
  function bandRange(row) {
    const from = row.from === 0 ? 0 : row.from + 1;
    return row.to === Infinity ? t('rangeAbove', { from: fmt(from) }) : `${fmt(from)} – ${fmt(row.to)}`;
  }

  function renderSlabs(r) {
    const maxRate = Math.max(...r.slabRows.map((x) => x.rate));
    const total = Math.max(1, r.taxableIncome);
    const used = r.slabRows.filter((x) => x.taxed > 0);
    $('bandbar').innerHTML = used.map((x) => `<span style="width:${(x.taxed / total) * 100}%;background:${bandColor(x.rate, maxRate)}" title="${pct(x.rate, 0)}: ${tk(x.taxed)}"></span>`).join('');
    $('bandLegend').innerHTML = used.map((x) => `<span><i style="background:${bandColor(x.rate, maxRate)}"></i>${pct(x.rate, 0)} — ${tk(x.taxed)}</span>`).join('');

    $('slabTable').querySelector('tbody').innerHTML = r.slabRows.map((x) => `
      <tr class="${x.taxed > 0 ? 'active-band' : 'inactive'}">
        <td>${bandLabel(x)}<div class="sub">${bandRange(x)}</div></td>
        <td class="r"><span class="rate-pill" style="background:${bandColor(x.rate, maxRate)}">${pct(x.rate, 0)}</span></td>
        <td class="r">${x.taxed > 0 ? tk(x.taxed) : '—'}</td>
        <td class="r">${x.taxed > 0 ? tk(x.tax) : '—'}</td>
      </tr>`).join('');
    $('slabTable').querySelector('tfoot').innerHTML =
      `<tr><td>${t('total')}</td><td></td><td class="r">${tk(r.taxableIncome)}</td><td class="r">${tk(r.grossTax)}</td></tr>`;
  }

  function renderRebate(r, rules) {
    const rb = rules.rebate;
    const win = r.rebateLimitedBy;
    const cand = (key, label, val) => li((win === key ? '✔ ' : '') + label, tk(val), win === key ? 'total' : '');
    let html = `<div class="formula">${t('rebateFormula', { ip: pct(rb.incomePct, 0), vp: pct(rb.investPct, 0), cap: tk(rb.cap) })}</div>
      <ul class="flow">
        ${cand('income', t('rbIncome', { p: pct(rb.incomePct, 0) }), r.rebateByIncome)}
        ${cand('invest', t('rbInvest', { p: pct(rb.investPct, 0) }), r.rebateByInvest)}
        ${cand('cap', t('rbCap'), r.rebateCap)}
      </ul>`;

    const rows = r.investRows.filter((x) => x.entered > 0).map((x) =>
      `<tr><td>${esc(L(x.label))}</td><td class="r">${tk(x.entered)}</td><td class="r">${tk(x.counted)}${x.cap != null && x.entered > x.cap ? ` <span class="badge">${t('capBadge')}</span>` : ''}</td></tr>`);
    if (r.pfInvest > 0) rows.push(`<tr><td>${t('pfBoth')}</td><td class="r">${tk(r.pfInvest)}</td><td class="r">${tk(r.pfInvest)}</td></tr>`);
    html += `<div class="table-wrap" style="margin-top:12px"><table>
      <thead><tr><th>${t('thInvest')}</th><th class="r">${t('thEntered')}</th><th class="r">${t('thCounted')}</th></tr></thead>
      <tbody>${rows.join('') || `<tr><td colspan="3" class="sub">${t('noInvest')}</td></tr>`}</tbody>
      <tfoot><tr><td>${t('totalInvest')}</td><td></td><td class="r">${tk(r.eligibleInvest)}</td></tr></tfoot></table></div>`;

    if (r.grossTax <= 0) {
      html += `<div class="note good">${t('rNoTax')}</div>`;
    } else if (r.investShortfall > 0 && r.potentialSaving > 0) {
      html += `<div class="note warn">${t('rShort', { max: tk(r.maxRebate), need: tk(r.investForMaxRebate), gap: tk(r.investShortfall), save: tk(r.potentialSaving) })}
        <div class="sub" style="margin-top:4px">${t('rShortSub', { words: words(r.investShortfall) })}</div></div>`;
    } else if (r.minimumApplied) {
      html += `<div class="note info">${t('rMin')}</div>`;
    } else {
      html += `<div class="note good">${t('rFull')}</div>`;
    }
    $('rebateBox').innerHTML = html;
  }

  function renderMonths(r) {
    const M = months();
    $('monthTable').querySelector('tbody').innerHTML = r.months.map((m) => `
      <tr><td>${M[m.index]}</td><td class="r">${fmt(m.gross)}</td><td class="r">${m.bonus ? fmt(m.bonus) : '—'}</td>
      <td class="r">${fmt(m.employeePF)}</td><td class="r">${fmt(m.employerPF)}</td><td class="r">${fmt(m.tax)}</td><td class="r"><strong>${fmt(m.net)}</strong></td></tr>`).join('');
    const tt = r.totals;
    $('monthTable').querySelector('tfoot').innerHTML = `<tr><td>${t('total')}</td><td class="r">${fmt(tt.gross)}</td><td class="r">${fmt(tt.bonus)}</td>
      <td class="r">${fmt(tt.employeePF)}</td><td class="r">${fmt(tt.employerPF)}</td><td class="r">${fmt(tt.tax)}</td><td class="r">${fmt(tt.net)}</td></tr>`;
  }

  /* ---------------- guide ---------------- */
  function slabRowsForGuide(rules, threshold) {
    const bands = E.buildBands(rules, threshold);
    let lower = 0;
    let cum = 0;
    return bands.map((b) => {
      const upper = b.width == null ? Infinity : lower + b.width;
      const maxTax = b.width == null ? null : (b.width * b.rate) / 100;
      cum += maxTax || 0;
      const row = {
        label: b.isFree ? t('bandFirst', { amt: tk(b.width) }) : b.width == null ? t('bandRest') : t('bandNext', { amt: tk(b.width) }),
        range: bandRange({ from: lower, to: upper }), rate: b.rate, maxTax, cumTax: cum
      };
      lower = upper;
      return row;
    });
  }

  function renderGuide() {
    const rules = currentRules();
    const y = rules.startYear;
    const general = rules.thresholds.general;
    const maxRate = Math.max(...rules.slabs.map((s) => Number(s.rate)));
    const rows = slabRowsForGuide(rules, general);
    const ex = rules.salaryExemption, rb = rules.rebate, mt = rules.minimumTax;
    const verify = rules.kind === 'estimated' ? [] : rules.verify || [];
    const notes = (rules.notes && rules.notes[lang]) || [];

    const exInputs = Object.assign({}, DEFAULTS, { category: 'general', grossBefore: 100000, incrementMonth: -1, festivalBonus: 0, otherBonus: 0, employerPfPct: 0, employeePfPct: 0, pfCountsAsInvestment: false, otherIncome: 0, inv_dps: 120000, inv_sanchay: 0, inv_shares: 0, inv_insurance: 0, inv_other: 0, taxPaid: 0, disabledChildren: 0 });
    const e = E.compute(exInputs, rules);

    const compare = YEARS.slice().reverse().map((yr) => {
      const rr = rulesFor(yr.id);
      const tags = (yr.current ? ` <span class="badge green">${t('tagCurrent')}</span>` : '') + (yr.kind === 'estimated' ? ` <span class="badge">${t('tagEstimated')}</span>` : '');
      return `<tr${yr.id === rules.id ? ' class="active-band"' : ''}><td>${iyText(yr.startYear)}${tags}</td>
        <td class="r">${tk(rr.thresholds.general)}</td><td class="r">${tk(rr.thresholds.women)}</td>
        <td class="r">${pct(rr.slabs[0].rate, 0)}</td><td class="r">${pct(rr.slabs[rr.slabs.length - 1].rate, 0)}</td></tr>`;
    }).join('');

    $('guideRoot').innerHTML = `
      <div class="guide-hero">
        <h2>${t('gTitle', { year: esc(yearLabel(rules, false)) })}</h2>
        <p>${t('gSub', { span: spanText(y), source: esc(sourceText(rules)) })}${rules.isCustom ? t('gCustom') : ''}</p>
        <div class="chips">
          <span class="chip">${t('gChipLimit', { amt: tk(general) })}</span>
          <span class="chip">${t('gChipRate', { a: pct(rules.slabs[0].rate, 0), b: pct(maxRate, 0) })}</span>
          <span class="chip">${t('gChipRebate', { amt: tk(rb.cap) })}</span>
          <span class="chip">${t('gChipDeadline', { d: deadlineText(y) })}</span>
        </div>
      </div>

      ${estimatedNote(rules, 'gEstimated')}
      ${notes.length ? `<div class="card"><h3>${t('gNew')}</h3><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}

      <div class="card">
        <h3>${t('g1')}</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>${t('thCategory')}</th><th class="r">${t('thLimit')}</th></tr></thead>
          <tbody>${CATS.map((c) => `<tr${c.key === inputs.category ? ' class="active-band"' : ''}><td>${esc(L(c.label))}${c.key === inputs.category ? ` <span class="badge green">${t('you')}</span>` : ''}</td>
            <td class="r">${tk(rules.thresholds[c.key])}${verify.includes(c.key) ? ` <span class="badge">${t('verifyBadge')}</span>` : ''}<div class="sub">${words(rules.thresholds[c.key])}</div></td></tr>`).join('')}
            <tr><td>${t('gChildRow')}</td><td class="r">${t('gChildVal', { amt: tk(rules.disabledChildBonus) })}</td></tr>
          </tbody></table></div>
        <p class="sub">${t('gChildNote')}</p>
      </div>

      <div class="card">
        <h3>${t('g2')}</h3>
        <p>${t('g2p')}</p>
        <div class="table-wrap"><table>
          <thead><tr><th>${t('thStep')}</th><th>${t('thRange')}</th><th class="r">${t('thRate')}</th><th class="r">${t('thMaxTax')}</th><th class="r">${t('thCumTax')}</th></tr></thead>
          <tbody>${rows.map((x) => `<tr><td>${x.label}</td><td>${x.range}</td>
            <td class="r"><span class="rate-pill" style="background:${bandColor(x.rate, maxRate)}">${pct(x.rate, 0)}</span></td>
            <td class="r">${x.maxTax == null ? '—' : tk(x.maxTax)}</td><td class="r">${x.maxTax == null ? '—' : tk(x.cumTax)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="card">
        <h3>${t('g3')}</h3>
        <p>${t('g3p', { d: dg(ex.divisor), cap: tk(ex.cap) })}</p>
        <div class="formula">${t('g3f', { d: dg(ex.divisor), cap: tk(ex.cap) })}</div>
        <ul><li>${t('g3l1')}</li><li>${t('g3l2', { amt: tk(ex.cap * ex.divisor), cap: tk(ex.cap) })}</li></ul>
      </div>

      <div class="card">
        <h3>${t('g4')}</h3>
        <p>${t('g4p')}</p>
        <div class="formula">${t('g4a', { p: pct(rb.incomePct, 0) })}<br>${t('g4b', { p: pct(rb.investPct, 0) })}<br>${t('g4c', { amt: tk(rb.cap), words: words(rb.cap) })}</div>
        <p>${t('g4rule', { p: pct((rb.incomePct / rb.investPct) * 100, 0), cap: tk(rb.cap), need: tk((rb.cap * 100) / rb.investPct) })}</p>
        <div class="two-col">
          <div>
            <strong>${t('g4eligible')}</strong>
            <ul>${INVEST.map((it) => `<li>${esc(L(it.label))}${it.capKey && rules.investmentCaps[it.capKey] ? t('g4capSuffix', { amt: tk(rules.investmentCaps[it.capKey]) }) : ''}<div class="sub">${esc(L(it.hint))}</div></li>`).join('')}
              <li>${t('g4pf')}</li><li>${t('g4super')}</li></ul>
          </div>
          <div>
            <strong>${t('g4watch')}</strong>
            <ul><li>${t('g4w1')}</li><li>${t('g4w2')}</li><li>${t('g4w3')}</li><li>${t('g4w4')}</li></ul>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>${t('g5')}</h3>
        <p>${t('g5p')}</p>
        <div class="table-wrap"><table><thead><tr><th>${t('thArea')}</th><th class="r">${t('thMinTax')}</th></tr></thead>
          <tbody>${AREAS.map((a) => `<tr><td>${esc(L(a.label))}</td><td class="r">${tk(mt[a.key])}</td></tr>`).join('')}</tbody></table></div>
      </div>

      <div class="card">
        <h3>${t('g6')}</h3>
        <p class="sub">${t('g6sub', { amt: tk(120000) })}</p>
        <ul class="flow">
          ${li(t('e1'), tk(e.salaryIncome))}
          ${li(t('e2'), '− ' + tk(e.exemption), 'minus')}
          ${li(t('e3'), tk(e.taxableIncome), 'total')}
          ${e.slabRows.filter((x) => x.taxed > 0).map((x) => li(`${tk(x.taxed)} × ${pct(x.rate, 0)}`, tk(x.tax))).join('')}
          ${li(t('e4'), tk(e.grossTax))}
          ${li(t('e5'), '− ' + tk(e.rebate), 'minus', t('e5sub', { a: tk(e.rebateByIncome), b: tk(e.rebateByInvest), c: tk(e.rebateCap) }))}
          ${li(t('e6'), tk(e.netTax), 'total', t('e6sub', { amt: tk(e.netTax / 12) }))}
        </ul>
      </div>

      <div class="card">
        <h3>${t('g7')}</h3>
        <ul><li>${t('g7l1', { d: deadlineText(y) })}</li><li>${t('g7l2')}</li><li>${t('g7l3')}</li><li>${t('g7l4')}</li><li>${t('g7l5')}</li></ul>
      </div>

      <div class="card">
        <h3>${t('g8')}</h3>
        <div class="table-wrap"><table><thead><tr><th>${t('thYear')}</th><th class="r">${t('thGeneral')}</th><th class="r">${t('thWomen')}</th><th class="r">${t('thFirst')}</th><th class="r">${t('thTop')}</th></tr></thead>
          <tbody>${compare}</tbody></table></div>
      </div>

      <div class="note warn">${t('gDisclaimer')}</div>`;
  }

  /* ---------------- settings ---------------- */
  let editId = null;
  let draft = null;

  function renderSettings() {
    if (!editId) editId = resolveId(inputs.presetId);
    draft = clone(rulesFor(editId));
    drawSettings();
  }

  const PLAIN_HINT = /^(rebate\.(income|invest)Pct|salaryExemption\.divisor)$/;
  function numField(path, label, hint) {
    const val = path.split('.').reduce((o, k) => (o == null ? o : o[k]), draft);
    const h = hint != null ? hint : PLAIN_HINT.test(path) ? '' : words(val);
    return `<div class="field"><label>${label}</label>
      <input type="number" min="0" step="any" data-path="${path}" value="${val == null ? '' : val}" />
      <div class="hint">${h}</div></div>`;
  }

  function drawSettings() {
    const d = draft;
    $('settingsRoot').innerHTML = `
      <div class="card">
        <h2 style="margin-bottom:4px">${t('stLangTitle')}</h2>
        <p class="sub" style="margin:0 0 12px">${t('stLangSub')}</p>
        <div class="seg" role="group" id="langSeg">
          <button type="button" data-lang="bn" aria-pressed="${lang === 'bn'}">বাংলা</button>
          <button type="button" data-lang="en" aria-pressed="${lang === 'en'}">English</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div><h2>${t('stTitle')}</h2><p class="sub">${t('stSub')}</p></div>
        </div>
        <div class="field"><label for="editPreset">${t('stEditYear')}</label>
          <select id="editPreset">${YEARS.map((x) => `<option value="${x.id}"${x.id === editId ? ' selected' : ''}>${esc(yearLabel(x, true))}</option>`).join('')}</select>
          <div class="hint">${esc(spanText(d.startYear))} · ${esc(sourceText(d))}</div></div>
        <p class="sub" style="margin:0">${t('stYearsInfo', { n: dg(window.YEAR_RANGE.ahead) })}</p>
      </div>

      <div class="card">
        <h3>${t('st1')}</h3>
        <div class="settings-grid">
          ${CATS.map((c) => numField('thresholds.' + c.key, esc(L(c.label)))).join('')}
          ${numField('disabledChildBonus', t('stChild'))}
        </div>
      </div>

      <div class="card">
        <h3>${t('st2')}</h3>
        <p class="sub">${t('st2sub')}</p>
        <div class="table-wrap"><table class="slab-edit">
          <thead><tr><th>#</th><th>${t('thBandSize')}</th><th>${t('thRatePct')}</th><th></th></tr></thead>
          <tbody>${d.slabs.map((s, i) => `<tr>
            <td>${dg(i + 1)}</td>
            <td><input type="number" min="0" step="any" data-slab="${i}" data-f="width" value="${s.width == null ? '' : s.width}" placeholder="${t('restPh')}" /></td>
            <td><input class="w-rate" type="number" min="0" max="100" step="any" data-slab="${i}" data-f="rate" value="${s.rate}" /></td>
            <td><button class="btn danger sm" data-del="${i}" type="button" aria-label="${t('remove')}">✕</button></td></tr>`).join('')}</tbody>
        </table></div>
        <button class="btn ghost sm" id="addSlab" type="button" style="margin-top:10px">${t('addSlab')}</button>
      </div>

      <div class="card">
        <h3>${t('st3')}</h3>
        <div class="settings-grid">
          ${numField('salaryExemption.divisor', t('stDivisor'), t('stDivisorHint'))}
          ${numField('salaryExemption.cap', t('stExCap'))}
          ${numField('rebate.incomePct', t('stIncomePct'))}
          ${numField('rebate.investPct', t('stInvestPct'))}
          ${numField('rebate.cap', t('stRebateCap'))}
          ${numField('investmentCaps.dps', t('stDps'))}
          ${AREAS.map((a) => numField('minimumTax.' + a.key, t('stMinTax', { area: esc(L(a.label)) }))).join('')}
        </div>
      </div>

      <div class="card">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="saveRules" type="button">${t('stSave')}</button>
          <button class="btn ghost" id="resetRules" type="button">${t('stReset')}</button>
          <button class="btn ghost" id="exportRules" type="button">${t('stExport')}</button>
          <label class="btn ghost" for="importRules" style="cursor:pointer">${t('stImport')}</label>
          <input id="importRules" type="file" accept="application/json,.json" hidden />
        </div>
        <p class="sub" style="margin-top:10px">${t('stDev')}</p>
      </div>`;

    $('langSeg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $('editPreset').addEventListener('change', (e) => { editId = e.target.value; renderSettings(); });
    $('settingsRoot').querySelectorAll('input[data-path]').forEach((el) => el.addEventListener('input', () => {
      const keys = el.dataset.path.split('.');
      let o = draft;
      keys.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
      o[keys[keys.length - 1]] = el.value === '' ? 0 : Number(el.value);
      const hint = el.parentElement.querySelector('.hint');
      if (hint && !PLAIN_HINT.test(el.dataset.path)) hint.textContent = words(el.value);
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
      if (lastS && lastS.width == null) lastS.width = 500000;
      draft.slabs.push({ width: null, rate: lastS ? Number(lastS.rate) + 5 : 10 });
      drawSettings();
    });
    $('saveRules').addEventListener('click', saveRules);
    $('resetRules').addEventListener('click', () => {
      delete customRules[editId];
      store.set(KEY.rules, customRules);
      buildForm(); writeForm();
      renderSettings(); recalc();
      toast(t('tRulesReset'));
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
        draft = Object.assign(clone(yearById(editId)), obj);
        drawSettings();
        toast(t('tImported'));
      }).catch(() => toast(t('tBadFile')));
    });
  }

  function stripRules(r) {
    const { thresholds, disabledChildBonus, slabs, salaryExemption, rebate, minimumTax, investmentCaps } = r;
    return { thresholds, disabledChildBonus, slabs, salaryExemption, rebate, minimumTax, investmentCaps };
  }

  function saveRules() {
    // Keep order; only the last band may be open-ended.
    const slabs = draft.slabs.map((s) => ({ width: s.width == null || s.width === '' ? null : Math.max(0, Number(s.width)), rate: Math.max(0, Number(s.rate) || 0) }));
    for (let i = 0; i < slabs.length - 1; i++) if (slabs[i].width == null) slabs[i].width = 0;
    draft.slabs = slabs.filter((s, i) => i === slabs.length - 1 || s.width > 0);
    if (Number(draft.salaryExemption.divisor) < 1) draft.salaryExemption.divisor = 1;
    customRules[editId] = Object.assign(stripRules(draft), { verify: [] });
    store.set(KEY.rules, customRules);
    inputs.presetId = editId === CURRENT.id ? 'current' : editId;
    store.set(KEY.inputs, inputs);
    buildForm(); writeForm();
    recalc();
    drawSettings();
    toast(t('tRulesSaved'));
  }

  /* ---------------- history ---------------- */
  function renderHistory() {
    const h = store.get(KEY.history, []);
    const el = $('historyList');
    if (!h.length) { el.textContent = t('noHistory'); return; }
    el.innerHTML = h.map((x, i) => {
      const y = yearById(resolveId(String(x.inputs.presetId || 'current').replace(/^iy-(\d{4})-\d{2}$/, 'iy-$1')));
      const name = t('historyName', { year: iyText(y.startYear), amt: fmt(x.inputs.grossBefore) });
      return `<div class="history-item">
        <div><strong>${esc(name)}</strong><div class="sub">${t('historyLine', { date: dg(new Date(x.ts).toLocaleDateString('en-GB')), amt: tk(x.netTax) })}</div></div>
        <div style="display:flex;gap:6px"><button class="btn ghost sm" data-load="${i}" type="button">${t('open')}</button><button class="btn danger sm" data-rm="${i}" type="button" aria-label="${t('remove')}">✕</button></div></div>`;
    }).join('');
    el.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
      const item = h[Number(b.dataset.load)];
      inputs = Object.assign({}, DEFAULTS, item.inputs);
      inputs.presetId = String(inputs.presetId || 'current').replace(/^iy-(\d{4})-\d{2}$/, 'iy-$1');
      store.set(KEY.inputs, inputs);
      writeForm(); recalc();
      toast(t('tOpened'));
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
    h.unshift({ ts: Date.now(), inputs: clone(inputs), netTax: last.r.netTax });
    store.set(KEY.history, h.slice(0, 20));
    renderHistory();
    toast(t('tSaved'));
  });
  $('clearHistory').addEventListener('click', () => {
    if (!confirm(t('confirmClear'))) return;
    store.del(KEY.history);
    renderHistory();
  });
  $('resetInputs').addEventListener('click', () => {
    inputs = Object.assign({}, DEFAULTS);
    store.set(KEY.inputs, inputs);
    writeForm(); recalc();
    toast(t('tReset'));
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
    const round = (v) => (typeof v === 'number' ? Math.round(v) : v);
    const lines = [['Month', 'Salary', 'Bonus', 'Employee PF', 'Employer PF', 'Tax', 'Net to bank']];
    const en = window.MONTHS.en;
    r.months.forEach((m) => lines.push([en[m.index], m.gross, m.bonus, m.employeePF, m.employerPF, m.tax, m.net].map(round)));
    const tt = r.totals;
    lines.push(['Total', tt.gross, tt.bonus, tt.employeePF, tt.employerPF, tt.tax, tt.net].map(round));
    lines.push([]);
    lines.push(['Income year', `${last.rules.startYear}-${String((last.rules.startYear + 1) % 100).padStart(2, '0')}`]);
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
  applyStatic();
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
