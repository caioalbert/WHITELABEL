'use client'

import { useEffect } from 'react'
import { trackPwaEvent } from '@/lib/pwa/analytics'

type BeforeInstallPromptEvent = Event & {
  prompt?: () => Promise<void>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type PwaServiceWorkerMessage = {
  type?: string
  pathname?: string
  requestMode?: string
}

export function PwaAnalyticsListeners() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined') return

    const handleBeforeInstallPrompt = (event: Event) => {
      const beforeInstallEvent = event as BeforeInstallPromptEvent
      trackPwaEvent('pwa_install_prompt_available', {
        pathname: window.location.pathname,
      })

      void beforeInstallEvent.userChoice?.then((choice) => {
        trackPwaEvent('pwa_install_prompt_choice', {
          outcome: choice.outcome,
          platform: choice.platform || 'unknown',
        })
      })
    }

    const handleAppInstalled = () => {
      trackPwaEvent('pwa_installed', {
        pathname: window.location.pathname,
      })
    }

    const handleServiceWorkerMessage = (event: MessageEvent<PwaServiceWorkerMessage>) => {
      if (event.data?.type !== 'PWA_OFFLINE_FALLBACK_LOGIN') return

      trackPwaEvent('pwa_offline_fallback_login', {
        pathname: event.data.pathname || 'unknown',
        requestMode: event.data.requestMode || 'unknown',
      })
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [])

  return null
}
