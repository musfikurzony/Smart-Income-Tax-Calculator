/* =====================================================================
 *  Tax engine — pure functions, no DOM access.
 *  compute(inputs, rules) -> result object used by the UI.
 *  Works in the browser (window.TaxEngine) and in Node (module.exports)
 *  so it can be tested from the command line.
 * ===================================================================== */
(function (root) {
  'use strict';

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const pos = (v) => Math.max(0, num(v));

  /** Tax-free threshold for a category, plus the disabled-child allowance. */
  function thresholdFor(rules, category, disabledChildren) {
    const t = rules.thresholds || {};
    const base = num(t[category] != null ? t[category] : t.general);
    return base + pos(disabledChildren) * num(rules.disabledChildBonus);
  }

  /** Full slab list including the 0% band, for a given threshold. */
  function buildBands(rules, threshold) {
    const bands = [{ width: threshold, rate: 0, isFree: true }];
    (rules.slabs || []).forEach((s) => {
      bands.push({ width: s.width == null || s.width === '' ? null : pos(s.width), rate: num(s.rate) });
    });
    // Guarantee an open-ended final band.
    if (bands[bands.length - 1].width != null) bands.push({ width: null, rate: bands[bands.length - 1].rate });
    return bands;
  }

  /** Apply the bands to an amount. Returns tax and a per-band breakdown. */
  function taxOnBands(amount, bands) {
    let remaining = pos(amount);
    let lower = 0;
    let tax = 0;
    let marginal = 0;
    const rows = bands.map((b) => {
      const upper = b.width == null ? Infinity : lower + b.width;
      const taxed = Math.max(0, Math.min(remaining, b.width == null ? remaining : b.width));
      const t = (taxed * b.rate) / 100;
      if (taxed > 0) marginal = b.rate;
      remaining -= taxed;
      tax += t;
      const row = { from: lower, to: upper, width: b.width, rate: b.rate, taxed, tax: t, isFree: !!b.isFree };
      lower = upper;
      return row;
    });
    return { tax, rows, marginal };
  }

  /** Month-by-month salary for Jul (0) … Jun (11). */
  function monthlySalary(inp) {
    const inc = num(inp.incrementMonth);
    const months = [];
    for (let i = 0; i < 12; i++) {
      const gross = inc >= 0 && i >= inc ? pos(inp.grossAfter) : pos(inp.grossBefore);
      let bonus = 0;
      if (num(inp.festivalBonusMonth) === i) bonus += pos(inp.festivalBonus);
      if (num(inp.otherBonusMonth) === i) bonus += pos(inp.otherBonus);
      const pfBaseAmt = inp.pfBase === 'basic' ? (gross * pos(inp.basicPct)) / 100 : gross;
      months.push({
        index: i,
        gross,
        bonus,
        employeePF: (pfBaseAmt * pos(inp.employeePfPct)) / 100,
        employerPF: (pfBaseAmt * pos(inp.employerPfPct)) / 100
      });
    }
    return months;
  }

  const sum = (arr, key) => arr.reduce((a, m) => a + m[key], 0);

  /** The annual assessment, without the monthly schedule. */
  function assess(inp, rules) {
    const months = monthlySalary(inp);
    const salaryGross = sum(months, 'gross');
    const bonusTotal = sum(months, 'bonus');
    const employeePF = sum(months, 'employeePF');
    const employerPF = sum(months, 'employerPF');

    // Employer's contribution to a recognised PF is salary income.
    const salaryIncome = salaryGross + bonusTotal + employerPF;
    const ex = rules.salaryExemption || { divisor: 3, cap: 500000 };
    const exemption = Math.min(salaryIncome / Math.max(1, num(ex.divisor)), pos(ex.cap));
    const taxableSalary = Math.max(0, salaryIncome - exemption);
    const otherIncome = pos(inp.otherIncome);
    const taxableIncome = taxableSalary + otherIncome;

    const threshold = thresholdFor(rules, inp.category, inp.disabledChildren);
    const bands = buildBands(rules, threshold);
    const slab = taxOnBands(taxableIncome, bands);
    const grossTax = slab.tax;

    // Eligible investment
    const caps = rules.investmentCaps || {};
    const types = (root.INVESTMENT_TYPES || []);
    const investRows = types.map((t) => {
      const entered = pos(inp['inv_' + t.key]);
      const cap = t.capKey && caps[t.capKey] ? pos(caps[t.capKey]) : null;
      const counted = cap != null ? Math.min(entered, cap) : entered;
      return { key: t.key, label: t.label, entered, cap, counted };
    });
    const pfInvest = inp.pfCountsAsInvestment ? employeePF + employerPF : 0;
    const personalInvest = investRows.reduce((a, r) => a + r.counted, 0);
    const eligibleInvest = personalInvest + pfInvest;

    const rb = rules.rebate || { incomePct: 3, investPct: 15, cap: 1000000 };
    const rebateByIncome = (taxableIncome * num(rb.incomePct)) / 100;
    const rebateByInvest = (eligibleInvest * num(rb.investPct)) / 100;
    const rebateCap = pos(rb.cap);
    const rebateRaw = Math.min(rebateByIncome, rebateByInvest, rebateCap);
    const rebate = Math.min(rebateRaw, grossTax);
    const rebateLimitedBy =
      rebateRaw === rebateCap ? 'cap' : rebateRaw === rebateByIncome ? 'income' : 'invest';

    // Investment needed to unlock the full rebate
    const maxRebate = Math.min(rebateByIncome, rebateCap);
    const investForMaxRebate = num(rb.investPct) > 0 ? (maxRebate * 100) / num(rb.investPct) : 0;
    const investShortfall = Math.max(0, investForMaxRebate - eligibleInvest);

    const taxAfterRebate = Math.max(0, grossTax - rebate);
    const minTaxTable = rules.minimumTax || {};
    const minimumTax = taxableIncome > threshold ? pos(minTaxTable[inp.area] != null ? minTaxTable[inp.area] : minTaxTable.dhakaCtg) : 0;
    const minimumApplied = taxableIncome > threshold && taxAfterRebate < minimumTax;
    const netTax = Math.round(taxableIncome > threshold ? Math.max(taxAfterRebate, minimumTax) : 0);

    // Extra tax that could still be saved by investing more
    const potentialSaving = Math.max(0, Math.min(maxRebate, grossTax) - rebate);
    const realisableSaving = Math.max(0, Math.min(potentialSaving, netTax - minimumTax));

    const taxPaid = pos(inp.taxPaid);
    const totalIncome = salaryIncome + otherIncome;

    return {
      months,
      salaryGross, bonusTotal, employeePF, employerPF,
      salaryIncome, exemption, taxableSalary, otherIncome, taxableIncome, totalIncome,
      threshold, bands, slabRows: slab.rows, marginalRate: slab.marginal, grossTax,
      investRows, pfInvest, personalInvest, eligibleInvest,
      rebateByIncome, rebateByInvest, rebateCap, rebate, rebateLimitedBy,
      maxRebate, investForMaxRebate, investShortfall, potentialSaving: realisableSaving,
      taxAfterRebate, minimumTax, minimumApplied, netTax,
      taxPaid, balanceDue: Math.max(0, netTax - taxPaid), refund: Math.max(0, taxPaid - netTax),
      effectiveRate: totalIncome > 0 ? (netTax / totalIncome) * 100 : 0,
      monthlyAverage: netTax / 12
    };
  }

  /** Split an integer total across n slots as evenly as possible. */
  function spread(total, n) {
    if (n <= 0) return [];
    const t = Math.round(total);
    const base = Math.floor(t / n);
    const out = Array(n).fill(base);
    let rem = t - base * n;
    for (let i = n - 1; i >= 0 && rem > 0; i--, rem--) out[i]++;
    return out;
  }

  /**
   * Full computation with the monthly withholding schedule.
   * Before the increment, the employer withholds on the salary it knows
   * about (the pre-increment rate for all 12 months). From the increment
   * month on, the remaining tax is spread over the remaining months.
   */
  function compute(inp, rules) {
    const r = assess(inp, rules);
    const inc = num(inp.incrementMonth);
    let schedule;
    if (inc > 0 && inc < 12 && pos(inp.grossAfter) !== pos(inp.grossBefore)) {
      const projected = assess(Object.assign({}, inp, { grossAfter: inp.grossBefore }), rules);
      const early = Math.round(projected.netTax / 12);
      const earlyTotal = Math.min(early * inc, r.netTax);
      const earlyArr = spread(earlyTotal, inc);
      schedule = earlyArr.concat(spread(r.netTax - earlyTotal, 12 - inc));
    } else {
      schedule = spread(r.netTax, 12);
    }
    r.months.forEach((m, i) => {
      m.tax = schedule[i];
      m.net = m.gross + m.bonus - m.employeePF - m.tax;
    });
    r.totals = {
      gross: r.salaryGross,
      bonus: r.bonusTotal,
      employeePF: r.employeePF,
      employerPF: r.employerPF,
      tax: schedule.reduce((a, b) => a + b, 0),
      net: r.months.reduce((a, m) => a + m.net, 0)
    };
    return r;
  }

  /* ---------------- HR-style "Computation of Income" report ---------------- */

  /**
   * Builds the figures for a payroll-style tax computation sheet.
   * Gross salary is split into basic, house rent, conveyance and medical:
   *   conveyance = fixed monthly amount × 12
   *   medical    = medicalPct% of gross
   *   basic + house rent = the rest, with house rent = hraPct% of basic
   * The employer's PF is employerPfPct% of gross.
   */
  function computeCOI(p, rules) {
    const months = [];
    const inc = num(p.incrementMonth);
    for (let i = 0; i < 12; i++) months.push(inc >= 0 && i >= inc ? pos(p.grossAfter) : pos(p.grossBefore));
    const yearlyGross = months.reduce((a, b) => a + b, 0);
    const conveyance = Math.min(pos(p.convMonthly) * 12, yearlyGross);
    const medical = (yearlyGross * pos(p.medicalPct)) / 100;
    const basic = Math.max(0, yearlyGross - conveyance - medical) / (1 + pos(p.hraPct) / 100);
    const houseRent = (basic * pos(p.hraPct)) / 100;
    const employerPF = (yearlyGross * pos(p.employerPfPct)) / 100;
    const incentive = pos(p.incentive);
    const thirteenth = pos(p.thirteenth);
    const overtime = pos(p.overtime);
    const totalIncome = yearlyGross + incentive + thirteenth + overtime + employerPF;

    const ex = rules.salaryExemption || { divisor: 3, cap: 500000 };
    const exemptionShare = totalIncome / Math.max(1, num(ex.divisor));
    const exemption = Math.min(exemptionShare, pos(ex.cap));
    const taxable = Math.max(0, totalIncome - exemption);

    const threshold = thresholdFor(rules, p.category || 'general', p.disabledChildren);
    const slab = taxOnBands(taxable, buildBands(rules, threshold));
    const grossTax = slab.tax;

    const rb = rules.rebate || { incomePct: 3, investPct: 15, cap: 1000000 };
    const rebateByIncome = (taxable * num(rb.incomePct)) / 100;
    const rebateCap = pos(rb.cap);
    const investNeeded = num(rb.investPct) > 0 ? (Math.min(rebateByIncome, rebateCap) * 100) / num(rb.investPct) : 0;
    const investment = p.investMode === 'actual' ? pos(p.investment) : investNeeded;
    const rebateByInvest = (investment * num(rb.investPct)) / 100;
    const rebate = Math.min(rebateByIncome, rebateByInvest, rebateCap, grossTax);

    const minTable = rules.minimumTax || {};
    const above = taxable > threshold;
    const minimumTax = above ? pos(minTable[p.area] != null ? minTable[p.area] : minTable.dhakaCtg) : 0;
    const netTax = Math.round(above ? Math.max(grossTax - rebate, minimumTax) : 0);

    const afterExcess = Math.max(0, netTax - pos(p.excessAdj));
    const afterCar = Math.max(0, afterExcess - pos(p.carTax));
    const tdsMonth = num(p.tdsMonth); // last month already deducted, -1 = none
    const tds = tdsMonth >= 0 ? pos(p.tdsAmount) : 0;
    const remaining = Math.max(0, afterCar - tds);
    const startMonth = Math.min(11, tdsMonth + 1);
    const monthsLeft = 12 - startMonth;
    const monthlyTax = Math.round(remaining / monthsLeft);

    return {
      yearlyGross, basic, houseRent, conveyance, medical, employerPF, incentive, thirteenth, overtime,
      totalIncome, exemptionShare, exemption, taxable, threshold, slabRows: slab.rows, grossTax,
      rebateByIncome, rebateByInvest, rebateCap, investment, investNeeded, rebate,
      minimumTax, netTax, afterExcess, afterCar, tds, tdsMonth, remaining, startMonth, monthsLeft, monthlyTax
    };
  }

  /* ---------------- years ---------------- */

  /** Income year that contains a date (July to June). 2026 = 2026-27. */
  function currentIncomeYear(d) {
    return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  }

  /** Announced general limit for year y (latest entry at or before y). */
  function announcedFor(announced, y) {
    let best = null;
    Object.keys(announced || {}).map(Number).sort((a, b) => a - b).forEach((k) => {
      if (k <= y) best = announced[k];
    });
    return best;
  }

  /**
   * Builds the full year list, newest first. Years without their own rule
   * set copy the closest earlier one and are marked kind: 'estimated'.
   */
  function buildYears(sets, announced, range, today) {
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const sorted = sets.slice().sort((a, b) => a.startYear - b.startYear);
    const cur = currentIncomeYear(today || new Date());
    const annKeys = Object.keys(announced || {}).map(Number);
    const first = Math.min(range && range.first != null ? range.first : sorted[0].startYear, sorted[0].startYear);
    const last = Math.max(cur + (range && range.ahead != null ? range.ahead : 5), sorted[sorted.length - 1].startYear, ...annKeys);
    const years = [];
    for (let y = first; y <= last; y++) {
      const exact = sorted.find((s) => s.startYear === y);
      let r;
      if (exact) {
        r = clone(exact);
        r.kind = 'official';
      } else {
        const base = sorted.slice().reverse().find((s) => s.startYear < y) || sorted[0];
        r = clone(base);
        r.startYear = y;
        r.kind = 'estimated';
        r.basedOn = base.startYear;
        r.notes = { bn: [], en: [] };
        r.verify = Object.keys(r.thresholds);
        const ann = y > base.startYear ? announcedFor(announced, y) : null;
        if (ann != null) {
          const delta = ann - r.thresholds.general;
          Object.keys(r.thresholds).forEach((k) => { r.thresholds[k] += delta; });
          r.announcedGeneral = ann;
        }
      }
      r.id = 'iy-' + y;
      r.current = y === cur;
      years.push(r);
    }
    return years.reverse();
  }

  const api = { compute, assess, thresholdFor, buildBands, taxOnBands, spread, buildYears, currentIncomeYear, computeCOI };
  root.TaxEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
