import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileDown,
  Home,
  LogIn,
  LogOut,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Share2,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { calculatePeriodAmountCents, filterReportEntries, openBalanceForProject, resolveDailyRateCents, summarizeRelatedEntries, suggestPaymentAllocations } from './features/finance/rules'
import { centsFromDecimal, formatCurrency, formatDecimalCents } from './features/finance/money'
import { generateReportPdf } from './features/pdf/reportPdf'
import { notificationPermissionLabel, requestPushSubscription, showTestNotification } from './features/pwa/notifications'
import { dateInputValue, formatDateBr, formatLongDateBr, monthLabel, monthRange, todayLocalIso } from './lib/date'
import { demoData, initialData } from './lib/demoData'
import { authorizedOwnerId, isSupabaseConfigured, supabase } from './lib/supabase'
import { clearLocalData, exportBackup, loadLocalData, saveLocalData, validateBackup } from './lib/storage'
import type { AppData, Contractor, EntryStatus, PaymentMethod, Period, Project, ReportFilters } from './types/domain'

const periodLabels: Record<Period, string> = { morning: 'Manhã', afternoon: 'Tarde' }
const statusLabels: Record<EntryStatus, string> = { worked: 'Trabalho realizado', planned: 'Trabalho planejado', off: 'Não trabalhei' }
const navItems = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/obras', label: 'Obras', icon: BriefcaseBusiness },
  { to: '/relatorios', label: 'Relatórios', icon: ClipboardList },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
]

function nowIso() {
  return new Date().toISOString()
}

