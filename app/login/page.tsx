'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { usePublicBranding } from '@/hooks/use-public-branding'
import { trackPwaEvent } from '@/lib/pwa/analytics'
import { clienteColors, clienteRadius } from '@/lib/cliente-ui'

const CPF_PASSWORD_LENGTH = 4

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
  const [docPrefix, setDocPrefix] = useState('')
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

    if (docPrefix.length !== CPF_PASSWORD_LENGTH) {
      setError(`Informe os ${CPF_PASSWORD_LENGTH} primeiros dígitos do ${docLabel}.`)
      return
    }

    if (docClean.slice(0, CPF_PASSWORD_LENGTH) !== docPrefix) {
      setError(`Os ${CPF_PASSWORD_LENGTH} primeiros dígitos não conferem com o ${docLabel} informado.`)
      return
    }

    if (!isOnline) {
      trackPwaEvent('pwa_login_blocked_offline', { area: 'cliente' })
      setError('Sem conexão. Conecte-se à internet para entrar.')
      return
    }

    setIsLoading(true)

    try {
      const body = isEmpresa
        ? { cnpj: docClean, cnpj_prefix: docPrefix }
        : { cpf: docClean, cpf_prefix: docPrefix }

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

      router.push('/cliente/dashboard')
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
            width={520}
            height={169}
            className="mx-auto h-16 w-auto"
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
              disabled={isLoading}
              autoComplete="off"
              className="h-12 text-base"
              style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
            />
          </div>

          <div>
            <label
              htmlFor="doc_prefix"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: clienteColors.text }}
            >
              Senha
            </label>
            <Input
              id="doc_prefix"
              type="password"
              inputMode="numeric"
              value={docPrefix}
              onChange={(e) =>
                setDocPrefix(e.target.value.replace(/\D/g, '').slice(0, CPF_PASSWORD_LENGTH))
              }
              placeholder={'0'.repeat(CPF_PASSWORD_LENGTH)}
              maxLength={CPF_PASSWORD_LENGTH}
              required
              disabled={isLoading}
              autoComplete="off"
              className="h-12 text-center text-2xl font-semibold tracking-[0.35em]"
              style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
            />
            <p className="mt-2 text-xs" style={{ color: clienteColors.textMuted }}>
              Os {CPF_PASSWORD_LENGTH} primeiros dígitos do seu {docLabel} (somente números).
            </p>
          </div>

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
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>

          <p className="text-center text-sm leading-relaxed" style={{ color: clienteColors.textMuted }}>
            {docLabel} completo + senha com os {CPF_PASSWORD_LENGTH} primeiros dígitos do {docLabel}.
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
            <Link href="/cadastro" className="underline">
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
