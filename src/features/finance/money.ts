export function centsFromDecimal(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100)
  }

  const normalized = input
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  if (!normalized) return 0
  return Math.round(Number(normalized) * 100)
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

export function formatDecimalCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function splitDailyRate(dailyRateCents: number): {
  morningCents: number
  afternoonCents: number
} {
  const morningCents = Math.ceil(dailyRateCents / 2)
  return {
    morningCents,
    afternoonCents: dailyRateCents - morningCents,
  }
}
