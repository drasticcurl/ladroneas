import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Extractor 123 - Quiz Funnel Analyzer',
  description: 'Analiza y documenta quiz funnels de la competencia',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className={inter.className}>
        <main className="min-h-screen">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
}
