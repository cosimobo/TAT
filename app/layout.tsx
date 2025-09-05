import './globals.css'

export const metadata = {
  title: 'TAT',
  description: 'Tocca A Te — family night duty scheduler'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <header className="flex items-center justify-between">
            <h1 className="text-xl font-bold">TAT</h1>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
