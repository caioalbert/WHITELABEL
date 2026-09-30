import { loadAdminEmpresa, type EmpresaRouteContext } from '@/lib/admin-empresa'
import { getAsaasPayment, listAsaasSubscriptionPayments } from '@/lib/asaas'
import { NextRequest, NextResponse } from 'next/server'
export async function GET(request: NextRequest, context: EmpresaRouteContext) {
 try {
  const loaded = await loadAdminEmpresa(request, context)
  if (loaded.response) return loaded.response
  const { empresa } = loaded
  const [first, recurring] = await Promise.all([
   empresa.asaas_payment_id ? getAsaasPayment(empresa.asaas_payment_id) : Promise.resolve(null),
   empresa.asaas_subscription_id && !empresa.asaas_subscription_id.startsWith('LOCK:') ? listAsaasSubscriptionPayments(empresa.asaas_subscription_id) : Promise.resolve([]),
  ])
  const payments = Array.from(new Map([...(first ? [first] : []), ...recurring].map(p => [p.id, p])).values())
  return NextResponse.json({ pagamentos: payments })
 } catch (error) { console.error('Faturas empresa:', error); return NextResponse.json({ error: 'Não foi possível consultar as faturas no Asaas. Tente novamente.' }, { status: 502 }) }
}
