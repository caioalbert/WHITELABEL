'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { trackPwaEvent } from '@/lib/pwa/analytics'

export default function VendedorLoginPage() {
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isOnline) {
      trackPwaEvent('pwa_login_blocked_offline', { area: 'vendedor' })
      setError('Sem conexão. Conecte-se à internet para entrar.')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/vendedor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao fazer login do vendedor.')
      }

      router.push('/vendedor/dashboard')
    } catch (err) {
      if (!navigator.onLine) {
        trackPwaEvent('pwa_login_blocked_offline', { area: 'vendedor' })
        setError('Sem conexão. Conecte-se à internet para entrar.')
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao fazer login do vendedor.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Acesso do Vendedor</h1>
          <p className="text-sm text-gray-600 mt-1">Entre para acompanhar suas vendas e pagamentos.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-sm font-medium text-gray-700">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!isOnline && !error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">Sem conexão. Conecte-se à internet para entrar.</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || !isOnline}>
            {isLoading ? 'Entrando...' : !isOnline ? 'Sem conexão' : 'Entrar'}
          </Button>
        </form>

        <Link href="/" className="block text-center text-sm text-gray-600 hover:text-gray-900">
          Voltar para Início
        </Link>
      </div>
    </main>
  )
}
