'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  CreditCard,
  Home,
  LogOut,
  Menu,
  User,
  Users,
  X,
  ChevronRight,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { DEFAULT_BRANDING, DEFAULT_BRAND_LOGO_ON_LIGHT_URL } from '@/lib/branding'
import { clienteColors } from '@/lib/cliente-ui'
import { canAccessClienteDependentes } from '@/lib/cliente-access'

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Início', href: '/cliente/dashboard', icon: Home },
  { label: 'Minha Conta', href: '/cliente/conta', icon: User },
  { label: 'Financeiro', href: '/cliente/pagamentos', icon: CreditCard },
  { label: 'Dependentes', href: '/cliente/dependentes', icon: Users },
]

function NavLink({ item, active, dark, onClick }: { item: NavItem; active: boolean; dark: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
      style={{
        backgroundColor: active ? (dark ? '#FFFFFF1A' : `${clienteColors.primary}14`) : 'transparent',
        color: dark ? (active ? '#FFFFFF' : '#CBD5E1') : (active ? clienteColors.primary : clienteColors.textMuted),
      }}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
      {active && <ChevronRight className="ml-auto h-4 w-4 opacity-60" />}
    </Link>
  )
}

type ClienteNavProps = {
  nomeCliente?: string
  usuarioTipo?: 'titular' | 'dependente'
  appearance?: 'default' | 'midnight'
  children: React.ReactNode
}

export function ClienteNav({ nomeCliente, usuarioTipo = 'titular', appearance = 'default', children }: ClienteNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const dark = appearance === 'midnight'
  const shellBackground = dark ? '#0B1E36' : clienteColors.background
  const surfaceBackground = dark ? '#0B1E36' : clienteColors.surface
  const borderColor = dark ? '#FFFFFF1A' : clienteColors.border
  const primaryTextColor = dark ? '#FFFFFF' : clienteColors.text
  const mutedTextColor = dark ? '#CBD5E1' : clienteColors.textMuted
  const logoUrl = dark ? DEFAULT_BRANDING.brandLogoUrl : DEFAULT_BRAND_LOGO_ON_LIGHT_URL

  const handleLogout = async () => {
    setSheetOpen(false)
    await fetch('/api/cliente/logout', { method: 'POST' })
    router.push('/login')
  }

  const sidebarContent = (onClickItem?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className="flex items-center gap-3 border-b px-4 py-4"
        style={{ borderColor }}
      >
        {!dark && (
          <BrandLogo
            logoUrl={logoUrl}
            width={200}
            height={200}
            className="h-10 w-10 object-contain"
          />
        )}
        {nomeCliente && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: primaryTextColor }}>
              {nomeCliente.split(' ')[0]}
            </p>
            <p className="text-xs" style={{ color: mutedTextColor }}>
              Área do cliente
            </p>
          </div>
        )}
      </div>

      {/* Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p
          className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: mutedTextColor }}
        >
          Menu
        </p>
        {NAV_ITEMS.filter((item) => item.href !== '/cliente/dependentes' || canAccessClienteDependentes(usuarioTipo)).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            dark={dark}
            onClick={onClickItem}
          />
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t px-3 py-4" style={{ borderColor }}>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:opacity-80"
          style={{ color: clienteColors.danger }}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: shellBackground }}>
      {/* ── SIDEBAR desktop (md+) ── */}
      <aside
        className="hidden md:flex md:w-56 md:flex-col md:shrink-0 sticky top-0 h-screen overflow-y-auto border-r"
        style={{
          backgroundColor: surfaceBackground,
          borderColor,
        }}
      >
        {sidebarContent()}
      </aside>

      {/* ── SHEET mobile overlay ── */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setSheetOpen(false)}
          />
          {/* Drawer */}
          <div
            className="fixed inset-y-0 left-0 z-50 w-64 shadow-2xl md:hidden"
            style={{ backgroundColor: surfaceBackground }}
          >
            <button
              onClick={() => setSheetOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: dark ? '#FFFFFF1A' : `${clienteColors.border}80` }}
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" style={{ color: primaryTextColor }} />
            </button>
            {sidebarContent(() => setSheetOpen(false))}
          </div>
        </>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar mobile */}
        <header
          className={`sticky top-0 z-30 flex items-center justify-between px-4 md:hidden ${dark ? 'py-2' : 'py-3 shadow-sm'}`}
          style={{
            backgroundColor: surfaceBackground,
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <button
            onClick={() => setSheetOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition"
            style={{ backgroundColor: dark ? '#FFFFFF1A' : `${clienteColors.primary}12` }}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" style={{ color: dark ? '#FFFFFF' : clienteColors.primary }} />
          </button>

          {!dark && (
            <BrandLogo
              logoUrl={logoUrl}
              width={200}
              height={200}
              className="h-10 w-10 object-contain"
            />
          )}

          {/* Placeholder to balance flex */}
          <div className="h-10 w-10" />
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
