import { describe, expect, it } from 'vitest'
import type { AppData, WorkEntry } from '../../types/domain'
import { centsFromDecimal, splitDailyRate } from './money'
import { calculatePeriodAmountCents, summarizeRelatedEntries, buildEntryRelations } from './rules'

const now = new Date().toISOString()

function entry(id: string, workDate: string, period: 'morning' | 'afternoon', amountCents: number): WorkEntry {
  return {
    id,
    ownerId: 'owner',
    projectId: 'project',
    workDate,
    period,
    status: 'worked',
    appliedDailyRateCents: centsFromDecimal('200,00'),
    amountCents,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
}

function baseData(entries: WorkEntry[]): AppData {
  return {
    profile: {
      ownerId: 'owner',
      professionalName: 'Sandro Müller',
      defaultDailyRateCents: centsFromDecimal('200,00'),
      timezone: 'America/Cuiaba',
      reminderWeekdays: [1, 2, 3, 4, 5],
      remindersEnabled: true,
      morningReminderEnabled: true,
      afternoonReminderEnabled: true,
    },
    contractors: [{ id: 'contractor', ownerId: 'owner', name: 'Cliente', archived: false, createdAt: now, updatedAt: now }],
    projects: [{ id: 'project', ownerId: 'owner', contractorId: 'contractor', name: 'Obra', status: 'active', createdAt: now, updatedAt: now }],
    entries,
    payments: [],
    allocations: [],
    pushSubscriptions: [],
  }
}

describe('financial rules', () => {
  it('splits a R$ 200 daily rate into R$ 100 periods', () => {
    expect(calculatePeriodAmountCents('morning', centsFromDecimal('200,00'))).toBe(10000)
    expect(calculatePeriodAmountCents('afternoon', centsFromDecimal('200,00'))).toBe(10000)
  })

  it('keeps odd cents deterministic and exact for a full day', () => {
    expect(splitDailyRate(20001)).toEqual({ morningCents: 10001, afternoonCents: 10000 })
  })

  it('calculates 10 full days plus 3 half periods as 11.5 dailies and R$ 2,300', () => {
    const entries: WorkEntry[] = []
    for (let day = 1; day <= 10; day += 1) {
      const date = `2026-10-${String(day).padStart(2, '0')}`
      entries.push(entry(`m-${day}`, date, 'morning', 10000), entry(`a-${day}`, date, 'afternoon', 10000))
    }
    entries.push(
      entry('extra-1', '2026-10-11', 'morning', 10000),
      entry('extra-2', '2026-10-12', 'morning', 10000),
      entry('extra-3', '2026-10-13', 'morning', 10000),
    )

    const summary = summarizeRelatedEntries(buildEntryRelations(baseData(entries)))
    expect(summary.equivalentDailies).toBe(11.5)
    expect(summary.serviceTotalCents).toBe(230000)
  })

  it('subtracts allocated payments from selected entries', () => {
    const data = baseData([entry('e1', '2026-10-01', 'morning', 100000), entry('e2', '2026-10-02', 'afternoon', 130000)])
    data.payments = [{ id: 'p1', ownerId: 'owner', projectId: 'project', paidAt: '2026-10-10', amountCents: 80000, method: 'pix', createdAt: now }]
    data.allocations = [{ id: 'a1', ownerId: 'owner', paymentId: 'p1', workEntryId: 'e1', amountCents: 80000, createdAt: now }]
    const summary = summarizeRelatedEntries(buildEntryRelations(data))
    expect(summary.serviceTotalCents).toBe(230000)
    expect(summary.allocatedPaidCents).toBe(80000)
    expect(summary.balanceCents).toBe(150000)
  })
})
