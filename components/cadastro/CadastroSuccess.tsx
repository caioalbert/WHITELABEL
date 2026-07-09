'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'

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

interface CadastroSuccessProps {
  data: {
    nome: string
    email: string
    id: string
    status?: string
    pagamento?: CadastroPagamento
  }
}

export function CadastroSuccess({ data }: CadastroSuccessProps) {
  const [status, setStatus] = useState(data.status || 'ATIVO')
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isAutoChecking, setIsAutoChecking] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const isPendingPayment = status === 'PENDENTE_PAGAMENTO' && Boolean(data.pagamento)
  const isCreditCardPayment = data.pagamento?.billingType === 'CREDIT_CARD'
  const paymentMethodLabel = isCreditCardPayment ? 'Cartão de Crédito' : 'BolePIX'
  const invoiceUrl = data.pagamento?.invoiceUrl || null
  const bankSlipUrl = data.pagamento?.bankSlipUrl || null
  const pixCopiaECola = String(data.pagamento?.pixCopiaECola || '').trim()
  const qrCodeBase64 = String(data.pagamento?.qrCodeBase64 || '').trim()
  const hasLegacyPixData = Boolean(pixCopiaECola && qrCodeBase64)

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const formatDate = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('pt-BR')
  }

  const handleCopyPixCode = async () => {
    if (!pixCopiaECola) return

    try {
      await navigator.clipboard.writeText(pixCopiaECola)
      setCopyMessage('Código PIX copiado.')
    } catch {
      setCopyMessage('Não foi possível copiar automaticamente. Copie manualmente o código acima.')
    }
  }

  const checkStatus = useCallback(async (options?: { manual?: boolean }) => {
    const isManual = options?.manual === true
    try {
      if (isManual) {
        setIsCheckingStatus(true)
      } else {
        setIsAutoChecking(true)
      }

      const response = await fetch(`/api/cadastro/status?id=${encodeURIComponent(data.id)}`, {
        cache: 'no-store',
      })

      const payload = (await response.json().catch(() => null)) as {
        status?: string
        error?: string
        processingPayment?: boolean
        asaasPaymentStatus?: string | null
      } | null
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível verificar o status do pagamento.')
      }

      const nextStatus = payload?.status || 'PENDENTE_PAGAMENTO'
      const processingPayment = Boolean(payload?.processingPayment)
      setStatus(nextStatus)
      setIsProcessingPayment(processingPayment)
      setLastCheckAt(new Date().toLocaleTimeString('pt-BR'))

      if (nextStatus === 'ATIVO') {
        setStatusMessage('Pagamento confirmado. Seu cadastro foi ativado.')
        return
      }

      if (processingPayment) {
        setStatusMessage('Pagamento identificado. Estamos processando a ativação do seu plano.')
        return
      }

      if (isManual) {
        setStatusMessage('Pagamento ainda não foi confirmado. Seguiremos verificando automaticamente.')
      } else {
        setStatusMessage('Aguardando confirmação automática do pagamento.')
      }
    } catch (error) {
      if (isManual) {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : 'Erro ao verificar status do pagamento.'
        )
      }
    } finally {
      if (isManual) {
        setIsCheckingStatus(false)
      } else {
        setIsAutoChecking(false)
      }
    }
  }, [data.id])

  const handleCheckStatus = async () => {
    await checkStatus({ manual: true })
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!isPendingPayment) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const scheduleNext = () => {
      timeoutId = setTimeout(async () => {
        if (!mountedRef.current) return
        await checkStatus({ manual: false })
        if (mountedRef.current && status === 'PENDENTE_PAGAMENTO') {
          scheduleNext()
        }
      }, 5000)
    }

    setStatusMessage('Aguardando confirmação automática do pagamento.')
    checkStatus({ manual: false }).finally(() => {
      if (mountedRef.current && status === 'PENDENTE_PAGAMENTO') {
        scheduleNext()
      }
    })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [checkStatus, isPendingPayment, status])

  if (isPendingPayment && data.pagamento) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl w-full">
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-10 sm:px-8 text-center">
              <h1 className="text-3xl font-bold text-white">Pagamento da Adesão</h1>
              <p className="text-amber-100 mt-2">Seu cadastro foi recebido e está pendente de pagamento</p>
            </div>

            <div className="px-6 py-8 sm:px-8 space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-amber-900">
                  <strong>{data.nome}</strong>
                </p>
                <p className="text-sm text-amber-900">{data.email}</p>
                <p className="text-xs font-mono text-amber-800">Cadastro: {data.id}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Valor da adesão</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(data.pagamento.valor)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Vencimento</p>
                  <p className="text-lg font-semibold text-gray-900">{formatDate(data.pagamento.vencimento)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Forma de pagamento selecionada</p>
                <p className="text-base font-semibold text-gray-900">{paymentMethodLabel}</p>
                <p className="text-sm text-gray-700">
                  {isCreditCardPayment
                    ? 'Pague a adesão com cartão na fatura. A assinatura mensal seguirá o mesmo método.'
                    : 'Pague a fatura por boleto ou Pix (BolePIX). A assinatura mensal seguirá o mesmo método.'}
                </p>

                <div className="flex flex-col gap-2">
                  {invoiceUrl && (
                    <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700">
                      <a href={invoiceUrl} target="_blank" rel="noreferrer">
                        {isCreditCardPayment ? 'Adicionar dados do cartão' : 'Abrir Fatura'}
                      </a>
                    </Button>
                  )}

                  {bankSlipUrl && bankSlipUrl !== invoiceUrl && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={bankSlipUrl} target="_blank" rel="noreferrer">
                        Abrir Boleto
                      </a>
                    </Button>
                  )}
                </div>

                {!invoiceUrl && !bankSlipUrl && (
                  <p className="text-xs text-amber-700">
                    A fatura ainda está sendo processada. Clique em verificar para atualizar o status.
                  </p>
                )}
              </div>

              {hasLegacyPixData && (
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Opção PIX (legado)</p>
                  <div className="flex justify-center">
                    <Image
                      src={`data:image/png;base64,${qrCodeBase64}`}
                      alt="QR Code PIX da adesão"
                      className="h-56 w-56 rounded-lg border border-gray-200"
                      width={224}
                      height={224}
                      unoptimized
                    />
                  </div>
                  <textarea
                    readOnly
                    value={pixCopiaECola}
                    className="w-full h-24 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800"
                  />
                  <Button onClick={handleCopyPixCode} variant="outline" className="w-full">
                    Copiar Código PIX
                  </Button>
                  {copyMessage && (
                    <p className="text-xs text-gray-600">{copyMessage}</p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus || isAutoChecking}
                  className="w-full bg-gray-800 hover:bg-gray-900"
                >
                  {isCheckingStatus || isAutoChecking ? 'Verificando pagamento...' : 'Verificar Agora'}
                </Button>
                {statusMessage && (
                  <p className="text-sm text-gray-700">{statusMessage}</p>
                )}
                {lastCheckAt && (
                  <p className="text-xs text-gray-500">Última verificação: {lastCheckAt}</p>
                )}
              </div>

              {isProcessingPayment ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm text-emerald-900">
                    Pagamento identificado. Estamos processando a ativação do seu plano agora.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    O plano será ativado automaticamente após a confirmação do pagamento no Asaas.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Link href="/" className="w-full">
                  <Button variant="outline" className="w-full">
                    Voltar para Início
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-12 sm:px-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white">Cadastro Realizado!</h1>
            <p className="text-green-100 mt-2">Pagamento confirmado e adesão ativada</p>
          </div>

          <div className="px-6 py-8 sm:px-8 space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-green-700 font-semibold">Nome</p>
                <p className="text-lg font-medium text-gray-800">{data.nome}</p>
              </div>
              <div>
                <p className="text-xs text-green-700 font-semibold">Email</p>
                <p className="text-lg font-medium text-gray-800">{data.email}</p>
              </div>
              <div>
                <p className="text-xs text-green-700 font-semibold">ID do Cadastro</p>
                <p className="text-sm font-mono text-gray-800">{data.id}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start space-x-3">
                <svg
                  className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Seu termo de adesão foi gerado e salvo com segurança</span>
              </div>
              <div className="flex items-start space-x-3">
                <svg
                  className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Você receberá um email em breve com seu termo em PDF</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Próximos passos:</strong> Verifique seu email para receber e acessar seu
                termo de adesão.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/login" className="w-full">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                  Fazer login na minha conta
                </Button>
              </Link>
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full">
                  Voltar para Início
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
