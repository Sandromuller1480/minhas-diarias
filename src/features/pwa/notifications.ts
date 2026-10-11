import { supabase } from '../../lib/supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function notificationPermissionLabel() {
  if (!('Notification' in window)) return 'Indisponível neste navegador'
  if (Notification.permission === 'granted') return 'Permitida'
  if (Notification.permission === 'denied') return 'Bloqueada'
  return 'Ainda não solicitada'
}

export async function requestPushSubscription(ownerId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Este navegador não oferece Web Push.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permissão de notificação não concedida.')

  const registration = await navigator.serviceWorker.ready
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!vapidPublicKey) throw new Error('Configure VITE_VAPID_PUBLIC_KEY para assinar notificações Web Push.')

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const json = subscription.toJSON()
  const record = {
    owner_id: ownerId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    device_label: navigator.userAgent.slice(0, 120),
    active: true,
  }

  if (supabase) {
    const { error } = await supabase.from('push_subscriptions').upsert(record, { onConflict: 'owner_id,endpoint' })
    if (error) throw error
  }

  return record
}

export async function showTestNotification() {
  if (Notification.permission !== 'granted') throw new Error('Ative as notificações primeiro.')
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification('Minhas Diárias de Pintura', {
    body: 'Notificação de teste. Os lembretes reais são enviados pelo Supabase Cron.',
    tag: 'test-notification',
    data: { url: '/calendario' },
  })
}
