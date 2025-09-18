export function currency(amount: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}

export function format(amount: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat('en-US', options).format(amount)
}

export function formatK(amount: number, style: Intl.NumberFormatOptions['style'] = 'currency') {
  if (amount < 1) return amount

  return new Intl.NumberFormat('en-US', {
    style,
    currency: 'USD',
    notation: 'compact',
    compactDisplay: 'short',
  }).format(amount)
}
