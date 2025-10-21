// utils/config.js
function toNumberOrDefault(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const monthlyFee = toNumberOrDefault(process.env.LISTING_FEE_MONTHLY ?? process.env.LISTING_FEE, 5000.00);
const yearlyFee = toNumberOrDefault(process.env.LISTING_FEE_YEARLY ?? String(monthlyFee * 12), monthlyFee * 12);

module.exports = { toNumberOrDefault, monthlyFee, yearlyFee };
