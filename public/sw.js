const CACHE_NAME = 'whitelabel-pwa-v5'
const LOGIN_FALLBACK_URL = '/login'

const PRECACHE_URLS = [
  LOGIN_FALLBACK_URL,
  '/admin/login',
  '/vendedor/login',
  '/manifest.webmanifest',
  '/logo-nova-alianca.png',
  '/logo-nova-alianca-azul.png',
  '/logo-horizontal.svg',
  '/apple-icon.png',
  '/icon.svg',
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) {
    return
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        event.waitUntil(
          self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'PWA_OFFLINE_FALLBACK_LOGIN',
                pathname: requestUrl.pathname,
                requestMode: event.request.mode
              })
            })
          })
        )

        const cache = await caches.open(CACHE_NAME)
        const cachedLogin = await cache.match(LOGIN_FALLBACK_URL)
        if (cachedLogin) {
          return cachedLogin
        }

        return new Response('Sem conexão. Conecte-se à internet para entrar.', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      })
    )

    return
  }

  if (['style', 'script', 'image', 'font'].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }

        return fetch(event.request).then((networkResponse) => {
          const clonedResponse = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse))
          return networkResponse
        })
      })
    )
  }
})
