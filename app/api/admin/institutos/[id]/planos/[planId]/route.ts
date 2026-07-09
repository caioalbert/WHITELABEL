import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string; planId: string }> }

// PATCH /api/admin/institutos/[id]/planos/[planId] — update a plan
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: institutoId, planId } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (body.nome !== undefined) updates.nome = String(body.nome).trim()
  if (body.descricao !== undefined) updates.descricao = String(body.descricao).trim()
  if (body.valor !== undefined) {
    const valor = Number(body.valor)
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero.' }, { status: 400 })
    }
    updates.valor = valor
  }
  if (body.permiteDependentes !== undefined) updates.permite_dependentes = Boolean(body.permiteDependentes)
  if (body.dependentesMinimos !== undefined) updates.dependentes_minimos = Math.max(0, Number(body.dependentesMinimos) || 0)
  if (body.maxDependentes !== undefined) updates.max_dependentes = body.maxDependentes != null ? Number(body.maxDependentes) : null
  if (body.valorDependenteAdicional !== undefined) updates.valor_dependente_adicional = Math.max(0, Number(body.valorDependenteAdicional) || 0)
  if (body.ativo !== undefined) updates.ativo = Boolean(body.ativo)
  if (body.ordem !== undefined) updates.ordem = Number(body.ordem) || 0

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('instituto_planos')
    .update(updates)
    .eq('id', planId)
    .eq('instituto_id', institutoId)
    .select('*')
    .single()

  if (error) {
    console.error('instituto_planos PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar plano.' }, { status: 500 })
  }

  return NextResponse.json({ plano: data })
}

// DELETE /api/admin/institutos/[id]/planos/[planId] — remove a plan
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: institutoId, planId } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('instituto_planos')
    .delete()
    .eq('id', planId)
    .eq('instituto_id', institutoId)

  if (error) {
    console.error('instituto_planos DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao excluir plano.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
