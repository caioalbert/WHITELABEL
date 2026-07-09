'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Info, Lock, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClienteScreenHeader } from '@/components/cliente/screen-header'
import { clienteColors, clienteCopy, clienteRadius } from '@/lib/cliente-ui'

type Payment = {
  id: string
  status?: string
  value?: number
  dueDate?: string
  paymentDate?: string
  clientPaymentDate?: string
  description?: string
  billingType?: string
  invoiceUrl?: string
  bankSlipUrl?: string
}

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pendente', color: '#B45309', bg: '#FEF3C7' },
  OVERDUE: { label: 'Vencido', color: '#B91C1C', bg: '#FEE2E2' },
  RECEIVED: { label: 'Pago', color: '#047857', bg: '#D1FAE5' },
  CONFIRMED: { label: 'Pago', color: '#047857', bg: '#D1FAE5' },
  REFUNDED: { label: 'Reembolsado', color: '#4B5563', bg: '#E5E7EB' },
}

const BILLING_TYPE: Record<string, string> = {
  PIX: 'PIX',
  BOLETO: 'BolePIX',
  CREDIT_CARD: 'Cartão',
}

function isPaidStatus(status?: string) {
  return ['RECEIVED', 'CONFIRMED'].includes(status || '')
}

function formatCurrency(value?: number) {
  if (value == null) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date?: string) {
  return date ? new Date(date).toLocaleDateString('pt-BR') : '-'
}

