export type Period = 'morning' | 'afternoon'
export type EntryStatus = 'planned' | 'worked' | 'off'
export type PaymentMethod = 'pix' | 'cash' | 'transfer' | 'other'
export type ProjectStatus = 'active' | 'completed' | 'archived'

export type Profile = {
  ownerId: string
  professionalName: string
  defaultDailyRateCents: number
  timezone: string
  reminderWeekdays: number[]
  remindersEnabled: boolean
  morningReminderEnabled: boolean
  afternoonReminderEnabled: boolean
}

export type Contractor = {
  id: string
  ownerId: string
  name: string
  phone?: string
  privateNote?: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  ownerId: string
  contractorId: string
  name: string
  address?: string
  startDate?: string
  dailyRateCents?: number
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export type WorkEntry = {
  id: string
  ownerId: string
  projectId?: string
  workDate: string
  period: Period
  status: EntryStatus
  appliedDailyRateCents: number
  amountCents: number
  manualAmountCents?: number
  manualReason?: string
  privateNote?: string
  shareableDescription?: string
  version: number
  createdAt: string
  updatedAt: string
}

export type Payment = {
  id: string
  ownerId: string
  projectId: string
  paidAt: string
  amountCents: number
  method: PaymentMethod
  note?: string
  reversedAt?: string
  createdAt: string
}

export type PaymentAllocation = {
  id: string
  ownerId: string
  paymentId: string
  workEntryId: string
  amountCents: number
  createdAt: string
}

export type PushSubscriptionRecord = {
  id: string
  ownerId: string
  endpoint: string
  p256dh: string
  auth: string
  deviceLabel?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type AppData = {
  profile: Profile
  contractors: Contractor[]
  projects: Project[]
  entries: WorkEntry[]
  payments: Payment[]
  allocations: PaymentAllocation[]
  pushSubscriptions: PushSubscriptionRecord[]
}

export type ReportFilters = {
  startDate: string
  endDate: string
  contractorId?: string
  projectId?: string
  financialStatus?: 'unpaid' | 'partial' | 'paid'
}

export type EntryWithRelations = WorkEntry & {
  project?: Project
  contractor?: Contractor
  paidCents: number
  balanceCents: number
}

export type ReportSummary = {
  workedDays: number
  mornings: number
  afternoons: number
  equivalentDailies: number
  serviceTotalCents: number
  allocatedPaidCents: number
  balanceCents: number
}
