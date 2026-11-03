/* =====================================================================
 *  বাংলাদেশ আয়কর নিয়ম — সব পরিবর্তনযোগ্য মান এই ফাইলে
 *  Bangladesh income tax rules: every editable value lives here.
 * ---------------------------------------------------------------------
 *  নতুন বাজেট এলে শুধু এই ফাইলে একটি নতুন preset যোগ করুন (বা পুরনোটা
 *  কপি করে মান বদলান)। ক্যালকুলেটর, নিয়ম-গাইড, স্ল্যাব টেবিল সব কিছু
 *  এখান থেকেই নিজে তৈরি হয় — অন্য কোনো ফাইল ছোঁয়ার দরকার নেই।
 *
 *  When a new budget arrives, add a preset below (or copy the latest one
 *  and change its numbers). The calculator, the rules guide and every
 *  table are generated from this data — no other file needs editing.
 *
 *  ব্যবহারকারী অ্যাপের "⚙️ নিয়ম ও স্ল্যাব" প্যানেল থেকেও এই মানগুলো
 *  বদলাতে পারেন; সেগুলো তাঁর ব্রাউজারে সংরক্ষিত থাকে।
 *
 *  Field reference
 *  ---------------
 *  thresholds     করমুক্ত আয়সীমা, করদাতার শ্রেণি অনুযায়ী (টাকা)
 *  disabledChildBonus  প্রতিবন্ধী সন্তানের পিতা/মাতা/অভিভাবকের জন্য
 *                 প্রতি সন্তানে অতিরিক্ত করমুক্ত সীমা
 *  slabs          করমুক্ত সীমার পরের ধাপগুলো, ক্রম অনুযায়ী।
 *                 width = ধাপের আকার (টাকা), null = বাকি সব আয়
 *                 rate  = শতাংশ (%)
 *  salaryExemption বেতন আয়ের অব্যাহতি: মোট বেতনের ১/divisor অথবা cap,
 *                 যেটি কম
 *  rebate         বিনিয়োগ কর রেয়াত = সর্বনিম্ন (incomePct% × করযোগ্য আয়,
 *                 investPct% × যোগ্য বিনিয়োগ, cap)
 *  minimumTax     ন্যূনতম কর (করযোগ্য আয় করমুক্ত সীমা ছাড়ালে), এলাকাভেদে
 *  investmentCaps নির্দিষ্ট বিনিয়োগের বার্ষিক সর্বোচ্চ গণনাযোগ্য সীমা
 *  verify         যেসব মান সরকারি গেজেটের সঙ্গে মিলিয়ে নেওয়া দরকার
 * ===================================================================== */

window.TAX_PRESETS = [
  {
    id: 'iy-2026-27',
    label: 'আয়বর্ষ ২০২৬-২৭ (করবর্ষ ২০২৭-২৮)',
    shortLabel: '২০২৬-২৭',
    incomeYear: '১ জুলাই ২০২৬ – ৩০ জুন ২০২৭',
    assessmentYear: '২০২৭-২৮',
    source: 'অর্থ আইন ২০২৬ (সংসদে পাস ২৯ জুন ২০২৬)',
    returnDeadline: '৩০ নভেম্বর ২০২৭',
    current: true,
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
    rebate: { incomePct: 3, investPct: 15, cap: 1000000 },
    minimumTax: { dhakaCtg: 5000, otherCity: 5000, other: 5000 },
    investmentCaps: { dps: 120000 },
    verify: ['women', 'senior', 'disabled', 'thirdGender', 'freedomFighter', 'julyWarrior'],
    notes: [
      'সাধারণ করদাতার করমুক্ত আয়সীমা ৩,৭৫,০০০ থেকে বাড়িয়ে ৪,০০,০০০ টাকা করা হয়েছে (২০২৬-২৭ ও ২০২৭-২৮ অর্থবছর)।',
      'ঘোষিত পরিকল্পনা: ২০২৮-২৯ ও ২০২৯-৩০ অর্থবছরে ৪,৫০,০০০ এবং ২০৩০-৩১ অর্থবছরে ৫,০০,০০০ টাকা।',
      'নারী, প্রবীণ, প্রতিবন্ধী, তৃতীয় লিঙ্গ ও মুক্তিযোদ্ধাদের সীমা এখানে অর্থ অধ্যাদেশ ২০২৫ অনুযায়ী রাখা হয়েছে; অর্থ আইন ২০২৬-এর গেজেটে বাড়ানো হয়ে থাকলে ⚙️ সেটিংস থেকে বদলে নিন।',
      'কালো টাকা সাদা করার বিশেষ সুযোগ বাতিল করা হয়েছে।'
    ]
  },
  {
    id: 'iy-2025-26',
    label: 'আয়বর্ষ ২০২৫-২৬ (করবর্ষ ২০২৬-২৭)',
    shortLabel: '২০২৫-২৬',
    incomeYear: '১ জুলাই ২০২৫ – ৩০ জুন ২০২৬',
    assessmentYear: '২০২৬-২৭',
    source: 'অর্থ অধ্যাদেশ ২০২৫',
    returnDeadline: '৩০ নভেম্বর ২০২৬',
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
    notes: [
      'এই বছরের রিটার্ন জমার শেষ তারিখ ৩০ নভেম্বর ২০২৬ (কর দিবস)।',
      '৫% স্ল্যাব বাদ দেওয়া হয়েছে; করমুক্ত সীমার পরেই ১০% দিয়ে শুরু।',
      'ন্যূনতম কর সব এলাকায় একই — ৫,০০০ টাকা।',
      '“জুলাই যোদ্ধা” (গেজেটভুক্ত আহত) করদাতাদের জন্য নতুন শ্রেণি যোগ হয়েছে।'
    ]
  },
  {
    id: 'iy-2024-25',
    label: 'আয়বর্ষ ২০২৪-২৫ (করবর্ষ ২০২৫-২৬) — পুরনো',
    shortLabel: '২০২৪-২৫',
    incomeYear: '১ জুলাই ২০২৪ – ৩০ জুন ২০২৫',
    assessmentYear: '২০২৫-২৬',
    source: 'অর্থ আইন ২০২৪',
    returnDeadline: '৩০ নভেম্বর ২০২৫',
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
    notes: [
      'তুলনার জন্য রাখা পুরনো নিয়ম। এই বছরে “জুলাই যোদ্ধা” শ্রেণি ছিল না, তাই সাধারণ সীমা ধরা হয়েছে।'
    ]
  }
];

