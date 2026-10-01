'use client'

import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { DEFAULT_BRAND_LOGO_ON_LIGHT_URL } from '@/lib/branding'
import { trackPwaEvent } from '@/lib/pwa/analytics'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
    <main>
      <div className="admin-login-card">
        <BrandLogo logoUrl={DEFAULT_BRAND_LOGO_ON_LIGHT_URL} width={80} height={80} className="mb-8 h-16 w-16" />
        <p className="mb-2 text-xs font-semibold text-blue-700">ADMINISTRAÇÃO</p>
        <h1>Bem-vindo ao painel</h1>
        <p className="login-caption">Entre para gerenciar clientes, empresas e sua operação.</p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3" role="alert">
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
                    autoComplete="username"
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
                    autoComplete="current-password"
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
                  className="w-full bg-blue-600 py-2 text-base font-semibold hover:bg-blue-700"
                >
                  {isLoading ? 'Entrando...' : !isOnline ? 'Sem conexão' : 'Entrar'}
                </Button>
              </form>
        <div className="mt-6 border-t pt-5 text-center text-sm"><Link href="/" className="text-blue-700 hover:underline">Voltar para adesão</Link></div>
      </div>
    </main>
  )
}
