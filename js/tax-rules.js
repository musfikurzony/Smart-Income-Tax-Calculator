/* =====================================================================
 *  বাংলাদেশ আয়কর নিয়ম — সব পরিবর্তনযোগ্য মান এই ফাইলে
 *  Bangladesh income tax rules: every editable value lives here.
 * ---------------------------------------------------------------------
 *  HOW YEARS WORK
 *  The year list builds itself from today's date: every past year from
 *  YEAR_RANGE.first, the current income year, and YEAR_RANGE.ahead
 *  future years. It moves forward on its own every July.
 *
 *  • A year that has its own entry in TAX_RULE_SETS uses those official
 *    rules.
 *  • Any other year copies the closest earlier rule set and is marked
 *    "estimated". If ANNOUNCED_THRESHOLDS has a figure for that year,
 *    the tax-free limits are raised to match.
 *
 *  WHEN A NEW BUDGET IS PASSED
 *  Copy the first entry in TAX_RULE_SETS, put the copy at the top, set
 *  startYear and change the numbers. Nothing else needs editing.
 *  Users can also change any value from the app's ⚙️ Settings tab.
 *
 *  FIELD REFERENCE
 *  startYear          income year start (2026 means 1 Jul 2026 – 30 Jun 2027)
 *  thresholds         tax-free income limit by taxpayer category (Tk)
 *  disabledChildBonus extra tax-free limit per disabled child (Tk)
 *  slabs              bands after the tax-free limit, in order.
 *                     width = band size (Tk), null = all remaining income
 *                     rate  = percent
 *  salaryExemption    salary exemption = min(salary ÷ divisor, cap)
 *  rebate             rebate = min(incomePct% × taxable income,
 *                     investPct% × eligible investment, cap)
 *  minimumTax         minimum tax by area, when income is above the limit
 *  investmentCaps     yearly ceilings for particular investments
 *  verify             categories whose figures should be checked against
 *                     the gazette
 * ===================================================================== */

