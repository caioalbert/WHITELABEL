'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CadastroForm } from '@/components/cadastro/CadastroForm'
import { CadastroSuccess } from '@/components/cadastro/CadastroSuccess'
import { usePublicBranding } from '@/hooks/use-public-branding'

type CadastroPageClientProps = {
  initialVendedorRef?: string
  initialPlanoCode?: string
}

type CadastroPagamento = {
  id: string
  valor: number
  vencimento: string
  billingType?: string
  invoiceUrl?: string | null
  bankSlipUrl?: string | null
  pixCopiaECola?: string | null
  qrCodeBase64?: string | null
}

function ReferralNotFoundPage({
  tipo,
  message,
}: {
  tipo: 'vendedor' | 'instituto'
  message: string | null
}) {
  const isInstituto = tipo === 'instituto'

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 px-5 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
        <section className="w-full rounded-2xl border border-white/70 bg-white/90 px-6 py-10 text-center shadow-lg backdrop-blur sm:px-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-200 bg-red-50">
            <SearchX className="h-8 w-8 text-red-600" aria-hidden="true" />
          </div>

          <p className="mt-8 text-sm font-bold uppercase text-red-600">404</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
            {isInstituto ? 'Instituto não encontrado' : 'Link de indicação não encontrado'}
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">
            {isInstituto
              ? 'Este link de cadastro aponta para um instituto que não existe mais ou está inativo.'
              : 'Este link de cadastro não está disponível ou foi desativado.'}
          </p>

          {message && (
            <p className="mx-auto mt-4 max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {message}
            </p>
          )}

          <div className="mt-8 flex justify-center">
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Voltar ao início
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function CadastroPageClient({
  initialVendedorRef = '',
  initialPlanoCode = '',
}: CadastroPageClientProps) {
  const branding = usePublicBranding()
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [cadastroData, setCadastroData] = useState<{
    nome: string
    email: string
    id: string
    status?: string
    pagamento?: CadastroPagamento
  } | null>(null)
  const vendedorRef = initialVendedorRef.trim().toUpperCase()
  const expectedConsultorTipo: 'vendedor' | 'instituto' = vendedorRef.startsWith('INSTITUTO-')
    ? 'instituto'
    : 'vendedor'
  const [consultorNome, setConsultorNome] = useState<string | null>(null)
  const [consultorTipo, setConsultorTipo] = useState<'vendedor' | 'instituto'>(expectedConsultorTipo)
  const [consultorStatusMessage, setConsultorStatusMessage] = useState<string | null>(null)
  const [isLoadingConsultor, setIsLoadingConsultor] = useState(Boolean(vendedorRef))
  const shouldValidateRef = Boolean(vendedorRef)
  const isInvalidRef = shouldValidateRef && !isLoadingConsultor && !consultorNome && Boolean(consultorStatusMessage)
  const canShowForm = !shouldValidateRef || Boolean(consultorNome)

  useEffect(() => {
    let active = true

    if (!vendedorRef) {
      setConsultorNome(null)
      setConsultorTipo(expectedConsultorTipo)
      setConsultorStatusMessage(null)
      setIsLoadingConsultor(false)
      return () => {
        active = false
      }
    }

    const fetchConsultor = async () => {
      try {
        setIsLoadingConsultor(true)
        setConsultorNome(null)
        setConsultorTipo(expectedConsultorTipo)
        setConsultorStatusMessage(null)

        const response = await fetch(`/api/cadastro/vendedor?ref=${encodeURIComponent(vendedorRef)}`, {
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => null)

        if (!active) return

        if (!response.ok) {
          setConsultorStatusMessage(payload?.error || 'Consultor não encontrado para este link.')
          return
        }

        const nome = String(payload?.vendedor?.nome || '').trim()
        const tipo = String(payload?.tipo || 'vendedor')
        if (nome) {
          setConsultorNome(nome)
          setConsultorTipo(tipo as 'vendedor' | 'instituto')
          return
        }

        setConsultorStatusMessage('Consultor não encontrado para este link.')
      } catch {
        if (!active) return
        setConsultorStatusMessage('Não foi possível validar o consultor agora.')
      } finally {
        if (active) {
          setIsLoadingConsultor(false)
        }
      }
    }

    fetchConsultor()

    return () => {
      active = false
    }
  }, [expectedConsultorTipo, vendedorRef])

  const handleSuccess = useCallback((data: any) => {
    setCadastroData({
      nome: data.nome,
      email: data.email,
      id: data.id,
      status: data.status,
      pagamento: data.pagamento,
    })
    setIsSubmitted(true)
  }, [])

  if (isSubmitted && cadastroData) {
    return <CadastroSuccess data={cadastroData} />
  }

  if (isInvalidRef) {
    return (
      <ReferralNotFoundPage
        tipo={expectedConsultorTipo}
        message={consultorStatusMessage}
      />
    )
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 px-5 py-10">
      <div className="mx-auto w-full">
        <section className="mb-8 w-full rounded-2xl border border-white/60 bg-white/70 px-6 py-8 shadow-sm backdrop-blur sm:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {consultorTipo === 'instituto' && consultorNome
              ? `Cadastro Instituto ${consultorNome}`
              : expectedConsultorTipo === 'instituto'
                ? 'Cadastro Instituto'
                : `Cadastro ${branding.brandName}`}
          </h1>
          <p className="mt-2 text-gray-600">Preencha seus dados para adesão ao serviço</p>
          {vendedorRef && (
            <div className={`mt-4 rounded-lg border px-3 py-2 ${
              isInvalidRef
                ? 'border-red-200 bg-red-50'
                : 'border-blue-200 bg-blue-50'
            }`}>
              <p className={`text-sm font-semibold ${
                isInvalidRef ? 'text-red-900' : 'text-blue-900'
              }`}>
                {expectedConsultorTipo === 'instituto' ? 'Parceiro' : 'Consultor'}:{' '}
                {isLoadingConsultor ? 'Carregando...' : consultorNome || 'Não identificado'}
              </p>
              {expectedConsultorTipo !== 'instituto' && (
                <p className={`text-xs ${isInvalidRef ? 'text-red-700' : 'text-blue-700'}`}>
                  Código de indicação: {vendedorRef}
                </p>
              )}
              {!isLoadingConsultor && !consultorNome && consultorStatusMessage && (
                <p className={`text-xs ${isInvalidRef ? 'text-red-700' : 'text-blue-700'}`}>
                  {consultorStatusMessage}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="w-full rounded-2xl border border-white/60 bg-white/80 px-6 py-8 shadow-sm backdrop-blur sm:px-8">
          {isLoadingConsultor ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">Validando link de indicação...</p>
            </div>
          ) : isInvalidRef ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
              <p className="text-sm font-semibold text-red-900">Link de indicação inválido</p>
              <p className="mt-1 text-sm text-red-700">
                {consultorStatusMessage || 'Este link não está disponível para cadastro.'}
              </p>
            </div>
          ) : canShowForm ? (
            <CadastroForm
              onSuccess={handleSuccess}
              initialVendedorRef={vendedorRef}
              initialPlanoCode={initialPlanoCode}
              isInstituto={consultorTipo === 'instituto'}
            />
          ) : null}
        </section>
      </div>
    </main>
  )
}
