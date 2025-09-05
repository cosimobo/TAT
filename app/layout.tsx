import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import OneSignalClient from './OneSignalClient'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TAT - Tocca a Te',
  description: 'Gestione turni familiari per i nonni',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className={`${inter.className} bg-gray-50 min-h-screen text-gray-900`}>
        {/* Inizializzazione OneSignal */}
        <OneSignalClient />
        {/* Tutto il resto della tua app */}
        {children}
      </body>
    </html>
  )
}