window.TAX_RULE_SETS = [
  {
    startYear: 2026,
    source: { bn: 'অর্থ আইন ২০২৬ (সংসদে পাস ২৯ জুন ২০২৬)', en: 'Finance Act 2026 (passed 29 June 2026)' },
    thresholds: {
      general: 400000,
      women: 425000,
      senior: 425000,
      disabled: 500000,
      thirdGender: 500000,
      freedomFighter: 525000,
      julyWarrior: 525000
    },
    disabledChildBonus: 50000,
    slabs: [
      { width: 300000, rate: 10 },
      { width: 400000, rate: 15 },
      { width: 500000, rate: 20 },
      { width: 2000000, rate: 25 },
      { width: null, rate: 30 }
    ],
    salaryExemption: { divisor: 3, cap: 500000 },
    rebate: { incomePct: 3, investPct: 10, cap: 750000 },
    minimumTax: { dhakaCtg: 5000, otherCity: 5000, other: 5000 },
    investmentCaps: { dps: 120000 },
    verify: ['women', 'senior', 'disabled', 'thirdGender', 'freedomFighter', 'julyWarrior'],
    notes: {
      bn: [
        'সাধারণ করদাতার করমুক্ত আয়সীমা ৩,৭৫,০০০ থেকে বাড়িয়ে ৪,০০,০০০ টাকা করা হয়েছে (২০২৬-২৭ ও ২০২৭-২৮ অর্থবছর)।',
        'ঘোষিত পরিকল্পনা: ২০২৮-২৯ ও ২০২৯-৩০ অর্থবছরে ৪,৫০,০০০ এবং ২০৩০-৩১ অর্থবছরে ৫,০০,০০০ টাকা।',
        'নারী, প্রবীণ, প্রতিবন্ধী, তৃতীয় লিঙ্গ ও মুক্তিযোদ্ধাদের সীমা এখানে অর্থ অধ্যাদেশ ২০২৫ অনুযায়ী রাখা হয়েছে; অর্থ আইন ২০২৬-এর গেজেটে বাড়ানো হয়ে থাকলে ⚙️ সেটিংস থেকে বদলে নিন।',
        'বিনিয়োগ কর রেয়াত কমানো হয়েছে: বিনিয়োগের ১৫% থেকে ১০%, আর সর্বোচ্চ সীমা ১০ লাখ থেকে ৭.৫ লাখ টাকা। ফলে একই রেয়াত পেতে আগের চেয়ে বেশি বিনিয়োগ লাগবে।',
        'কালো টাকা সাদা করার বিশেষ সুযোগ বাতিল করা হয়েছে।'
      ],
      en: [
        'The general tax-free limit rises from Tk 3,75,000 to Tk 4,00,000 (fiscal years 2026-27 and 2027-28).',
        'Announced plan: Tk 4,50,000 for 2028-29 and 2029-30, and Tk 5,00,000 for 2030-31.',
        'The limits for women, seniors, disabled, third-gender taxpayers and freedom fighters are kept at the Finance Ordinance 2025 figures. If the Finance Act 2026 gazette raised them, change them in ⚙️ Settings.',
        'The investment rebate was cut from 15% to 10% of investment, and the ceiling from Tk 10 lakh to Tk 7.5 lakh, so the same rebate now needs more investment.',
        'The special scheme for whitening undisclosed money has been abolished.'
      ]
    }
  },
  {
    startYear: 2025,
    source: { bn: 'অর্থ অধ্যাদেশ ২০২৫', en: 'Finance Ordinance 2025' },
    thresholds: {
      general: 375000,
      women: 425000,
      senior: 425000,
      disabled: 500000,
      thirdGender: 500000,
      freedomFighter: 525000,
      julyWarrior: 525000
    },
    disabledChildBonus: 50000,
    slabs: [
      { width: 300000, rate: 10 },
      { width: 400000, rate: 15 },
      { width: 500000, rate: 20 },
      { width: 2000000, rate: 25 },
      { width: null, rate: 30 }
    ],
    salaryExemption: { divisor: 3, cap: 500000 },
    rebate: { incomePct: 3, investPct: 15, cap: 1000000 },
    minimumTax: { dhakaCtg: 5000, otherCity: 5000, other: 5000 },
    investmentCaps: { dps: 120000 },
    verify: [],
    notes: {
      bn: [
        '৫% স্ল্যাব বাদ দেওয়া হয়েছে; করমুক্ত সীমার পরেই ১০% দিয়ে শুরু।',
        'ন্যূনতম কর সব এলাকায় একই — ৫,০০০ টাকা।',
        '“জুলাই যোদ্ধা” (গেজেটভুক্ত আহত) করদাতাদের জন্য নতুন শ্রেণি যোগ হয়েছে।'
      ],
      en: [
        'The 5% slab was removed; tax starts at 10% right after the tax-free limit.',
        'Minimum tax is the same in every area: Tk 5,000.',
        'A new category was added for gazetted injured “July warriors”.'
      ]
    }
  },
  {
    startYear: 2024,
    source: { bn: 'অর্থ আইন ২০২৪', en: 'Finance Act 2024' },
    thresholds: {
      general: 350000,
      women: 400000,
      senior: 400000,
      disabled: 475000,
      thirdGender: 475000,
      freedomFighter: 500000,
      julyWarrior: 350000
    },
    disabledChildBonus: 50000,
    slabs: [
      { width: 100000, rate: 5 },
      { width: 400000, rate: 10 },
      { width: 500000, rate: 15 },
      { width: 500000, rate: 20 },
      { width: 2000000, rate: 25 },
      { width: null, rate: 30 }
    ],
    salaryExemption: { divisor: 3, cap: 500000 },
    rebate: { incomePct: 3, investPct: 15, cap: 1000000 },
    minimumTax: { dhakaCtg: 5000, otherCity: 4000, other: 3000 },
    investmentCaps: { dps: 120000 },
    verify: [],
    notes: {
      bn: ['এই বছরে “জুলাই যোদ্ধা” শ্রেণি ছিল না, তাই সাধারণ সীমা ধরা হয়েছে।'],
      en: ['The “July warrior” category did not exist this year, so the general limit is used.']
    }
  }
];

/* Government-announced general tax-free limits for future income years
 * (key = income-year start). Estimated years use these; the other
 * categories move up by the same amount. Years after the last entry keep
 * the last figure. */
window.ANNOUNCED_THRESHOLDS = {
  2027: 400000,
  2028: 450000,
  2029: 450000,
  2030: 500000
};

/* How far the year list reaches */
window.YEAR_RANGE = {
  first: 2024,   // oldest income year shown
  ahead: 5       // future years shown after the current income year
};

