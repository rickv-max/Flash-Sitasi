export const methodSupports = (method, amount) => Number.isSafeInteger(amount) && amount >= method.minAmount && amount <= method.maxAmount;

export function publicPaymentMethods(body, configuredMethod = '') {
  const list = body.data?.payment_methods || body.payment_methods || (Array.isArray(body.data) ? body.data : null);
  if (!Array.isArray(list)) throw new Error('Invalid payment method response');
  return list.filter((item) => item && typeof item.id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(item.id) && item.id !== 'all' &&
    item.enabled !== false && item.available === true && (!configuredMethod || configuredMethod === 'all' || item.id === configuredMethod))
    .slice(0, 40).map((item) => {
      const min = Number(item.min_amount), max = Number(item.max_amount);
      return { id: item.id, name: typeof item.name === 'string' ? item.name.slice(0, 80) : item.id,
        minAmount: Number.isSafeInteger(min) && min > 0 ? min : item.id === 'qris' ? 5000 : 1000,
        maxAmount: Number.isSafeInteger(max) && max > 0 ? max : item.id === 'qris' ? 500000 : 5000000,
        reportedLimits: Number.isSafeInteger(max) && max > 0 };
    }).filter((item) => item.maxAmount >= item.minAmount);
}