export default function ClientePagamentos() {
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [adesao, setAdesao] = useState<Payment | null>(null)
  const [adesaoPagoEm, setAdesaoPagoEm] = useState<string | null>(null)
  const [mensalidadeValor, setMensalidadeValor] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [usuarioTipo, setUsuarioTipo] = useState<string | null>(null)

  useEffect(() => {
    fetchPayments()
  }, [])

  useEffect(() => {
    fetch('/api/cliente/me')
      .then((r) => r.json())
      .then((data) => setUsuarioTipo(data.usuario?.tipo || 'titular'))
      .catch(() => setUsuarioTipo('titular'))
  }, [])

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/cliente/pagamentos')

      if (response.status === 401) {
        router.push('/login')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao carregar pagamentos')
        return
      }

      setAdesao(data.adesao || null)
      setAdesaoPagoEm(data.adesao_pago_em || null)
      setMensalidadeValor(data.mensalidade_valor ?? null)
      setPayments(data.payments || [])
      if (data.message && (!data.payments || data.payments.length === 0)) {
        setInfoMessage(data.message)
      }
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setIsLoading(false)
    }
  }

  const paymentsPending = useMemo(
    () => payments.filter((payment) => !isPaidStatus(payment.status)),
    [payments]
  )
  const paymentsPaid = useMemo(
    () => payments.filter((payment) => isPaidStatus(payment.status)),
    [payments]
  )

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: clienteColors.background }}>
        <p style={{ color: clienteColors.textMuted }}>Carregando...</p>
      </div>
    )
  }

  if (usuarioTipo === 'dependente') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: clienteColors.background }}>
        <div
          className="w-full max-w-md border p-8 text-center"
          style={{
            backgroundColor: clienteColors.surface,
            borderColor: clienteColors.border,
            borderRadius: clienteRadius.lg,
          }}
        >
          <Lock className="mx-auto h-12 w-12" style={{ color: clienteColors.border }} />
          <h2 className="mt-3 text-lg font-semibold" style={{ color: clienteColors.text }}>
            Acesso exclusivo do titular
          </h2>
          <p className="mt-2 text-sm" style={{ color: clienteColors.textMuted }}>
            Esta área é restrita ao titular do plano.
          </p>
          <Link href="/cliente/dashboard">
            <Button
              className="mt-4"
              style={{
                backgroundColor: clienteColors.primary,
                color: clienteColors.surface,
                borderRadius: clienteRadius.full,
              }}
            >
              Voltar ao início
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: clienteColors.background }}>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex justify-end">
          <Link href="/cliente/dashboard">
            <Button variant="outline" style={{ borderRadius: clienteRadius.full, borderColor: clienteColors.border }}>
              Voltar
            </Button>
          </Link>
        </div>

        <ClienteScreenHeader
          title={clienteCopy.modules.pagamentos.title}
          subtitle={clienteCopy.modules.pagamentos.subtitle}
        />

        {infoMessage ? (
          <div
            className="mb-4 flex items-start gap-2 border p-4"
            style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: clienteRadius.md }}
          >
            <Info className="mt-0.5 h-5 w-5 shrink-0" style={{ color: clienteColors.accent }} />
            <p className="text-sm leading-5" style={{ color: '#1D4ED8' }}>
              {infoMessage}
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            className="mb-4 border p-4"
            style={{
              borderColor: '#FECACA',
              backgroundColor: '#FEF2F2',
              borderRadius: clienteRadius.md,
              color: clienteColors.danger,
            }}
          >
            <p className="text-sm">{error}</p>
          </div>
        ) : null}

        {!error && !infoMessage && payments.length === 0 && !adesao && !adesaoPagoEm ? (
          <div
            className="border p-8 text-center"
            style={{
              backgroundColor: clienteColors.surface,
              borderColor: clienteColors.border,
              borderRadius: clienteRadius.lg,
            }}
          >
            <ReceiptText className="mx-auto h-12 w-12" style={{ color: clienteColors.border }} />
            <h2 className="mt-3 text-lg font-semibold" style={{ color: clienteColors.text }}>
              Nenhum pagamento encontrado
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: clienteColors.textMuted }}>
              Seus pagamentos aparecerão aqui após confirmação do pagamento de adesão.
            </p>
          </div>
        ) : null}

        {(adesao || adesaoPagoEm) ? (
          <section className="mb-6">
            <p
              className="mb-2 text-xs font-semibold uppercase tracking-[0.08em]"
              style={{ color: clienteColors.textMuted }}
            >
              Adesão
            </p>
            {adesao ? (
              <PaymentCard payment={{ ...adesao, description: 'Pagamento de Adesão' }} />
            ) : (
              <div
                className="border p-4"
                style={{
                  backgroundColor: clienteColors.surface,
                  borderColor: clienteColors.border,
                  borderLeftWidth: '4px',
                  borderLeftColor: clienteColors.success,
                  borderRadius: clienteRadius.md,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: clienteColors.text }}>Pagamento de Adesão</p>
                    <p className="mt-0.5 text-xs" style={{ color: clienteColors.textMuted }}>
                      Pago em: {formatDate(adesaoPagoEm!)}
                    </p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#047857' }}>
                    ✓ Pago
                  </span>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {(() => {
          // Cobranças reais do Asaas
          if (payments.length > 0) {
            return (
              <>
                {paymentsPending.length > 0 ? (
                  <section className="mb-6">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: clienteColors.textMuted }}>Pendentes</p>
                    <div className="space-y-2">
                      {paymentsPending.map((p) => <PaymentCard key={p.id} payment={p} />)}
                    </div>
                  </section>
                ) : null}
                {paymentsPaid.length > 0 ? (
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: clienteColors.textMuted }}>Pagos</p>
                    <div className="space-y-2">
                      {paymentsPaid.map((p) => <PaymentCard key={p.id} payment={p} />)}
                    </div>
                  </section>
                ) : null}
              </>
            )
          }

          // Projeção das 12 parcelas a partir da data de adesão
          const base = adesaoPagoEm
          if (!base) return null
          const [y, m, day] = base.slice(0, 10).split('-').map(Number)
          const nm = m === 12 ? 1 : m + 1
          const ny = m === 12 ? y + 1 : y
          const baseDate = `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const [by, bm, bd] = baseDate.split('-').map(Number)
          const hoje = new Date().toISOString().slice(0, 10)
          const parcelas = Array.from({ length: 12 }, (_, i) => {
            const total = bm - 1 + i
            const yr = by + Math.floor(total / 12)
            const mo = (total % 12) + 1
            return { index: i + 1, dueDate: `${yr}-${String(mo).padStart(2, '0')}-${String(bd).padStart(2, '0')}` }
          })

          return (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: clienteColors.textMuted }}>Mensalidades</p>
              <div className="space-y-2">
                {parcelas.map(({ index, dueDate }) => (
                  <div
                    key={index}
                    className="border p-4"
                    style={{
                      backgroundColor: clienteColors.surface,
                      borderColor: clienteColors.border,
                      borderLeftWidth: '4px',
                      borderLeftColor: dueDate < hoje ? clienteColors.danger : clienteColors.border,
                      borderRadius: clienteRadius.md,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: clienteColors.text }}>Mensalidade {index}/12</p>
                        <p className="mt-0.5 text-xs" style={{ color: clienteColors.textMuted }}>Vencimento: {formatDate(dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-bold" style={{ color: clienteColors.text }}>{formatCurrency(mensalidadeValor ?? adesao?.value)}</p>
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: dueDate < hoje ? '#FEE2E2' : '#F3F4F6', color: dueDate < hoje ? '#B91C1C' : '#6B7280' }}>
                          {dueDate < hoje ? 'Não gerado' : 'Agendado'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })()}
      </main>
    </div>
  )
}

function PaymentCard({ payment }: { payment: Payment }) {
  const isPaid = isPaidStatus(payment.status)
  const status = STATUS_INFO[payment.status || ''] || {
    label: payment.status || 'Desconhecido',
    color: clienteColors.textMuted,
    bg: clienteColors.border,
  }

  return (
    <div
      className="border p-4"
      style={{
        backgroundColor: clienteColors.surface,
        borderColor: clienteColors.border,
        borderLeftWidth: '4px',
        borderLeftColor: isPaid ? clienteColors.success : clienteColors.warning,
        borderRadius: clienteRadius.md,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: clienteColors.text }}>
            {payment.description || 'Mensalidade'}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: clienteColors.textMuted }}>
            {isPaid ? 'Pago em: ' : 'Vencimento: '}
            {formatDate(isPaid ? payment.paymentDate || payment.dueDate : payment.dueDate)}
          </p>
          {payment.billingType ? (
            <p className="mt-0.5 text-xs" style={{ color: clienteColors.textMuted }}>
              {BILLING_TYPE[payment.billingType] || payment.billingType}
            </p>
          ) : null}
        </div>

        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: status.bg, color: status.color }}
        >
          {isPaid ? '✓ ' : ''}
          {status.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-bold" style={{ color: isPaid ? clienteColors.text : clienteColors.primary }}>
          {formatCurrency(payment.value)}
        </p>

        <div className="flex flex-wrap gap-2">
          {payment.invoiceUrl && !isPaid ? (
            <a
              href={payment.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
              style={{ backgroundColor: clienteColors.primary }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pagar agora
            </a>
          ) : null}

          {payment.bankSlipUrl && !isPaid ? (
            <a
              href={payment.bankSlipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
              style={{ borderColor: clienteColors.border, color: clienteColors.text }}
            >
              Ver boleto
            </a>
          ) : null}

          {payment.invoiceUrl && isPaid ? (
            <a
              href={payment.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
              style={{ borderColor: clienteColors.border, color: clienteColors.text }}
            >
              Ver fatura
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
