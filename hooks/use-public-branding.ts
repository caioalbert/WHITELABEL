'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_BRANDING, normalizeBranding, type PublicBranding } from '@/lib/branding'

export function usePublicBranding() {
  const [branding, setBranding] = useState<PublicBranding>(DEFAULT_BRANDING)

  useEffect(() => {
    let active = true

    const fetchBranding = async () => {
      try {
        const response = await fetch('/api/configuracoes-publicas', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json().catch(() => null)
        if (active) {
          setBranding(normalizeBranding(payload))
        }
      } catch {
        // Mantém a marca padrão se a API pública ainda não estiver configurada.
      }
    }

    fetchBranding()

    return () => {
      active = false
    }
  }, [])

  return branding
}
