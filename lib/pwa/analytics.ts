'use client'

import { track } from '@vercel/analytics'

type PwaEventData = Record<string, string | number | boolean | null>

export function trackPwaEvent(eventName: string, data?: PwaEventData) {
  try {
    track(eventName, data)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('PWA analytics track failed:', { eventName, data, error })
    }
  }
}
