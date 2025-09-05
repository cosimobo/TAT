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
  interface Window {
    OneSignal: any
    ensureTATPush?: () => Promise<void>
  }
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

          // Tag utente se salvato
          try {
            const meCookie = getCookie('tat_me')
            const meLS = localStorage.getItem('tat_me')
            const me = meCookie || meLS
            if (me) {
              if (OneSignal.sendTag) OneSignal.sendTag('person', me)
              if (OneSignal.User?.addTag) OneSignal.User.addTag('person', me)
            }
          } catch {}

          // Funzione globale: chiede permesso e poi opt-in subscription (SDK v16+)
          window.ensureTATPush = async () => {
            try {
              // 1) permesso nativo
              const current = await OneSignal.Notifications?.permission?.()
              if (current === 'default') {
                if (OneSignal.Slidedown?.promptPush) {
                  await OneSignal.Slidedown.promptPush()
                } else if (OneSignal.Notifications?.requestPermission) {
                  await OneSignal.Notifications.requestPermission()
                }
              }

              // 2) opt-in della push subscription
              if (OneSignal?.User?.PushSubscription?.optIn) {
                await OneSignal.User.PushSubscription.optIn()
              } else if (OneSignal?.registerForPushNotifications) {
                await OneSignal.registerForPushNotifications()
              }

              const supported = await OneSignal.Notifications?.isPushSupported?.()
              const perm = await OneSignal.Notifications?.permission?.()
              const opted = await OneSignal.User?.PushSubscription?.optedIn
              console.log('[OneSignal] supported:', supported, 'permission:', perm, 'optedIn:', opted)
              if (perm === 'denied') {
                alert('Le notifiche sono bloccate nel browser. Sbloccale dal lucchetto accanto all’URL e riprova.')
              }
            } catch (e) {
              console.error('[OneSignal] ensureTATPush error:', e)
              alert('Errore nell’attivazione notifiche. Controlla i permessi del browser.')
            }
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
