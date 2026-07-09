'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { HeartPulse, ShieldCheck, Stethoscope, Users } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { trackPwaEvent } from '@/lib/pwa/analytics'

export default function AdminLogin() {
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isOnline) {
      trackPwaEvent('pwa_login_blocked_offline', { area: 'admin' })
      setError('Sem conexão. Conecte-se à internet para entrar.')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao fazer login')
      }

      router.push('/admin/dashboard')
    } catch (err) {
      if (!navigator.onLine) {
        trackPwaEvent('pwa_login_blocked_offline', { area: 'admin' })
        setError('Sem conexão. Conecte-se à internet para entrar.')
      } else {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative hidden overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-900 via-cyan-800 to-emerald-700" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.22),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.28),transparent_44%)]" />

          <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col justify-between p-10 text-white xl:p-14">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white/95 px-4 py-3 shadow-lg">
                <BrandLogo
                  width={220}
                  height={72}
                  className="h-10 w-auto object-contain"
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100">
                Parceria Igreja + Saúde
              </p>
              <h2 className="mt-4 text-4xl font-bold leading-tight xl:text-5xl">
                Gestão segura dos clientes com foco em cuidado e proteção de dados.
              </h2>
              <p className="mt-4 max-w-xl text-base text-cyan-50/95">
                Área administrativa para acompanhar adesões, contratos e dependentes com
                rastreabilidade completa.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm">
                  <HeartPulse className="mb-2 h-5 w-5 text-cyan-100" />
                  <p className="font-semibold">Telemedicina</p>
                  <p className="text-cyan-100/90">Acesso rápido aos serviços de saúde.</p>
                </div>
                <div className="rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm">
                  <Stethoscope className="mb-2 h-5 w-5 text-cyan-100" />
                  <p className="font-semibold">Assistência contínua</p>
                  <p className="text-cyan-100/90">Fluxo digital para atendimento e suporte.</p>
                </div>
                <div className="rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm">
                  <Users className="mb-2 h-5 w-5 text-cyan-100" />
                  <p className="font-semibold">Gestão de famílias</p>
                  <p className="text-cyan-100/90">Controle de titulares e dependentes.</p>
                </div>
                <div className="rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm">
                  <ShieldCheck className="mb-2 h-5 w-5 text-cyan-100" />
                  <p className="font-semibold">Conformidade LGPD</p>
                  <p className="text-cyan-100/90">Dados tratados com segurança e privacidade.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="px-6 pb-6 pt-8 sm:px-8">
              <div className="mb-6 lg:hidden">
                <div className="flex flex-wrap items-center gap-3">
                  <BrandLogo
                    width={190}
                    height={62}
                    className="h-10 w-auto object-contain"
                  />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-slate-900">Painel Administrativo</h1>
              <p className="mt-1 text-sm text-slate-600">
                Informe email e senha para acessar o ambiente interno.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-700">{error}</p>
                  </div>
                )}

                {!isOnline && !error && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-800">
                      Sem conexão. Conecte-se à internet para entrar.
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="email" className="font-medium text-gray-700">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-2 border-gray-300"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="font-medium text-gray-700">
                    Senha *
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-2 border-gray-300"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !isOnline}
                  className="w-full bg-teal-700 py-2 text-base font-semibold hover:bg-teal-800"
                >
                  {isLoading ? 'Entrando...' : !isOnline ? 'Sem conexão' : 'Entrar'}
                </Button>
              </form>

              <div className="mt-6 border-t border-gray-200 pt-6">
                <p className="text-center text-sm text-gray-600">
                  Não tem acesso admin?{' '}
                  <Link href="/" className="font-medium text-teal-700 hover:text-teal-800">
                    Voltar para adesão
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
