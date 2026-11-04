/**
 * Shared Currency & Numeric Formatters for ParkSync
 * Standardized to Indian Rupees (INR ₹)
 */

export const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format any number, decimal, or string as Indian Rupees (INR ₹)
 * Examples:
 *   100     -> ₹100.00
 *   1250    -> ₹1,250.00
 *   "50.5"  -> ₹50.50
 *   0       -> ₹0.00
 */
export const formatINR = (amount) => {
  const numericAmount = Number(amount || 0);
  return inrFormatter.format(isNaN(numericAmount) ? 0 : numericAmount);
};

export const formatCurrency = formatINR;

export default formatINR;

