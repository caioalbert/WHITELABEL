import { requireClienteAuth } from '@/lib/supabase/cliente-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)

    const supabase = await createClient()
    const { data: cadastro, error } = await supabase
      .from('cadastros')
      .select(`
        *,
        dependentes (*)
      `)
      .eq('id', auth.clienteId)
      .single()

    if (error || !cadastro) {
      return NextResponse.json(
        { error: 'Cadastro não encontrado.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      cadastro,
      usuario: {
        id: auth.dependenteId || auth.clienteId,
        cadastroId: auth.clienteId,
        tipo: auth.tipo,
        nome: auth.nome,
        email: auth.email || cadastro.email || null,
        cpf: auth.cpf,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    console.error('Erro ao buscar dados do cliente:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados.' },
      { status: 500 }
    )
  }
}

const ALLOWED_FIELDS = [
  'nome',
  'email',
  'telefone',
  'endereco',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'cep',
] as const

type AllowedField = (typeof ALLOWED_FIELDS)[number]

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)

    // Somente titular pode editar o cadastro principal
    if (auth.tipo === 'dependente') {
      return NextResponse.json(
        { error: 'Dependentes não podem editar o cadastro principal.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Filtra apenas campos permitidos
    const updates: Partial<Record<AllowedField, string>> = {}
    for (const field of ALLOWED_FIELDS) {
      if (field in body && body[field] !== undefined) {
        const value = String(body[field]).trim()
        if (value !== '') {
          updates[field] = value
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo válido para atualizar.' },
        { status: 400 }
      )
    }

    // Validações básicas
    if (updates.nome && updates.nome.length < 3) {
      return NextResponse.json({ error: 'Nome deve ter ao menos 3 caracteres.' }, { status: 400 })
    }
    if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error: updateError } = await supabase
      .from('cadastros')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', auth.clienteId)

    if (updateError) {
      console.error('Erro ao atualizar cadastro:', updateError)
      return NextResponse.json({ error: 'Erro ao salvar dados.' }, { status: 500 })
    }

    // Retorna dados atualizados
    const { data: cadastro } = await supabase
      .from('cadastros')
      .select('id, nome, email, telefone, endereco, numero, complemento, bairro, cidade, estado, cep')
      .eq('id', auth.clienteId)
      .single()

    return NextResponse.json({ success: true, cadastro })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    console.error('Erro ao atualizar dados do cliente:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
