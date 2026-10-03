'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    let disposed = false
    let lastUpdate = 0
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        if (disposed) return
        const update = () => {
          if (Date.now() - lastUpdate < 60_000) return
          lastUpdate = Date.now()
          void registration.update().catch(() => {})
        }
        update()
        window.addEventListener('focus', update)
        cleanupUpdate = () => window.removeEventListener('focus', update)
      } catch { /* Offline clients retry registration on the next visit. */ }
    }
    let cleanupUpdate = () => {}
    if (document.readyState === 'complete') void register()
    else window.addEventListener('load', register, { once: true })
    return () => { disposed = true; window.removeEventListener('load', register); cleanupUpdate() }
  }, [])
  return null
}
