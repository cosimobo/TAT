'use client'
import { useEffect } from 'react'

export default function OneSignalClient() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId || typeof window === 'undefined') return
    // @ts-ignore
    window.OneSignal = window.OneSignal || []
    // @ts-ignore
    const OneSignal = window.OneSignal
    OneSignal.push(function () {
      OneSignal.SERVICE_WORKER_PARAM = { scope: '/' }
      OneSignal.SERVICE_WORKER_PATH = '/OneSignalSDKWorker.js'
      OneSignal.SERVICE_WORKER_UPDATER_PATH = '/OneSignalSDKUpdaterWorker.js'
      OneSignal.init({ appId })
    })
  }, [])
  return null
}
