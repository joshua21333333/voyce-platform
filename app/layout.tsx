import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Voyce — AI content that sounds like you',
  description: 'Autonomous content production that matches your voice, delivers drafts for your approval, and publishes automatically.',
  icons: {
    icon: '/voyce-logo.png',
    apple: '/voyce-logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