/* করদাতার শ্রেণি — অ্যাপের ড্রপডাউন ও নিয়ম-গাইড এখান থেকে তৈরি হয় */
window.TAXPAYER_CATEGORIES = [
  { key: 'general',        label: 'সাধারণ করদাতা (পুরুষ)' },
  { key: 'women',          label: 'নারী করদাতা' },
  { key: 'senior',         label: 'প্রবীণ করদাতা (৬৫ বছর বা তার বেশি)' },
  { key: 'disabled',       label: 'প্রতিবন্ধী (শারীরিকভাবে প্রতিবন্ধী) করদাতা' },
  { key: 'thirdGender',    label: 'তৃতীয় লিঙ্গের করদাতা' },
  { key: 'freedomFighter', label: 'গেজেটভুক্ত যুদ্ধাহত মুক্তিযোদ্ধা' },
  { key: 'julyWarrior',    label: 'গেজেটভুক্ত “জুলাই যোদ্ধা” (আহত)' }
];

/* ন্যূনতম করের এলাকা */
window.TAX_AREAS = [
  { key: 'dhakaCtg',  label: 'ঢাকা / চট্টগ্রাম সিটি কর্পোরেশন' },
  { key: 'otherCity', label: 'অন্যান্য সিটি কর্পোরেশন' },
  { key: 'other',     label: 'সিটি কর্পোরেশনের বাইরে' }
];

/* বিনিয়োগ কর রেয়াতের জন্য যোগ্য খাত — ইনপুট ফর্ম এখান থেকে তৈরি হয়।
 * capKey থাকলে preset-এর investmentCaps থেকে সর্বোচ্চ সীমা নেওয়া হয়। */
window.INVESTMENT_TYPES = [
  { key: 'dps',       label: 'ডিপিএস (DPS)',                         hint: 'বছরে সর্বোচ্চ গণনাযোগ্য সীমা আছে', capKey: 'dps' },
  { key: 'sanchay',   label: 'সঞ্চয়পত্র / ট্রেজারি বন্ড',             hint: 'সরকার অনুমোদিত সঞ্চয়পত্র ও বন্ড' },
  { key: 'shares',    label: 'তালিকাভুক্ত শেয়ার / মিউচুয়াল ফান্ড',    hint: 'স্টক এক্সচেঞ্জে তালিকাভুক্ত সিকিউরিটিজ' },
  { key: 'insurance', label: 'জীবন বীমার প্রিমিয়াম',                 hint: 'পলিসির মূল্যের ১০% পর্যন্ত প্রিমিয়াম গণনাযোগ্য' },
  { key: 'other',     label: 'অন্যান্য যোগ্য খাত',                    hint: 'যাকাত তহবিল, অনুমোদিত দান, কল্যাণ তহবিল ইত্যাদি' }
];

window.MONTHS_BN = ['জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন'];

/* ফর্মের ডিফল্ট মান (প্রথমবার খুললে যা দেখা যায়) */
window.DEFAULT_INPUTS = {
  presetId: 'iy-2026-27',
  category: 'general',
  area: 'dhakaCtg',
  disabledChildren: 0,
  grossBefore: 100000,
  incrementMonth: 7,          // ০ = জুলাই … ১১ = জুন; -1 = কোনো ইনক্রিমেন্ট নেই
  grossAfter: 106000,
  festivalBonus: 100000,
  festivalBonusMonth: 5,      // ডিসেম্বর
  otherBonus: 0,
  otherBonusMonth: 7,         // ফেব্রুয়ারি
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
