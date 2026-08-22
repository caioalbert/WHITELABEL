import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/parceiros/[id]/planos — list parceiro's own plans
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: parceiroId } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('parceiro_planos')
    .select('*')
    .eq('parceiro_id', parceiroId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    const details = `${error.message} ${error.details || ''}`
    if (/relation.*parceiro_planos|does not exist|42P01/i.test(details)) {
      return NextResponse.json(
        { error: 'Banco desatualizado. Execute scripts/017_parceiro_own_plans.sql no Supabase.' },
        { status: 500 }
      )
    }
    console.error('parceiro_planos GET error:', error)
    return NextResponse.json({ error: 'Erro ao carregar planos do parceiro.' }, { status: 500 })
  }

  return NextResponse.json({ planos: data || [] })
}

// POST /api/admin/parceiros/[id]/planos — create a new plan for this parceiro
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: parceiroId } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const nome = String(body.nome || '').trim()
  const descricao = String(body.descricao || '').trim()
  const valor = Number(body.valor)
  const permiteDependentes = Boolean(body.permiteDependentes)
  const dependentesMinimos = permiteDependentes ? Math.max(0, Number(body.dependentesMinimos) || 0) : 0
  const maxDependentes = permiteDependentes && body.maxDependentes != null ? Number(body.maxDependentes) : null
  const valorDependenteAdicional = permiteDependentes ? Math.max(0, Number(body.valorDependenteAdicional) || 0) : 0
  const ordem = Number(body.ordem) || 0

  if (!nome) return NextResponse.json({ error: 'Nome do plano é obrigatório.' }, { status: 400 })
  if (!Number.isFinite(valor) || valor <= 0) return NextResponse.json({ error: 'Valor do plano deve ser maior que zero.' }, { status: 400 })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('parceiro_planos')
    .insert({
      parceiro_id: parceiroId,
      nome,
      descricao,
      valor,
      permite_dependentes: permiteDependentes,
      dependentes_minimos: dependentesMinimos,
      max_dependentes: maxDependentes,
      valor_dependente_adicional: valorDependenteAdicional,
      ordem,
      ativo: true,
    })
    .select('*')
    .single()

  if (error) {
    console.error('parceiro_planos POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar plano.' }, { status: 500 })
  }

  return NextResponse.json({ plano: data }, { status: 201 })
}