function emptyToUndefined(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text || undefined
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [data, setData] = useState<AppData>(() => loadLocalData())
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(isSupabaseConfigured ? null : data.profile.ownerId)
  const [notice, setNotice] = useState('Modo local ativo até configurar Supabase.')

  useEffect(() => {
    saveLocalData(data)
  }, [data])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data: authData }) => {
      const userId = authData.user?.id ?? null
      setSessionOwnerId(userId)
      if (userId && authorizedOwnerId && userId !== authorizedOwnerId) {
        setNotice('Usuário autenticado, mas não autorizado para este aplicativo.')
      }
    })
  }, [])

  function updateData(updater: (current: AppData) => AppData) {
    setData((current) => updater(current))
  }

  async function login(event: FormEvent) {
    event.preventDefault()
    if (!supabase) {
      setNotice('Supabase ainda não configurado. Use o modo local para validar os fluxos.')
      return
    }
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
    if (error) {
      setNotice(error.message)
      return
    }
    const userId = authData.user?.id ?? null
    setSessionOwnerId(userId)
    setNotice(userId === authorizedOwnerId ? 'Login realizado.' : 'Login realizado, mas este UUID não é o proprietário autorizado.')
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    clearLocalData()
    setSessionOwnerId(isSupabaseConfigured ? null : initialData.profile.ownerId)
    setData(initialData)
    setNotice('Sessão encerrada e cache local limpo.')
  }

  const authorized = !isSupabaseConfigured || (sessionOwnerId && (!authorizedOwnerId || sessionOwnerId === authorizedOwnerId))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">MP</span>
          <div>
            <strong>Minhas Diárias</strong>
            <small>Pintura</small>
          </div>
        </div>
        <nav>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Uso privado de {data.profile.professionalName}</p>
            <h1>Minhas Diárias de Pintura</h1>
          </div>
          <button className="ghost-button" type="button" onClick={logout}>
            <LogOut size={18} /> Sair
          </button>
        </header>

        <div className="notice">
          <ShieldCheck size={18} />
          <span>{notice}</span>
        </div>

        {!authorized ? (
          <LoginPanel login={login} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} />
        ) : (
          <Routes>
            <Route path="/" element={<HomePage data={data} updateData={updateData} />} />
            <Route path="/calendario" element={<CalendarPage data={data} updateData={updateData} />} />
            <Route path="/obras" element={<ProjectsPage data={data} updateData={updateData} />} />
            <Route path="/relatorios" element={<ReportsPage data={data} />} />
            <Route path="/ajustes" element={<SettingsPage data={data} updateData={updateData} setNotice={setNotice} />} />
          </Routes>
        )}
      </main>

      <nav className="bottom-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'bottom-link active' : 'bottom-link')}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function LoginPanel(props: {
  login: (event: FormEvent) => void
  email: string
  setEmail: (value: string) => void
  password: string
  setPassword: (value: string) => void
}) {
  return (
    <section className="panel narrow">
      <h2>Acesso privado</h2>
      <p>Entre com a conta única autorizada no Supabase. O banco também valida o UUID do proprietário via RLS.</p>
      <form className="form-grid" onSubmit={props.login}>
        <label>
          E-mail
          <input type="email" value={props.email} onChange={(event) => props.setEmail(event.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" value={props.password} onChange={(event) => props.setPassword(event.target.value)} required />
        </label>
        <button type="submit" className="primary-button"><LogIn size={18} /> Entrar</button>
      </form>
    </section>
  )
}

function HomePage({ data, updateData }: { data: AppData; updateData: (updater: (current: AppData) => AppData) => void }) {
  const today = todayLocalIso(data.profile.timezone)
  const current = new Date(`${today}T12:00:00`)
  const range = monthRange(current.getFullYear(), current.getMonth())
  const entries = filterReportEntries(data, range)
  const summary = summarizeRelatedEntries(entries)
  const todayEntries = data.entries.filter((entry) => entry.workDate === today)
  const recentProject = data.projects.find((project) => project.status === 'active')
  const navigate = useNavigate()

  function quickRegister(period: Period | 'full') {
    if (!recentProject) {
      navigate('/obras')
      return
    }
      upsertEntry(updateData, {
      workDate: today,
      projectId: recentProject.id,
      period,
      status: 'worked',
    })
  }

  return (
    <div className="stack">
      <section className="hero-band">
        <div>
          <p className="eyebrow">Hoje, {formatLongDateBr(today)}</p>
          <h2>Registro rápido do dia</h2>
          <p>Ausência de registro aparece como “Ainda não informado”; não é tratado como falta.</p>
        </div>
        <div className="quick-actions">
          <button type="button" className="primary-button" onClick={() => quickRegister('morning')}><Sun size={18} /> Registrar manhã</button>
          <button type="button" className="primary-button" onClick={() => quickRegister('afternoon')}><Moon size={18} /> Registrar tarde</button>
          <button type="button" className="success-button" onClick={() => quickRegister('full')}><CheckCircle2 size={18} /> Registrar dia todo</button>
        </div>
      </section>

      <div className="metrics">
        <Metric title="Serviços do mês" value={formatCurrency(summary.serviceTotalCents)} detail={`${formatDateBr(range.startDate)} a ${formatDateBr(range.endDate)}`} />
        <Metric title="Pago neste mês" value={formatCurrency(summary.allocatedPaidCents)} detail="Pagamentos atribuídos aos serviços do período" />
        <Metric title="Saldo a receber" value={formatCurrency(summary.balanceCents)} detail="Somente trabalhos realizados" />
        <Metric title="Diárias equivalentes" value={summary.equivalentDailies.toLocaleString('pt-BR')} detail={`${summary.workedDays} dia(s) com trabalho`} />
      </div>

      <section className="panel">
        <div className="section-title">
          <h2>Situação de hoje</h2>
          <span>{recentProject ? `Sugestão: ${recentProject.name}` : 'Cadastre uma obra para registrar'}</span>
        </div>
        <div className="period-row">
          {(['morning', 'afternoon'] as Period[]).map((period) => {
            const entry = todayEntries.find((item) => item.period === period)
            return <StatusPill key={period} label={periodLabels[period]} status={entry?.status} />
          })}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Pendências recentes</h2>
          <span>Períodos planejados ainda precisam ser confirmados</span>
        </div>
        <ListOrEmpty
          empty="Nenhuma pendência recente."
          items={data.entries.filter((entry) => entry.status === 'planned').slice(0, 5)}
          render={(entry) => <span>{formatDateBr(entry.workDate)} - {periodLabels[entry.period]} planejada</span>}
        />
      </section>
    </div>
  )
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function StatusPill({ label, status }: { label: string; status?: EntryStatus }) {
  return <div className={`status-pill ${status ?? 'missing'}`}><strong>{label}</strong><span>{status ? statusLabels[status] : 'Ainda não informado'}</span></div>
}

function CalendarPage({ data, updateData }: { data: AppData; updateData: (updater: (current: AppData) => AppData) => void }) {
  const today = todayLocalIso(data.profile.timezone)
  const [selectedDate, setSelectedDate] = useState(today)
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(`${today}T12:00:00`))
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])
  const selectedEntries = data.entries.filter((entry) => entry.workDate === selectedDate)

  function changeMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return (
    <div className="grid-layout">
      <section className="panel">
        <div className="calendar-head">
          <button type="button" className="ghost-button" onClick={() => changeMonth(-1)}>Anterior</button>
          <h2>{monthLabel(visibleMonth.getFullYear(), visibleMonth.getMonth())}</h2>
          <button type="button" className="ghost-button" onClick={() => changeMonth(1)}>Próximo</button>
          <button type="button" className="secondary-button" onClick={() => { setVisibleMonth(new Date(`${today}T12:00:00`)); setSelectedDate(today) }}>Hoje</button>
        </div>
        <div className="calendar-grid">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <strong key={day}>{day}</strong>)}
          {days.map((day) => {
            const iso = dateInputValue(day)
            const entries = data.entries.filter((entry) => entry.workDate === iso)
            return (
              <button key={iso} type="button" className={iso === selectedDate ? 'day-cell selected' : 'day-cell'} onClick={() => setSelectedDate(iso)}>
                <span>{day.getDate()}</span>
                <small>M: {shortStatus(entries.find((entry) => entry.period === 'morning')?.status)}</small>
                <small>T: {shortStatus(entries.find((entry) => entry.period === 'afternoon')?.status)}</small>
              </button>
            )
          })}
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>{formatDateBr(selectedDate)}</h2>
          <span>Registre manhã, tarde, dia todo, planejamento ou não trabalhei</span>
        </div>
        <EntryForm data={data} selectedDate={selectedDate} updateData={updateData} />
        <ListOrEmpty
          empty="Nenhum período informado para esta data."
          items={selectedEntries}
          render={(entry) => (
            <div className="row-item">
              <span>{periodLabels[entry.period]} - {statusLabels[entry.status]} - {formatCurrency(entry.amountCents)}</span>
              <button type="button" className="icon-button" aria-label="Excluir" onClick={() => deleteEntry(data, updateData, entry.id)}><Trash2 size={16} /></button>
            </div>
          )}
        />
      </section>
    </div>
  )
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
}

