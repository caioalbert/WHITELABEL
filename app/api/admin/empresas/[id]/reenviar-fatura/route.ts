import { loadAdminEmpresa, type EmpresaRouteContext } from '@/lib/admin-empresa'
import { getAsaasPayment, listAsaasSubscriptionPayments } from '@/lib/asaas'
import { isValidEmail } from '@/lib/utils'
import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
export async function POST(request: NextRequest, context: EmpresaRouteContext) {
 try {
  const loaded = await loadAdminEmpresa(request, context)
  if (loaded.response) return loaded.response
  const { empresa } = loaded
  const body = await request.json().catch(() => null)
  if (!body?.paymentId || typeof body.paymentId !== 'string') return NextResponse.json({ error: 'Selecione a fatura.' }, { status: 400 })
  const recurring = body.paymentId !== empresa.asaas_payment_id && empresa.asaas_subscription_id && !empresa.asaas_subscription_id.startsWith('LOCK:') ? await listAsaasSubscriptionPayments(empresa.asaas_subscription_id) : []
  if (body.paymentId !== empresa.asaas_payment_id && !recurring.some(p => p.id === body.paymentId)) return NextResponse.json({ error: 'Fatura não pertence a esta empresa.' }, { status: 404 })
  const payment = await getAsaasPayment(body.paymentId)
  if (!empresa.asaas_customer_id || payment.customer !== empresa.asaas_customer_id) return NextResponse.json({ error: 'Cliente da fatura não corresponde à empresa.' }, { status: 409 })
  if (!['PENDING', 'OVERDUE'].includes(payment.status || '')) return NextResponse.json({ error: 'Somente faturas em aberto podem ser reenviadas.' }, { status: 409 })
  const url = payment.invoiceUrl || payment.bankSlipUrl
  if (!url || !isValidEmail(empresa.email)) return NextResponse.json({ error: 'Fatura sem link ou e-mail da empresa inválido.' }, { status: 409 })
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return NextResponse.json({ error: 'Configure RESEND_API_KEY e RESEND_FROM_EMAIL para enviar faturas.' }, { status: 503 })
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
   from: process.env.RESEND_FROM_EMAIL, to: empresa.email,
   subject: 'Fatura empresarial - Nova Aliança Saúde',
   text: `Olá, ${empresa.responsavel_nome}.\n\nSegue a fatura de ${empresa.razao_social}.\nValor: ${Number(payment.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\nVencimento: ${payment.dueDate?.split('-').reverse().join('/')}\n\nAcesse: ${url}\n\nNova Aliança Saúde`,
  })
  if (error) throw error
  return NextResponse.json({ success: true, message: `Fatura enviada para ${empresa.email}.` })
 } catch (error) { console.error('Reenvio fatura:', error); return NextResponse.json({ error: 'Não foi possível enviar a fatura. Tente novamente.' }, { status: 502 }) }
}
