'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { usePublicBranding } from '@/hooks/use-public-branding'
import { DEFAULT_BRAND_LOGO_ON_LIGHT_URL } from '@/lib/branding'
import { trackPwaEvent } from '@/lib/pwa/analytics'
import { clienteColors, clienteRadius } from '@/lib/cliente-ui'


function formatCPF(value: string) {
  const n = value.replace(/\D/g, '').slice(0, 11)
  return n
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatCNPJ(value: string) {
  const n = value.replace(/\D/g, '').slice(0, 14)
  return n
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEmpresa = searchParams.get('tipo') === 'empresa'

  const isOnline = useOnlineStatus()
  const branding = usePublicBranding()
  const [doc, setDoc] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [retryAt, setRetryAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [retryAt])
  useEffect(() => { setChallengeId(null); setCode(''); setError('') }, [isEmpresa])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const docLabel = isEmpresa ? 'CNPJ' : 'CPF'
  const docLength = isEmpresa ? 14 : 11
  const docPlaceholder = isEmpresa ? '00.000.000/0000-00' : '000.000.000-00'
  const docMaxLen = isEmpresa ? 18 : 14

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = isEmpresa
      ? formatCNPJ(e.target.value)
      : formatCPF(e.target.value)
    setDoc(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const docClean = doc.replace(/\D/g, '')
    if (docClean.length !== docLength) {
      setError(`Informe um ${docLabel} válido com ${docLength} dígitos.`)
      return
    }

    if (challengeId && !/^\d{6}$/.test(code)) {
      setError('Informe o código de 6 dígitos.')
      return
    }

    if (!isOnline) {
      trackPwaEvent('pwa_login_blocked_offline', { area: 'cliente' })
      setError('Sem conexão. Conecte-se à internet para entrar.')
      return
    }

    setIsLoading(true)

    try {
      const body = { ...(isEmpresa ? { cnpj: docClean } : { cpf: docClean }),
        ...(challengeId ? { action: 'verify', challengeId, code } : { action: 'request' }) }

      const response = await fetch('/api/cliente/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao fazer login')
        return
      }

      if (!challengeId) {
        setChallengeId(data.challengeId)
        setRetryAt(Date.now() + 60_000)
        return
      }
      router.push(data.nextPath || (isEmpresa ? '/empresa/dashboard' : '/cliente/dashboard'))
    } catch {
      if (!navigator.onLine) {
        trackPwaEvent('pwa_login_blocked_offline', { area: 'cliente' })
        setError('Sem conexão. Conecte-se à internet para entrar.')
      } else {
        setError('Erro ao conectar com o servidor')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: `linear-gradient(180deg, ${clienteColors.background} 0%, ${clienteColors.backgroundGradientEnd} 100%)`,
      }}
    >
      <div
        className="w-full max-w-md border p-8 sm:p-10"
        style={{
          backgroundColor: clienteColors.surface,
          borderColor: clienteColors.borderMint,
          borderRadius: clienteRadius.xl,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.10)',
        }}
      >
        <div className="text-center">
          <BrandLogo
            logoUrl={DEFAULT_BRAND_LOGO_ON_LIGHT_URL}
            width={500}
            height={500}
            className="mx-auto h-28 w-28 object-contain"
          />
          <p className="mt-3 text-sm" style={{ color: clienteColors.textMuted }}>
            {isEmpresa ? 'Acesso para empresas parceiras' : branding.appTagline}
          </p>
        </div>

        {/* Tipo toggle */}
        <div className="mt-6 flex overflow-hidden rounded-xl border" style={{ borderColor: clienteColors.borderMint }}>
          <Link
            href="/login"
            className="flex flex-1 items-center justify-center py-2.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: !isEmpresa ? clienteColors.primary : 'transparent',
              color: !isEmpresa ? clienteColors.surface : clienteColors.textMuted,
            }}
          >
            Sou Cliente
          </Link>
          <Link
            href="/login?tipo=empresa"
            className="flex flex-1 items-center justify-center border-l py-2.5 text-sm font-semibold transition-colors"
            style={{
              borderColor: clienteColors.borderMint,
              backgroundColor: isEmpresa ? clienteColors.primary : 'transparent',
              color: isEmpresa ? clienteColors.surface : clienteColors.textMuted,
            }}
          >
            Sou Empresa
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="doc"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: clienteColors.text }}
            >
              {docLabel}
            </label>
            <Input
              id="doc"
              type="text"
              inputMode="numeric"
              value={doc}
              onChange={handleDocChange}
              placeholder={docPlaceholder}
              maxLength={docMaxLen}
              required
              disabled={isLoading || Boolean(challengeId)}
              autoComplete="off"
              className="h-12 text-base"
              style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
            />
          </div>

          {challengeId && <div>
            <p className="mb-4 text-sm" style={{ color: clienteColors.textMuted }}>Se houver um cadastro com e-mail válido, enviaremos um código. Se o contato for da empresa, solicite o código ao responsável.</p>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium">Código de acesso</label>
            <Input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} required disabled={isLoading}
              className="h-12 text-center text-2xl tracking-[0.35em]" />
            <p className="mt-2 text-xs" style={{ color: clienteColors.textMuted }}>Válido por 10 minutos. Não compartilhe o código.</p>
            <button type="button" className="mt-3 text-sm underline" disabled={isLoading || remaining > 0}
              onClick={() => { setChallengeId(null); setCode(''); setError('') }}>
              {remaining ? `Solicitar outro código em ${remaining}s` : 'Alterar dados ou solicitar outro código'}
            </button>
          </div>}

          {error ? (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                backgroundColor: '#FEF2F2',
                borderColor: '#FECACA',
                color: clienteColors.danger,
              }}
            >
              {error}
            </div>
          ) : null}

          {!isOnline && !error ? (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                backgroundColor: clienteColors.amberBg,
                borderColor: '#FDE68A',
                color: clienteColors.amber,
              }}
            >
              Sem conexão. Conecte-se à internet para entrar.
            </div>
          ) : null}

          <Button
            type="submit"
            className="h-12 w-full text-base font-bold"
            disabled={isLoading || !isOnline}
            style={{
              backgroundColor: clienteColors.primary,
              color: clienteColors.surface,
              borderRadius: clienteRadius.full,
            }}
          >
            {isLoading ? 'Aguarde...' : challengeId ? 'Entrar' : 'Receber código no e-mail'}
          </Button>

          <p className="text-center text-sm leading-relaxed" style={{ color: clienteColors.textMuted }}>
            Informe seu documento para receber o código no e-mail cadastrado. Para corrigir o contato, procure o suporte.
          </p>
        </form>

        <div
          className="mt-5 rounded-xl border px-3 py-2 text-center"
          style={{
            borderColor: clienteColors.borderMint,
            backgroundColor: `${clienteColors.primary}10`,
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: clienteColors.primary }}>
            Acesso rápido
          </p>
          <p className="mt-0.5 text-xs" style={{ color: clienteColors.textMuted }}>
            <Link href={isEmpresa ? '/empresa/cadastro' : '/cadastro'} className="underline">
              Não tem cadastro? Cadastre-se aqui
            </Link>
            {' | '}
            <Link href="/" className="underline">
              Voltar ao início
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
