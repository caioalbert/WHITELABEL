import { loadAdminEmpresa, type EmpresaRouteContext } from '@/lib/admin-empresa'
import { parseBillingSchedule, installmentDueDate } from '@/lib/billing-schedule'
import { getAsaasPayment, getAsaasSubscription, isAsaasPaidStatus, updateAsaasPaymentTerms, updateAsaasSubscriptionTerms } from '@/lib/asaas'
import { NextRequest, NextResponse } from 'next/server'
export async function PATCH(request: NextRequest, context: EmpresaRouteContext) {
 try {
  const loaded = await loadAdminEmpresa(request, context)
  if (loaded.response) return loaded.response
  const { empresa, db } = loaded
  const body = await request.json().catch(() => null)
  const value = Number(body?.mensalidade_valor)
  if (!Number.isFinite(value) || value < 5 || value > 99999999.99) return NextResponse.json({ error: 'Informe uma mensalidade válida a partir de R$ 5,00.' }, { status: 400 })
  const normalizedValue = Math.round(value * 100) / 100
  let schedule
  const started = Boolean(empresa.pagamento_confirmado_em || empresa.asaas_subscription_id || ['ATIVO', 'INATIVO'].includes(empresa.status))
  try { schedule = parseBillingSchedule(body || {}, started ? '0000-01-01' : undefined) } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
  if (started && (schedule.primeira_parcela_vencimento !== empresa.primeira_parcela_vencimento || schedule.contrato_meses !== empresa.contrato_meses)) return NextResponse.json({ error: 'Após a ativação, a primeira parcela e o prazo original são preservados. Edite o valor e o dia das próximas parcelas.' }, { status: 409 })
  if (empresa.asaas_subscription_id?.startsWith('LOCK:')) return NextResponse.json({ error: 'Pagamento em processamento. Aguarde e atualize a página.' }, { status: 409 })
  const subscription = empresa.asaas_subscription_id ? await getAsaasSubscription(empresa.asaas_subscription_id) : null
  const first = !started && empresa.asaas_payment_id ? await getAsaasPayment(empresa.asaas_payment_id) : null
  if ((first && first.customer !== empresa.asaas_customer_id) || (subscription && subscription.customer !== empresa.asaas_customer_id)) return NextResponse.json({ error: 'Cobrança não corresponde ao cliente desta empresa.' }, { status: 409 })
  if (first && (isAsaasPaidStatus(first.status) || !['PENDING', 'OVERDUE'].includes(first.status || ''))) return NextResponse.json({ error: 'A primeira fatura não pode ser alterada nesse status. Atualize a página.' }, { status: 409 })
  if (subscription && (!subscription.nextDueDate || !subscription.value || subscription.status !== 'ACTIVE')) return NextResponse.json({ error: 'Assinatura indisponível para edição. Confira o Asaas.' }, { status: 409 })
  let changedFirst = false; let changedSubscription = false
  try {
   if (first) { await updateAsaasPaymentTerms(first.id, normalizedValue, schedule.primeira_parcela_vencimento); changedFirst = true }
   if (subscription) {
    const next = installmentDueDate(subscription.nextDueDate!, schedule.dia_vencimento, 0)
    if (next < new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })) throw new Error('O novo vencimento cairia no passado. Escolha outro dia.')
    await updateAsaasSubscriptionTerms(subscription.id, normalizedValue, next); changedSubscription = true
   }
   const { data, error } = await db.from('empresas').update({ ...schedule, mensalidade_valor: normalizedValue, valor_por_funcionario: Math.round(normalizedValue / Math.max(1, empresa.quantidade_funcionarios || 1) * 100) / 100 }).eq('id', empresa.id).eq('updated_at', empresa.updated_at).select('id').maybeSingle()
   if (error || !data) throw error || new Error('Empresa alterada em outra sessão. Atualize e tente novamente.')
  } catch (error) {
   let rollbackFailed = false
   if (changedSubscription) await updateAsaasSubscriptionTerms(subscription!.id, subscription!.value!, subscription!.nextDueDate!).catch(() => { rollbackFailed = true })
   if (changedFirst) await updateAsaasPaymentTerms(first!.id, first!.value!, first!.dueDate!).catch(() => { rollbackFailed = true })
   if (rollbackFailed) { console.error('Reconciliar condições empresa:', empresa.id, error); return NextResponse.json({ error: 'Falha ao salvar e restaurar cobrança. Confira as condições no Asaas antes de tentar novamente.' }, { status: 502 }) }
   throw error
  }
  return NextResponse.json({ success: true, message: 'Condições atualizadas. Faturas mensais já emitidas mantêm o valor e vencimento original; as próximas emissões usam as novas condições.' })
 } catch (error) { console.error('Condições empresa:', error); return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível salvar as condições.' }, { status: 502 }) }
}
