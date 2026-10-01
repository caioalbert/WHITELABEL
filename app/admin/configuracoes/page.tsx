'use client'

import { AdminPageHeader } from '@/components/admin/page-header'

import { Button } from '@/components/ui/button'
import Link from 'next/link'

const SETTINGS_ITEMS = [
  {
    title: 'Planos',
    description: 'Gerencie planos, formas de cobrança, comissões, identidade visual e configurações operacionais.',
    href: '/admin/planos',
    actionLabel: 'Gerenciar Planos',
  },
  {
    title: 'Parceiros',
    description: 'Cadastre parceiros com links de venda e comissões configuráveis.',
    href: '/admin/parceiros',
    actionLabel: 'Gerenciar Parceiros',
  },
  {
    title: 'Termos e contratos',
    description: 'Atualize o template usado na geração do PDF enviado aos clientes.',
    href: '/admin/termo-template',
    actionLabel: 'Editar documento',
  },
]

export default function AdminConfiguracoesPage() {

  return (
    <main className="min-h-screen bg-gray-50">
      <AdminPageHeader title="Configurações" description="Ajustes da operação, planos e documentos."></AdminPageHeader>

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