function shortStatus(status?: EntryStatus) {
  if (status === 'worked') return 'feito'
  if (status === 'planned') return 'plan.'
  if (status === 'off') return 'não'
  return 'pend.'
}

function EntryForm({ data, selectedDate, updateData }: { data: AppData; selectedDate: string; updateData: (updater: (current: AppData) => AppData) => void }) {
  const [preview, setPreview] = useState('')
  const activeProjects = data.projects.filter((project) => project.status === 'active')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const period = String(form.get('period')) as Period | 'full'
    const projectId = String(form.get('projectId'))
    const project = data.projects.find((item) => item.id === projectId)
    const manualAmount = emptyToUndefined(form.get('manualAmount'))
    const status = String(form.get('status')) as EntryStatus
    upsertEntry(updateData, {
      workDate: String(form.get('workDate')),
      projectId: status === 'off' ? undefined : projectId,
      period,
      status,
      manualAmountCents: manualAmount ? centsFromDecimal(manualAmount) : undefined,
      manualReason: emptyToUndefined(form.get('manualReason')),
      privateNote: emptyToUndefined(form.get('privateNote')),
      shareableDescription: emptyToUndefined(form.get('shareableDescription')),
    })
    const rate = resolveDailyRateCents(project, data.profile.defaultDailyRateCents)
    setPreview(`Valor salvo: ${formatCurrency(period === 'full' ? rate : calculatePeriodAmountCents(period, rate, manualAmount ? centsFromDecimal(manualAmount) : undefined))}`)
    event.currentTarget.reset()
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>Data<input name="workDate" type="date" defaultValue={selectedDate} required /></label>
      <label>Obra<select name="projectId" required>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>Período<select name="period" defaultValue="morning"><option value="morning">Manhã</option><option value="afternoon">Tarde</option><option value="full">Dia todo</option></select></label>
      <label>Situação<select name="status" defaultValue="worked"><option value="worked">Trabalho realizado</option><option value="planned">Trabalho planejado</option><option value="off">Não trabalhei</option></select></label>
      <label>Ajuste de valor<input name="manualAmount" inputMode="decimal" placeholder="Opcional" /></label>
      <label>Motivo do ajuste<input name="manualReason" placeholder="Opcional" /></label>
      <label>Observação privada<textarea name="privateNote" rows={2} /></label>
      <label>Descrição para PDF<textarea name="shareableDescription" rows={2} /></label>
      <button type="submit" className="primary-button"><Save size={18} /> Salvar período</button>
      {preview && <p className="form-note">{preview}</p>}
    </form>
  )
}

