import type { AppData } from '../types/domain'
import { centsFromDecimal } from '../features/finance/money'

const now = new Date().toISOString()

export const initialData: AppData = {
  profile: {
    ownerId: import.meta.env.VITE_AUTHORIZED_OWNER_ID || 'demo-owner',
    professionalName: 'Sandro Müller',
    defaultDailyRateCents: 0,
    timezone: 'America/Cuiaba',
    reminderWeekdays: [1, 2, 3, 4, 5],
    remindersEnabled: false,
    morningReminderEnabled: true,
    afternoonReminderEnabled: true,
  },
  contractors: [],
  projects: [],
  entries: [],
  payments: [],
  allocations: [],
  pushSubscriptions: [],
}

export const demoData: AppData = {
  profile: {
    ...initialData.profile,
    defaultDailyRateCents: centsFromDecimal('200,00'),
    remindersEnabled: true,
  },
  contractors: [
    {
      id: 'contractor-demo-1',
      ownerId: 'demo-owner',
      name: 'Contratante de demonstração',
      phone: '(65) 99999-0000',
      privateNote: 'Dados fictícios usados apenas para testar a interface.',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
  ],
  projects: [
    {
      id: 'project-demo-1',
      ownerId: 'demo-owner',
      contractorId: 'contractor-demo-1',
      name: 'Casa Jardim das Cores',
      address: 'Rua Exemplo, 123',
      dailyRateCents: centsFromDecimal('200,00'),
      status: 'active',
      startDate: '2026-10-01',
      createdAt: now,
      updatedAt: now,
    },
  ],
  entries: [],
  payments: [],
  allocations: [],
  pushSubscriptions: [],
}
