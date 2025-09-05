'use client'
import { useEffect } from 'react'

function loadOneSignalSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Evita doppio inserimento
    if (document.getElementById('onesignal-sdk')) return resolve()

    const s = document.createElement('script')
    s.id = 'onesignal-sdk'
    s.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load OneSignal SDK'))
    document.head.appendChild(s)
  })
}

export default function OneSignalClient() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId || typeof window === 'undefined') return

    // Carica SDK e poi inizializza
    loadOneSignalSdk()
      .then(() => {
        // @ts-ignore
        window.OneSignal = window.OneSignal || []
        // @ts-ignore
        const OneSignal = window.OneSignal

        OneSignal.push(function () {
          // Imposta i path dei service worker (devono esistere in /public)
          OneSignal.SERVICE_WORKER_PARAM = { scope: '/' }
          OneSignal.SERVICE_WORKER_PATH = '/OneSignalSDKWorker.js'
          OneSignal.SERVICE_WORKER_UPDATER_PATH = '/OneSignalSDKUpdaterWorker.js'

          // Inizializza
          OneSignal.init({ appId })

          // Mostra automaticamente il prompt (slidedown)
          // Se il browser ha già il permesso deciso, non apparirà (è normale).
          if (OneSignal.Slidedown) {
            OneSignal.Slidedown.promptPush()
          } else if (OneSignal.Notifications?.requestPermission) {
            // Fallback per versioni diverse dell’SDK
            OneSignal.Notifications.requestPermission()
          }
        })
      })
      .catch((err) => {
        console.error('[OneSignal] SDK load error:', err)
      })
  }, [])

  return null
}