function upsertEntry(updateData: (updater: (current: AppData) => AppData) => void, input: {
  workDate: string
  projectId?: string
  period: Period | 'full'
  status: EntryStatus
  manualAmountCents?: number
  manualReason?: string
  privateNote?: string
  shareableDescription?: string
}) {
  const periods: Period[] = input.period === 'full' ? ['morning', 'afternoon'] : [input.period]
  updateData((current) => {
    const existingConflicts = current.entries.filter((entry) => entry.workDate === input.workDate && periods.includes(entry.period))
    const paidConflict = existingConflicts.some((entry) => current.allocations.some((allocation) => allocation.workEntryId === entry.id))
    if (paidConflict) {
      alert('Há pagamento atribuído a esse período. Estorne ou ajuste o pagamento antes de alterar.')
      return current
    }
    const project = input.projectId ? current.projects.find((item) => item.id === input.projectId) : undefined
    const dailyRate = resolveDailyRateCents(project, current.profile.defaultDailyRateCents)
    const nextEntries = current.entries.filter((entry) => !(entry.workDate === input.workDate && periods.includes(entry.period)))
    const created = periods.map((period) => ({
      id: uuid(),
      ownerId: current.profile.ownerId,
      projectId: input.status === 'off' ? undefined : input.projectId,
      workDate: input.workDate,
      period,
      status: input.status,
      appliedDailyRateCents: dailyRate,
      amountCents: input.status === 'worked' ? calculatePeriodAmountCents(period, dailyRate, input.manualAmountCents) : 0,
      manualAmountCents: input.manualAmountCents,
      manualReason: input.manualReason,
      privateNote: input.privateNote,
      shareableDescription: input.shareableDescription,
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }))
    return { ...current, entries: [...nextEntries, ...created] }
  })
}

function deleteEntry(data: AppData, updateData: (updater: (current: AppData) => AppData) => void, id: string) {
  if (data.allocations.some((allocation) => allocation.workEntryId === id)) {
    alert('Este lançamento tem pagamento atribuído e não pode ser excluído antes de corrigir o pagamento.')
    return
  }
  if (!confirm('Excluir este lançamento?')) return
  updateData((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }))
}

function ProjectsPage({ data, updateData }: { data: AppData; updateData: (updater: (current: AppData) => AppData) => void }) {
  function addContractor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const contractor: Contractor = {
      id: uuid(),
      ownerId: data.profile.ownerId,
      name: String(form.get('name')).trim(),
      phone: emptyToUndefined(form.get('phone')),
      privateNote: emptyToUndefined(form.get('privateNote')),
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    updateData((current) => ({ ...current, contractors: [...current.contractors, contractor] }))
    event.currentTarget.reset()
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const rate = emptyToUndefined(form.get('dailyRate'))
    const project: Project = {
      id: uuid(),
      ownerId: data.profile.ownerId,
      contractorId: String(form.get('contractorId')),
      name: String(form.get('name')).trim(),
      address: emptyToUndefined(form.get('address')),
      startDate: emptyToUndefined(form.get('startDate')),
      dailyRateCents: rate ? centsFromDecimal(rate) : undefined,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    updateData((current) => ({ ...current, projects: [...current.projects, project] }))
    event.currentTarget.reset()
  }

  return (
    <div className="grid-layout">
      <section className="panel">
        <h2>Contratantes</h2>
        <form className="form-grid" onSubmit={addContractor}>
          <label>Nome<input name="name" required /></label>
          <label>Telefone<input name="phone" /></label>
          <label>Observação privada<textarea name="privateNote" rows={2} /></label>
          <button className="primary-button" type="submit"><Plus size={18} /> Salvar contratante</button>
        </form>
        <ListOrEmpty empty="Nenhum contratante cadastrado." items={data.contractors} render={(contractor) => (
          <div className="row-item"><span>{contractor.name}{contractor.archived ? ' (arquivado)' : ''}</span><ArchiveButton onClick={() => updateData((current) => ({ ...current, contractors: current.contractors.map((item) => item.id === contractor.id ? { ...item, archived: true } : item) }))} /></div>
        )} />
      </section>
      <section className="panel">
        <h2>Obras</h2>
        <form className="form-grid" onSubmit={addProject}>
          <label>Nome ou descrição<input name="name" required /></label>
          <label>Contratante<select name="contractorId" required>{data.contractors.filter((item) => !item.archived).map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}</select></label>
          <label>Endereço<input name="address" /></label>
          <label>Data inicial<input type="date" name="startDate" /></label>
          <label>Diária específica<input name="dailyRate" inputMode="decimal" placeholder="Opcional" /></label>
          <button className="primary-button" type="submit"><Plus size={18} /> Salvar obra</button>
        </form>
        <ListOrEmpty empty="Nenhuma obra cadastrada." items={data.projects} render={(project) => (
          <div className="row-item">
            <span>{project.name} - {project.dailyRateCents ? formatCurrency(project.dailyRateCents) : 'diária padrão'} - {project.status}</span>
            <button type="button" className="secondary-button" onClick={() => updateData((current) => ({ ...current, projects: current.projects.map((item) => item.id === project.id ? { ...item, status: item.status === 'completed' ? 'active' : 'completed' } : item) }))}>{project.status === 'completed' ? 'Reabrir' : 'Concluir'}</button>
          </div>
        )} />
      </section>
      <PaymentsPanel data={data} updateData={updateData} />
    </div>
  )
}

function ArchiveButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="secondary-button" onClick={onClick}>Arquivar</button>
}

