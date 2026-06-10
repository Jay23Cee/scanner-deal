import type { Metadata } from 'next'
import { IBM_Plex_Sans, Space_Grotesk } from 'next/font/google'
import { AppShell } from '@/components/AppShell'
import './globals.css'

const headingFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading'
})

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body'
})

export const metadata: Metadata = {
  title: 'eBay Resale Scanner',
  description: 'Mobile-first resale workflow for active eBay Browse listings and seller-owned Fulfillment orders.'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${headingFont.variable} ${bodyFont.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