/* Taxpayer categories */
window.TAXPAYER_CATEGORIES = [
  { key: 'general',        label: { bn: 'সাধারণ করদাতা (পুরুষ)', en: 'General taxpayer (male)' } },
  { key: 'women',          label: { bn: 'নারী করদাতা', en: 'Woman taxpayer' } },
  { key: 'senior',         label: { bn: 'প্রবীণ করদাতা (৬৫ বছর বা তার বেশি)', en: 'Senior citizen (65 or older)' } },
  { key: 'disabled',       label: { bn: 'প্রতিবন্ধী (শারীরিকভাবে প্রতিবন্ধী) করদাতা', en: 'Taxpayer with a disability' } },
  { key: 'thirdGender',    label: { bn: 'তৃতীয় লিঙ্গের করদাতা', en: 'Third-gender taxpayer' } },
  { key: 'freedomFighter', label: { bn: 'গেজেটভুক্ত যুদ্ধাহত মুক্তিযোদ্ধা', en: 'Gazetted war-wounded freedom fighter' } },
  { key: 'julyWarrior',    label: { bn: 'গেজেটভুক্ত “জুলাই যোদ্ধা” (আহত)', en: 'Gazetted injured “July warrior”' } }
];

/* Minimum-tax areas */
window.TAX_AREAS = [
  { key: 'dhakaCtg',  label: { bn: 'ঢাকা / চট্টগ্রাম সিটি কর্পোরেশন', en: 'Dhaka / Chattogram city corporation' } },
  { key: 'otherCity', label: { bn: 'অন্যান্য সিটি কর্পোরেশন', en: 'Other city corporation' } },
  { key: 'other',     label: { bn: 'সিটি কর্পোরেশনের বাইরে', en: 'Outside city corporations' } }
];

/* Investments eligible for the rebate. capKey links to investmentCaps. */
window.INVESTMENT_TYPES = [
  { key: 'dps',       capKey: 'dps',
    label: { bn: 'ডিপিএস (DPS)', en: 'DPS (deposit pension scheme)' },
    hint:  { bn: 'বছরে সর্বোচ্চ গণনাযোগ্য সীমা আছে', en: 'Has a yearly ceiling' } },
  { key: 'sanchay',
    label: { bn: 'সঞ্চয়পত্র / ট্রেজারি বন্ড', en: 'Savings certificates / treasury bonds' },
    hint:  { bn: 'সরকার অনুমোদিত সঞ্চয়পত্র ও বন্ড', en: 'Government savings certificates and bonds' } },
  { key: 'shares',
    label: { bn: 'তালিকাভুক্ত শেয়ার / মিউচুয়াল ফান্ড', en: 'Listed shares / mutual funds' },
    hint:  { bn: 'স্টক এক্সচেঞ্জে তালিকাভুক্ত সিকিউরিটিজ', en: 'Securities listed on a stock exchange' } },
  { key: 'insurance',
    label: { bn: 'জীবন বীমার প্রিমিয়াম', en: 'Life insurance premium' },
    hint:  { bn: 'পলিসির মূল্যের ১০% পর্যন্ত প্রিমিয়াম গণনাযোগ্য', en: 'Premium counts up to 10% of the sum assured' } },
  { key: 'other',
    label: { bn: 'অন্যান্য যোগ্য খাত', en: 'Other eligible items' },
    hint:  { bn: 'যাকাত তহবিল, অনুমোদিত দান, কল্যাণ তহবিল ইত্যাদি', en: 'Zakat fund, approved donations, welfare funds, etc.' } }
];

window.MONTHS = {
  bn: ['জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন'],
  en: ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June']
};

/* Form defaults (what a first-time visitor sees). presetId 'current'
 * means "whatever the current income year is". */
window.DEFAULT_INPUTS = {
  presetId: 'current',
  category: 'general',
  area: 'dhakaCtg',
  disabledChildren: 0,
  grossBefore: 100000,
  incrementMonth: 7,          // 0 = July … 11 = June; -1 = no increment
  grossAfter: 106000,
  festivalBonus: 100000,
  festivalBonusMonth: 5,      // December
  otherBonus: 0,
  otherBonusMonth: 7,         // February
  pfBase: 'gross',            // 'gross' | 'basic'
  basicPct: 60,
  employerPfPct: 5,
  employeePfPct: 5,
  pfCountsAsInvestment: true,
  otherIncome: 0,
  inv_dps: 0,
  inv_sanchay: 185533,
  inv_shares: 0,
  inv_insurance: 0,
  inv_other: 0,
  taxPaid: 0
};
