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
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [setupToken, setSetupToken] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [retryAt, setRetryAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [retryAt])
  useEffect(() => { setSetupToken(null); setPassword(''); setNewPassword(''); setConfirmation(''); setMessage(''); setError('') }, [isEmpresa])
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

  const submit = async (action: 'password' | 'request' | 'set') => {
    setError('')
    const docClean = doc.replace(/\D/g, '')
    if (docClean.length !== docLength) { setError(`Informe um ${docLabel} válido com ${docLength} dígitos.`); return }
    if (!isOnline) { trackPwaEvent('pwa_login_blocked_offline', { area: 'cliente' }); setError('Sem conexão. Conecte-se à internet para entrar.'); return }
    if (action === 'set' && newPassword.normalize('NFC') !== confirmation.normalize('NFC')) { setError('As senhas não coincidem.'); return }
    setIsLoading(true)
    try {
      const response = await fetch(action === 'set' ? '/api/cliente/password' : '/api/cliente/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(action === 'set' ? { Authorization: `Bearer ${setupToken}` } : {}) },
        body: JSON.stringify(action === 'set' ? { password: newPassword, confirmation }
          : { ...(isEmpresa ? { cnpj: docClean } : { cpf: docClean }), action, ...(action === 'password' ? { password } : {}) }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (action === 'set' && (response.status === 401 || data.passwordUpdated)) { setSetupToken(null); setNewPassword(''); setConfirmation('') }
        setError(data.error || 'Não foi possível concluir o acesso'); return
      }
      if (action === 'request') { setMessage(data.message); setRetryAt(Date.now() + 60_000); return }
      if (data.requiresPasswordChange) {
        setSetupToken(data.setupToken); setPassword(''); setMessage(''); return
      }
      setSetupToken(null); setNewPassword(''); setConfirmation('')
      router.push(data.nextPath || (isEmpresa ? '/empresa/dashboard' : '/cliente/dashboard'))
    } catch {
      setError(navigator.onLine ? 'Erro ao conectar com o servidor' : 'Sem conexão. Conecte-se à internet para entrar.')
    } finally { setIsLoading(false) }
  }
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); void submit(setupToken ? 'set' : 'password') }

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

        {/* Tipo de acesso */}
        <div hidden={Boolean(setupToken)} className="mt-6 flex overflow-hidden rounded-xl border" style={{ borderColor: clienteColors.borderMint }}>
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
          {setupToken ? <>
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: clienteColors.text }}>Crie sua senha pessoal</h1>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: clienteColors.textMuted }}>Sua senha temporária já foi utilizada. Para acessar sua conta, crie uma senha pessoal diferente. Uma frase com pelo menos 15 caracteres é uma boa opção.</p>
            </div>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">Nova senha</label>
              <Input id="new-password" type="password" autoComplete="new-password" autoFocus value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={15} maxLength={512} required disabled={isLoading} className="h-12 text-base" />
            </div>
            <div>
              <label htmlFor="confirmation" className="mb-1.5 block text-sm font-medium">Confirmar nova senha</label>
              <Input id="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={15} maxLength={512} required disabled={isLoading} className="h-12 text-base" />
            </div>
          </> : <>
            <div>
              <label htmlFor="doc" className="mb-1.5 block text-sm font-medium" style={{ color: clienteColors.text }}>{docLabel}</label>
              <Input id="doc" type="text" inputMode="numeric" value={doc} onChange={handleDocChange} placeholder={docPlaceholder} maxLength={docMaxLen} required disabled={isLoading} autoComplete="username" className="h-12 text-base" style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }} />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Senha</label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={512} required disabled={isLoading} className="h-12 text-base" />
            </div>
            {message && <p role="status" className="rounded-xl border p-3 text-sm leading-relaxed" style={{ color: clienteColors.textMuted }}>{message} A senha temporária é válida até o primeiro uso.</p>}
          </>}

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
            {isLoading ? 'Aguarde...' : setupToken ? 'Salvar senha e continuar' : 'Entrar'}
          </Button>

          {!setupToken && <button type="button" className="w-full text-center text-sm underline" disabled={isLoading || !isOnline || remaining > 0} onClick={() => void submit('request')}>
            {remaining ? `Solicitar outra senha em ${remaining}s` : 'Primeiro acesso ou esqueci minha senha'}
          </button>}
          <p className="text-center text-sm leading-relaxed" style={{ color: clienteColors.textMuted }}>
            {setupToken ? 'Se esta etapa expirar, solicite uma nova senha temporária na tela de acesso.' : 'Entre com seu documento e sua senha. No primeiro acesso, use a senha temporária enviada ao e-mail cadastrado.'}
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
