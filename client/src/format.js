// Change these two lines to use your own currency (e.g. 'MYR' + 'en-MY').
const CURRENCY = 'MYR';
const LOCALE = 'en-MY';

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });
const moneyCompact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatMoney = (n) => money.format(n);
export const formatMoneyCompact = (n) => moneyCompact.format(n);

// 'YYYY-MM' -> 'Jan 2026'
export const formatMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'short', year: 'numeric' });
};

// 'YYYY-MM-DD' -> 'Jan 5, 2026'
export const formatDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
};

// Local date as 'YYYY-MM-DD'
export const isoDate = (date) => date.toLocaleDateString('en-CA');
export const today = () => isoDate(new Date());
