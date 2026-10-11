/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {}
  const title = payload.title ?? 'Minhas Diárias de Pintura'
  const body = payload.body ?? 'Confira os períodos pendentes de registro.'
  const date = payload.date ?? new Date().toISOString().slice(0, 10)

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload.tag ?? `reminder-${date}`,
      data: { url: `/calendario?data=${date}` },
      icon: '/pwa-192.svg',
      badge: '/pwa-192.svg',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client)
      if (existing) {
        return existing.focus().then(() => existing.navigate(targetUrl))
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
