import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Profile = {
  owner_id: string
  professional_name: string
  timezone: string
  reminder_weekdays: number[]
  reminders_enabled: boolean
  morning_reminder_enabled: boolean
  afternoon_reminder_enabled: boolean
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const jobSecret = Deno.env.get('REMINDER_JOB_SECRET')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

function localParts(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    weekday: weekdayMap[value('weekday')] ?? 0,
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${jobSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const targetHours: number[] = body.target_hours ?? [12, 18]
  const { data: profiles, error } = await supabase.from('profiles').select('*').eq('reminders_enabled', true)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const results = []
  for (const profile of profiles as Profile[]) {
    const local = localParts(profile.timezone)
    if (!targetHours.includes(local.hour)) continue
    if (!profile.reminder_weekdays.includes(local.weekday)) continue
    if (local.hour === 12 && !profile.morning_reminder_enabled) continue
    if (local.hour === 18 && !profile.afternoon_reminder_enabled) continue

    const { data: entries } = await supabase
      .from('work_entries')
      .select('period,status')
      .eq('owner_id', profile.owner_id)
      .eq('work_date', local.date)

    const morning = entries?.find((entry) => entry.period === 'morning')
    const afternoon = entries?.find((entry) => entry.period === 'afternoon')
    const shouldSend =
      (local.hour === 12 && (!morning || morning.status === 'planned')) ||
      (local.hour === 18 && (!afternoon || afternoon.status === 'planned' || !morning || morning.status === 'planned'))

    const eventInsert = await supabase.from('reminder_events').upsert({
      owner_id: profile.owner_id,
      local_date: local.date,
      reminder_hour: local.hour,
      status: shouldSend ? 'pending' : 'skipped',
      reason: shouldSend ? null : 'periods already informed',
    }, { onConflict: 'owner_id,local_date,reminder_hour' }).select().single()

    if (!shouldSend || eventInsert.error) continue
    const eventId = eventInsert.data.id
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('*').eq('owner_id', profile.owner_id).eq('active', true)
    const bodyText = local.hour === 12
      ? `${profile.professional_name}, registre a manhã se já terminou esse período.`
      : `${profile.professional_name}, confira a tarde${!morning || morning.status === 'planned' ? ' e a manhã pendente' : ''}.`

    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify({
          title: 'Minhas Diárias de Pintura',
          body: bodyText,
          date: local.date,
          tag: `reminder-${profile.owner_id}-${local.date}-${local.hour}`,
        }))
        await supabase.from('reminder_deliveries').insert({ event_id: eventId, subscription_id: subscription.id, result: 'accepted' })
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        await supabase.from('reminder_deliveries').insert({ event_id: eventId, subscription_id: subscription.id, result: statusCode === 410 ? 'expired' : 'failed', error: String(err) })
        if (statusCode === 410) await supabase.from('push_subscriptions').update({ active: false }).eq('id', subscription.id)
      }
    }
    await supabase.from('reminder_events').update({ status: 'sent' }).eq('id', eventId)
    results.push({ owner_id: profile.owner_id, date: local.date, hour: local.hour })
  }

  return Response.json({ processed: results })
})
