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

function getCookie(name: string) {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
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
          // Service worker paths (devono esistere in /public)
          OneSignal.SERVICE_WORKER_PARAM = { scope: '/' }
          OneSignal.SERVICE_WORKER_PATH = '/OneSignalSDKWorker.js'
          OneSignal.SERVICE_WORKER_UPDATER_PATH = '/OneSignalSDKUpdaterWorker.js'

          OneSignal.init({ appId })

          // Se abbiamo già l'utente, mandiamo tag "person"
          try {
            const meCookie = getCookie('tat_me')
            const meLS = localStorage.getItem('tat_me')
            const me = meCookie || meLS
            if (me) {
              if (OneSignal.sendTag) OneSignal.sendTag('person', me)
              if (OneSignal.User?.addTag) OneSignal.User.addTag('person', me)
            }
          } catch {}

          // Prova a mostrare il prompt solo se non è già deciso
          if (OneSignal.Notifications?.permission) {
            OneSignal.Notifications.permission().then((perm: string) => {
              if (perm === 'default') {
                if (OneSignal.Slidedown?.promptPush) OneSignal.Slidedown.promptPush()
                else if (OneSignal.Notifications?.requestPermission) OneSignal.Notifications.requestPermission()
              } else {
                console.log('[OneSignal] Permission already:', perm)
              }
            })
          }

          // Log diagnostici
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