function PaymentsPanel({ data, updateData }: { data: AppData; updateData: (updater: (current: AppData) => AppData) => void }) {
  function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const projectId = String(form.get('projectId'))
    const amountCents = centsFromDecimal(String(form.get('amount')))
    const balance = openBalanceForProject(data, projectId)
    if (amountCents > balance) {
      alert('Pagamento acima do saldo em aberto não é permitido nesta versão.')
      return
    }
    const paymentId = uuid()
    const allocations = suggestPaymentAllocations(data, projectId, amountCents).map((allocation) => ({
      id: uuid(),
      ownerId: data.profile.ownerId,
      paymentId,
      ...allocation,
      createdAt: nowIso(),
    }))
    updateData((current) => ({
      ...current,
      payments: [...current.payments, {
        id: paymentId,
        ownerId: current.profile.ownerId,
        projectId,
        paidAt: String(form.get('paidAt')),
        amountCents,
        method: String(form.get('method')) as PaymentMethod,
        note: emptyToUndefined(form.get('note')),
        createdAt: nowIso(),
      }],
      allocations: [...current.allocations, ...allocations],
    }))
    event.currentTarget.reset()
  }

  return (
    <section className="panel wide">
      <h2>Pagamentos</h2>
      <form className="form-grid" onSubmit={addPayment}>
        <label>Obra<select name="projectId" required>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name} - saldo {formatCurrency(openBalanceForProject(data, project.id))}</option>)}</select></label>
        <label>Data<input type="date" name="paidAt" defaultValue={dateInputValue()} required /></label>
        <label>Valor<input name="amount" inputMode="decimal" required /></label>
        <label>Forma<select name="method" defaultValue="pix"><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>
        <label>Observação<input name="note" /></label>
        <button className="success-button" type="submit"><CircleDollarSign size={18} /> Registrar pagamento</button>
      </form>
      <ListOrEmpty empty="Nenhum pagamento registrado." items={data.payments} render={(payment) => (
        <div className="row-item">
          <span>{formatDateBr(payment.paidAt)} - {formatCurrency(payment.amountCents)} - {payment.reversedAt ? 'estornado' : payment.method}</span>
          {!payment.reversedAt && <button type="button" className="secondary-button" onClick={() => updateData((current) => ({ ...current, payments: current.payments.map((item) => item.id === payment.id ? { ...item, reversedAt: nowIso() } : item) }))}><RotateCcw size={16} /> Estornar</button>}
        </div>
      )} />
    </section>
  )
}

