'use client'
import { useEffect } from 'react'

function loadOneSignalSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
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

declare global {
  interface Window { OneSignal: any }
}

export default function OneSignalClient() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId || typeof window === 'undefined') return

    loadOneSignalSdk()
      .then(() => {
        window.OneSignal = window.OneSignal || []
        const OneSignal = window.OneSignal

        OneSignal.push(function () {
          // Path dei service worker (devono esistere in /public)
          OneSignal.SERVICE_WORKER_PARAM = { scope: '/' }
          OneSignal.SERVICE_WORKER_PATH = '/OneSignalSDKWorker.js'
          OneSignal.SERVICE_WORKER_UPDATER_PATH = '/OneSignalSDKUpdaterWorker.js'

          // Init
          OneSignal.init({ appId })

          // Mostra prompt al primo avvio (se applicabile)
          if (OneSignal.Slidedown?.promptPush) {
            OneSignal.Slidedown.promptPush()
          } else if (OneSignal.Notifications?.requestPermission) {
            OneSignal.Notifications.requestPermission()
          }

          // Se abbiamo salvato l'utente localmente, associa un tag "person"
          try {
            const me = localStorage.getItem('tat_me')
            if (me) {
              if (OneSignal.sendTag) OneSignal.sendTag('person', me)
              if (OneSignal.User?.addTag) OneSignal.User.addTag('person', me)
            }
          } catch {}

          // Log diagnostici utili
          OneSignal.Notifications?.isPushSupported().then((ok: boolean) =>
            console.log('[OneSignal] Push supported:', ok)
          )
          OneSignal.Notifications?.permissionNative().then((p: any) =>
            console.log('[OneSignal] Native permission:', p)
          )
          OneSignal.Notifications?.permission().then((p: any) =>
            console.log('[OneSignal] OneSignal permission:', p)
          )
        })
      })
      .catch((err) => {
        console.error('[OneSignal] SDK load error:', err)
      })
  }, [])

  return null
}
