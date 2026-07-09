'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SETTINGS_ITEMS = [
  {
    title: 'Planos',
    description: 'Liste os planos existentes, ajuste nome e valor e cadastre novos planos.',
    href: '/admin/planos',
    actionLabel: 'Gerenciar Planos',
  },
  {
    title: 'Institutos/Parceiros',
    description: 'Cadastre institutos e parceiros com links de venda e comissões configuráveis.',
    href: '/admin/institutos',
    actionLabel: 'Gerenciar Institutos',
  },
  {
    title: 'Termo de Adesão',
    description: 'Atualize o template usado na geração do PDF enviado aos clientes.',
    href: '/admin/termo-template',
    actionLabel: 'Gerenciar Termo',
  },
  {
    title: 'Configurações de Cobrança',
    description: 'Defina formas de cobrança da mensalidade, opção padrão e percentuais de comissão.',
    href: '/admin/cobranca-configuracoes',
    actionLabel: 'Gerenciar Cobrança',
  },
  {
    title: 'Identidade Visual',
    description: 'Troque nome da marca, nome curto e logo exibida nas telas do whitelabel.',
    href: '/admin/cobranca-configuracoes#identidade-visual',
    actionLabel: 'Trocar Logo',
  },
]

export default function AdminConfiguracoesPage() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Configurações</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Central de ajustes administrativos do sistema</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/admin/dashboard">
              <Button variant="outline">Voltar ao Dashboard</Button>
            </Link>
            <Button onClick={handleLogout} variant="outline">
              Sair
            </Button>
          </div>

          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu Configurações</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/dashboard">Voltar ao Dashboard</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button onClick={handleLogout} variant="outline" className="w-full justify-start">
                      Sair
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SETTINGS_ITEMS.map((item) => (
            <section key={item.href} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              <div className="mt-5">
                <Link href={item.href}>
                  <Button variant="outline">{item.actionLabel}</Button>
                </Link>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
