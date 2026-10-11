import type {
  AppData,
  EntryWithRelations,
  Period,
  Project,
  ReportFilters,
  ReportSummary,
  WorkEntry,
} from '../../types/domain'
import { splitDailyRate } from './money'

export function resolveDailyRateCents(project: Project | undefined, defaultRateCents: number): number {
  return project?.dailyRateCents ?? defaultRateCents
}

export function calculatePeriodAmountCents(
  period: Period,
  dailyRateCents: number,
  manualAmountCents?: number,
): number {
  if (manualAmountCents !== undefined && manualAmountCents >= 0) {
    return manualAmountCents
  }

  const split = splitDailyRate(dailyRateCents)
  return period === 'morning' ? split.morningCents : split.afternoonCents
}

export function getEntryPaidCents(data: AppData, entryId: string): number {
  const paymentById = new Map(data.payments.map((payment) => [payment.id, payment]))
  return data.allocations
    .filter((allocation) => allocation.workEntryId === entryId)
    .filter((allocation) => !paymentById.get(allocation.paymentId)?.reversedAt)
    .reduce((total, allocation) => total + allocation.amountCents, 0)
}

export function buildEntryRelations(data: AppData, entries = data.entries): EntryWithRelations[] {
  const projectById = new Map(data.projects.map((project) => [project.id, project]))
  const contractorById = new Map(data.contractors.map((contractor) => [contractor.id, contractor]))

  return entries.map((entry) => {
    const project = entry.projectId ? projectById.get(entry.projectId) : undefined
    const contractor = project ? contractorById.get(project.contractorId) : undefined
    const paidCents = getEntryPaidCents(data, entry.id)
    return {
      ...entry,
      project,
      contractor,
      paidCents,
      balanceCents: Math.max(0, entry.amountCents - paidCents),
    }
  })
}

export function filterReportEntries(data: AppData, filters: ReportFilters): EntryWithRelations[] {
  return buildEntryRelations(data)
    .filter((entry) => entry.status === 'worked')
    .filter((entry) => entry.workDate >= filters.startDate && entry.workDate <= filters.endDate)
    .filter((entry) => !filters.projectId || entry.projectId === filters.projectId)
    .filter((entry) => !filters.contractorId || entry.contractor?.id === filters.contractorId)
    .filter((entry) => {
      if (!filters.financialStatus) return true
      if (filters.financialStatus === 'paid') return entry.balanceCents === 0
      if (filters.financialStatus === 'partial') return entry.paidCents > 0 && entry.balanceCents > 0
      return entry.paidCents === 0
    })
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.period.localeCompare(b.period))
}

export function summarizeEntries(entries: Pick<WorkEntry, 'workDate' | 'period' | 'status' | 'amountCents'>[], paidById = new Map<string, number>()): ReportSummary {
  const worked = entries.filter((entry) => entry.status === 'worked')
  const workedDays = new Set(worked.map((entry) => entry.workDate)).size
  const mornings = worked.filter((entry) => entry.period === 'morning').length
  const afternoons = worked.filter((entry) => entry.period === 'afternoon').length
  const serviceTotalCents = worked.reduce((total, entry) => total + entry.amountCents, 0)
  const allocatedPaidCents = worked.reduce((total, entry) => total + (paidById.get('id' in entry ? String(entry.id) : '') ?? 0), 0)

  return {
    workedDays,
    mornings,
    afternoons,
    equivalentDailies: (mornings + afternoons) / 2,
    serviceTotalCents,
    allocatedPaidCents,
    balanceCents: serviceTotalCents - allocatedPaidCents,
  }
}

export function summarizeRelatedEntries(entries: EntryWithRelations[]): ReportSummary {
  const paidById = new Map(entries.map((entry) => [entry.id, entry.paidCents]))
  return summarizeEntries(entries, paidById)
}

export function suggestPaymentAllocations(data: AppData, projectId: string, amountCents: number) {
  let remaining = amountCents
  return buildEntryRelations(data)
    .filter((entry) => entry.projectId === projectId && entry.status === 'worked' && entry.balanceCents > 0)
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.period.localeCompare(b.period))
    .map((entry) => {
      const amount = Math.min(entry.balanceCents, remaining)
      remaining -= amount
      return { workEntryId: entry.id, amountCents: amount }
    })
    .filter((allocation) => allocation.amountCents > 0)
}

export function openBalanceForProject(data: AppData, projectId: string): number {
  return buildEntryRelations(data)
    .filter((entry) => entry.projectId === projectId && entry.status === 'worked')
    .reduce((total, entry) => total + entry.balanceCents, 0)
}
