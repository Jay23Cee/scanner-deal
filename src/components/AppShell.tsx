'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

const navItems = [
  { href: '/scanner', label: 'Scanner' },
  { href: '/orders', label: 'Orders' },
  { href: '/history', label: 'Searches' },
  { href: '/analyses', label: 'Analyses' },
  { href: '/settings', label: 'Settings' }
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__meta">Single-user resale workflow</div>
        <div className="topbar__row">
          <div>
            <p className="eyebrow">eBay Resale Scanner</p>
            <h1 className="topbar__title">Compare active listings. Decide fast.</h1>
          </div>
          <div className="topbar__badge">Browse + seller orders</div>
        </div>
      </header>

      <main className="page-shell">{children}</main>

      <nav className="bottom-nav" aria-label="Primary">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              pathname === item.href || pathname.startsWith(`${item.href}/`)
                ? 'bottom-nav__link is-active'
                : 'bottom-nav__link'
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