function ReportsPage({ data }: { data: AppData }) {
  const today = todayLocalIso(data.profile.timezone)
  const range = monthRange(new Date(`${today}T12:00:00`).getFullYear(), new Date(`${today}T12:00:00`).getMonth())
  const [filters, setFilters] = useState<ReportFilters>(range)
  const [finalNote, setFinalNote] = useState('')
  const [reportDate] = useState(() => dateInputValue())
  const entries = filterReportEntries(data, filters)
  const summary = summarizeRelatedEntries(entries)
  const selectedContractor = filters.contractorId ? data.contractors.find((item) => item.id === filters.contractorId) : undefined

  function generatePdf(share = false) {
    if (!selectedContractor) {
      alert('Selecione um contratante para gerar demonstrativo compartilhável.')
      return
    }
    const blob = generateReportPdf({
      professionalName: data.profile.professionalName,
      contractorName: selectedContractor.name,
      periodLabel: `${formatDateBr(filters.startDate)} a ${formatDateBr(filters.endDate)}`,
      reportId: `DIA-${reportDate}-${selectedContractor.id.slice(0, 6)}`,
      entries,
      summary,
      finalNote,
      compactFullDays: true,
    })
    const fileName = `Diarias_${selectedContractor.name.replace(/\s+/g, '_')}_${filters.startDate}_${filters.endDate}.pdf`
    const file = new File([blob], fileName, { type: 'application/pdf' })
    if (share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Demonstrativo de diárias de pintura' }).catch(() => downloadBlob(blob, fileName))
      return
    }
    downloadBlob(blob, fileName)
  }

  return (
    <div className="stack">
      <section className="panel">
        <h2>Filtros</h2>
        <div className="form-grid">
          <label>Início<input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /></label>
          <label>Fim<input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></label>
          <label>Contratante<select value={filters.contractorId ?? ''} onChange={(event) => setFilters({ ...filters, contractorId: event.target.value || undefined, projectId: undefined })}><option value="">Todos</option>{data.contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}</select></label>
          <label>Obra<select value={filters.projectId ?? ''} onChange={(event) => setFilters({ ...filters, projectId: event.target.value || undefined })}><option value="">Todas</option>{data.projects.filter((project) => !filters.contractorId || project.contractorId === filters.contractorId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label>Situação financeira<select value={filters.financialStatus ?? ''} onChange={(event) => setFilters({ ...filters, financialStatus: event.target.value as ReportFilters['financialStatus'] || undefined })}><option value="">Todas</option><option value="unpaid">Não pago</option><option value="partial">Parcial</option><option value="paid">Pago</option></select></label>
        </div>
      </section>
      <div className="metrics">
        <Metric title="Dias trabalhados" value={String(summary.workedDays)} detail={`${summary.mornings} manhã(s), ${summary.afternoons} tarde(s)`} />
        <Metric title="Diárias equivalentes" value={summary.equivalentDailies.toLocaleString('pt-BR')} detail="Meio período = 0,5 diária" />
        <Metric title="Total serviços" value={formatCurrency(summary.serviceTotalCents)} detail="Conjunto completo filtrado" />
        <Metric title="Saldo" value={formatCurrency(summary.balanceCents)} detail={`Pago: ${formatCurrency(summary.allocatedPaidCents)}`} />
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>Tabela cronológica</h2>
          <span>{entries.length} registro(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Obra</th><th>Período</th><th>Diária</th><th>Serviço</th><th>Pago</th><th>Saldo</th></tr></thead>
            <tbody>{entries.map((entry) => <tr key={entry.id}><td>{formatDateBr(entry.workDate)}</td><td>{entry.project?.name}</td><td>{periodLabels[entry.period]}</td><td>{formatCurrency(entry.appliedDailyRateCents)}</td><td>{formatCurrency(entry.amountCents)}</td><td>{formatCurrency(entry.paidCents)}</td><td>{formatCurrency(entry.balanceCents)}</td></tr>)}</tbody>
          </table>
        </div>
        {entries.length === 0 && <p className="empty">Nenhum registro no filtro selecionado.</p>}
      </section>
      <section className="panel">
        <h2>PDF do contratante</h2>
        <label>Observação final opcional<textarea value={finalNote} onChange={(event) => setFinalNote(event.target.value)} rows={2} /></label>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => generatePdf(false)}><FileDown size={18} /> Baixar PDF</button>
          <button type="button" className="secondary-button" onClick={() => generatePdf(true)}><Share2 size={18} /> Compartilhar arquivo</button>
        </div>
        <p className="form-note">Sem suporte nativo a compartilhamento de arquivo, o app baixa o PDF para anexar manualmente ao WhatsApp ou e-mail.</p>
      </section>
    </div>
  )
}

function SettingsPage({ data, updateData, setNotice }: { data: AppData; updateData: (updater: (current: AppData) => AppData) => void; setNotice: (value: string) => void }) {
  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const weekdays = form.getAll('weekdays').map((value) => Number(value))
    updateData((current) => ({
      ...current,
      profile: {
        ...current.profile,
        professionalName: String(form.get('professionalName')).trim(),
        defaultDailyRateCents: centsFromDecimal(String(form.get('defaultDailyRate'))),
        timezone: String(form.get('timezone')),
        reminderWeekdays: weekdays,
        remindersEnabled: form.get('remindersEnabled') === 'on',
        morningReminderEnabled: form.get('morningReminderEnabled') === 'on',
        afternoonReminderEnabled: form.get('afternoonReminderEnabled') === 'on',
      },
    }))
    setNotice('Ajustes salvos.')
  }

  function downloadBackup() {
    downloadBlob(new Blob([exportBackup(data)], { type: 'application/json' }), `backup-minhas-diarias-${dateInputValue()}.json`)
  }

  function importBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = (event.currentTarget.elements.namedItem('backup') as HTMLInputElement).files?.[0]
    if (!file) return
    file.text().then((raw) => {
      updateData(() => validateBackup(raw))
      setNotice('Backup importado após validação básica de formato.')
    }).catch((error) => setNotice(error.message))
  }

  function loadDemo() {
    updateData(() => demoData)
    setNotice('Dados de demonstração carregados. Não use como produção.')
  }

  async function activatePush() {
    try {
      await requestPushSubscription(data.profile.ownerId)
      setNotice('Inscrição de notificação registrada. A entrega real depende do Supabase Cron e permissões do aparelho.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao ativar notificações.')
    }
  }

  return (
    <div className="grid-layout">
      <section className="panel">
        <h2>Configuração inicial e preferências</h2>
        <form className="form-grid" onSubmit={saveSettings}>
          <label>Nome do profissional<input name="professionalName" defaultValue={data.profile.professionalName} required /></label>
          <label>Diária padrão real<input name="defaultDailyRate" defaultValue={formatDecimalCents(data.profile.defaultDailyRateCents)} inputMode="decimal" required /></label>
          <label>Fuso horário<input name="timezone" defaultValue={data.profile.timezone} required /></label>
          <label className="checkbox"><input type="checkbox" name="remindersEnabled" defaultChecked={data.profile.remindersEnabled} /> Lembretes ativos</label>
          <label className="checkbox"><input type="checkbox" name="morningReminderEnabled" defaultChecked={data.profile.morningReminderEnabled} /> Lembrete às 12h</label>
          <label className="checkbox"><input type="checkbox" name="afternoonReminderEnabled" defaultChecked={data.profile.afternoonReminderEnabled} /> Lembrete às 18h</label>
          <div className="weekdays">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label, index) => <label key={label} className="checkbox"><input type="checkbox" name="weekdays" value={index} defaultChecked={data.profile.reminderWeekdays.includes(index)} /> {label}</label>)}
          </div>
          <button type="submit" className="primary-button"><Save size={18} /> Salvar ajustes</button>
        </form>
      </section>
      <section className="panel">
        <h2>Notificações</h2>
        <p>Permissão: {notificationPermissionLabel()}</p>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={activatePush}><Bell size={18} /> Ativar notificações</button>
          <button type="button" className="secondary-button" onClick={() => showTestNotification().then(() => setNotice('Notificação de teste enviada pelo Service Worker.')).catch((error) => setNotice(error.message))}>Testar notificação</button>
        </div>
        <p className="form-note">O envio real às 12h e 18h roda no Supabase Cron com Edge Function. Internet, permissões, economia de bateria e instalação PWA podem afetar a entrega.</p>
      </section>
      <section className="panel">
        <h2>Backup</h2>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={downloadBackup}><Download size={18} /> Exportar JSON</button>
          <button type="button" className="ghost-button" onClick={loadDemo}>Carregar demonstração</button>
        </div>
        <form className="form-grid" onSubmit={importBackup}>
          <label>Restaurar JSON<input name="backup" type="file" accept="application/json" /></label>
          <button type="submit" className="primary-button">Validar e restaurar</button>
        </form>
      </section>
    </div>
  )
}

function ListOrEmpty<T>({ items, render, empty }: { items: T[]; render: (item: T) => ReactNode; empty: string }) {
  if (items.length === 0) return <p className="empty">{empty}</p>
  return <div className="list">{items.map((item, index) => <div key={index} className="list-line">{render(item)}</div>)}</div>
}

export default App
