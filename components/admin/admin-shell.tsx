'use client'

import { BrandLogoImage } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { usePublicBranding } from '@/hooks/use-public-branding'
import { DEFAULT_BRANDING, DEFAULT_BRAND_LOGO_ON_LIGHT_URL } from '@/lib/branding'
import {
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  FileText,
  Handshake,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

const groups = [
  {
    label: 'Visão geral',
    items: [
      {
        label: 'Resumo',
        href: '/admin/dashboard',
        icon: ChartNoAxesCombined,
        keywords: 'dashboard indicadores receitas',
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        label: 'Clientes',
        href: '/admin/cadastros',
        icon: Users,
        keywords: 'cadastro dependentes titulares',
      },
      {
        label: 'Empresas',
        href: '/admin/empresas',
        icon: Building2,
        keywords: 'colaboradores convênio funcionários',
      },
      {
        label: 'Vendedores',
        href: '/admin/vendedores',
        icon: Handshake,
        keywords: 'vendas comissões',
      },
      {
        label: 'Parceiros',
        href: '/admin/parceiros',
        icon: LayoutGrid,
        keywords: 'links vendas parceiros',
      },
    ],
  },
  {
    label: 'Configuração',
    items: [
      {
        label: 'Planos',
        href: '/admin/planos',
        icon: Wallet,
        keywords: 'preços mensalidade cobrança',
      },
      {
        label: 'Termos e contratos',
        href: '/admin/termo-template',
        icon: FileText,
        keywords: 'pdf adesão contrato',
      },
      {
        label: 'Configurações',
        href: '/admin/configuracoes',
        icon: SlidersHorizontal,
        keywords: 'ajustes sistema',
      },
    ],
  },
]

function isCurrent(path: string, href: string) {
  if (href === '/admin/cadastros')
    return /^\/admin\/(cadastros|cadastro|clientes|cliente)(\/|$)/.test(path)
  if (href === '/admin/planos' && path === '/admin/cobranca-configuracoes')
    return true
  return path === href || path.startsWith(`${href}/`)
}

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const branding = usePublicBranding()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const searchReturnFocus = useRef<HTMLElement | null>(null)
  const login = path === '/admin/login'
  const active = groups
    .flatMap((group) => group.items)
    .find((item) => isCurrent(path, item.href))

  useEffect(() => {
    if (login) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (!searchOpen)
          searchReturnFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
        setSearchOpen(!searchOpen)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [login, searchOpen])

  async function logout() {
    setLogoutBusy(true)
    setLogoutError('')
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' })
      if (!response.ok)
        throw new Error('Não foi possível sair. Tente novamente.')
      router.push('/admin/login')
      router.refresh()
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : 'Não foi possível sair.',
      )
    } finally {
      setLogoutBusy(false)
    }
  }

  function openSearch() {
    searchReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setSearchOpen(true)
  }

  function navigate(href: string) {
    setMenuOpen(false)
    setSearchOpen(false)
    router.push(href)
  }

  function navigation() {
    return (
      <>
        <Link
          href="/admin/dashboard"
          className="admin-brand"
          onClick={() => setMenuOpen(false)}
          aria-label={`${branding.brandName} — Resumo`}
        >
          <span className="admin-brand-mark">
            <BrandLogoImage
              branding={branding}
              logoUrl={branding.brandLogoUrl === DEFAULT_BRANDING.brandLogoUrl ? DEFAULT_BRAND_LOGO_ON_LIGHT_URL : undefined}
              className="h-10 w-10"
              width={48}
              height={48}
            />
          </span>
          <span>
            <strong>{branding.brandName}</strong>
            <small>Administração</small>
          </span>
        </Link>
        <button
          type="button"
          className="admin-nav-search"
          onClick={() => {
            setMenuOpen(false)
            openSearch()
          }}
        >
          <Search size={16} aria-hidden="true" />
          <span>Buscar no painel</span>
          <kbd>⌘ / Ctrl K</kbd>
        </button>
        <nav aria-label="Navegação administrativa" className="admin-nav">
          {groups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isCurrent(path, item.href) ? 'page' : undefined}
                  className="admin-nav-link"
                >
                  <item.icon size={19} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-nav-footer">
          {logoutError && (
            <p role="alert" className="text-sm text-red-700">
              {logoutError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            disabled={logoutBusy}
            className="admin-logout"
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{logoutBusy ? 'Saindo…' : 'Sair do painel'}</span>
          </button>
        </div>
      </>
    )
  }

  if (login) return <div className="admin-login">{children}</div>

  return (
    <div className="admin-shell">
      <a className="admin-skip" href="#admin-content">
        Pular para o conteúdo
      </a>
      <aside className="admin-sidebar">{navigation()}</aside>
      <div className="admin-workspace">
        <div className="admin-toolbar">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="admin-menu-trigger"
                aria-label="Abrir navegação"
              >
                <Menu size={21} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="admin-shell admin-mobile-sidebar"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navegação administrativa</SheetTitle>
                <SheetDescription>Escolha uma área do painel.</SheetDescription>
              </SheetHeader>
              {navigation()}
            </SheetContent>
          </Sheet>
          <nav aria-label="Caminho da página" className="admin-breadcrumb">
            <span>Administração</span>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{active?.label || 'Painel'}</span>
            {active && path !== active.href && (
              <>
                <ChevronRight size={14} aria-hidden="true" />
                <span>
                  {path.endsWith('/nova')
                    ? 'Nova empresa'
                    : path.endsWith('/editar')
                      ? 'Editar'
                      : 'Detalhes'}
                </span>
              </>
            )}
          </nav>
          <button
            type="button"
            onClick={openSearch}
            className="admin-toolbar-search"
            aria-label="Buscar no painel"
          >
            <Search size={18} />
            <span>Buscar</span>
          </button>
        </div>
        <div id="admin-content" tabIndex={-1} className="admin-content">
          {children}
        </div>
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent
          className="admin-search-dialog p-0 overflow-hidden"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (searchReturnFocus.current?.isConnected)
              searchReturnFocus.current.focus()
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Buscar no painel</DialogTitle>
            <DialogDescription>
              Busque uma área ou abra um novo cadastro de empresa.
            </DialogDescription>
          </DialogHeader>
          <Command>
            <div className="flex items-center border-b">
              <CommandInput placeholder="Onde você quer ir?" className="h-14" />
              <button
                type="button"
                className="m-2 rounded-lg p-2 hover:bg-gray-100"
                onClick={() => setSearchOpen(false)}
                aria-label="Fechar busca"
              >
                <X size={18} />
              </button>
            </div>
            <CommandList>
              <CommandEmpty>
                Nenhuma área encontrada. Tente outro termo.
              </CommandEmpty>
              <CommandGroup heading="Ação rápida">
                <CommandItem
                  value="Nova empresa cadastro colaboradores"
                  onSelect={() => navigate('/admin/empresas/nova')}
                >
                  <Building2 size={18} />
                  <span>Cadastrar empresa</span>
                </CommandItem>
              </CommandGroup>
              {groups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={`${item.label} ${item.keywords}`}
                      onSelect={() => navigate(item.href)}
                    >
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  )
}
