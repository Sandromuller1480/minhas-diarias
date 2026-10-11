import type { AppData } from '../types/domain'
import { initialData } from './demoData'

const key = 'minhas-diarias-pintura:data:v1'

export function loadLocalData(): AppData {
  const raw = localStorage.getItem(key)
  if (!raw) return initialData

  try {
    return { ...initialData, ...JSON.parse(raw) } as AppData
  } catch {
    return initialData
  }
}

export function saveLocalData(data: AppData) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function clearLocalData() {
  localStorage.removeItem(key)
}

export function exportBackup(data: AppData) {
  return JSON.stringify(
    {
      schema: 'minhas-diarias-pintura-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  )
}

export function validateBackup(raw: string): AppData {
  const parsed = JSON.parse(raw)
  if (parsed?.schema !== 'minhas-diarias-pintura-backup' || parsed?.version !== 1 || !parsed?.data) {
    throw new Error('Arquivo de backup inválido.')
  }
  return parsed.data as AppData
}
