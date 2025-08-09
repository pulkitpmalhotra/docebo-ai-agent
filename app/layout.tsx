import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Docebo AI Agent',
  description: 'AI-powered Docebo administration assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
