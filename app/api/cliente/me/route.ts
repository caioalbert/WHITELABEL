import { requireActiveClienteAuth } from '@/lib/supabase/cliente-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type CadastroClienteRecord = {
  id: string
  status: string
  tipo_plano: string
  empresa_id?: string | null
  nome?: string | null
  email?: string | null
  telefone?: string | null
  data_nascimento?: string | null
  sexo?: string | null
  [key: string]: unknown
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveClienteAuth(request)

    const supabase = createAdminClient()
    const cadastroResult = auth.tipo === 'dependente'
      ? await supabase
          .from('cadastros')
          .select('id, status, tipo_plano, empresa_id')
          .eq('id', auth.clienteId)
          .single()
      : await supabase
          .from('cadastros')
          .select('*, dependentes (*)')
          .eq('id', auth.clienteId)
          .single()

    const cadastro = cadastroResult.data as CadastroClienteRecord | null
    const error = cadastroResult.error

    if (error || !cadastro) {
      return NextResponse.json(
        { error: 'Cadastro não encontrado.' },
        { status: 404 }
      )
    }

    let usuario = {
      id: auth.clienteId,
      cadastroId: auth.clienteId,
      tipo: auth.tipo,
      nome: auth.nome,
      email: auth.email || cadastro.email || null,
      cpf: auth.cpf,
      telefone: cadastro.telefone || null,
      data_nascimento: cadastro.data_nascimento || null,
      relacao: null as string | null,
      sexo: cadastro.sexo || null,
    }

    if (auth.tipo === 'dependente') {
      if (!auth.dependenteId) {
        return NextResponse.json({ error: 'Dependente não identificado.' }, { status: 404 })
      }

      const { data: dependente, error: dependenteError } = await supabase
        .from('dependentes')
        .select('id, nome, cpf, email, telefone_celular, data_nascimento, relacao, sexo')
        .eq('id', auth.dependenteId)
        .eq('cadastro_id', auth.clienteId)
        .single()

      if (dependenteError || !dependente) {
        return NextResponse.json({ error: 'Dependente não encontrado.' }, { status: 404 })
      }

      usuario = {
        id: dependente.id,
        cadastroId: auth.clienteId,
        tipo: 'dependente',
        nome: dependente.nome,
        email: dependente.email || null,
        cpf: dependente.cpf,
        telefone: dependente.telefone_celular || null,
        data_nascimento: dependente.data_nascimento || null,
        relacao: dependente.relacao || null,
        sexo: dependente.sexo || null,
      }

    }

    const cadastroResposta = auth.tipo === 'dependente'
      ? {
          id: cadastro.id,
          nome: usuario.nome,
          status: cadastro.status,
          tipo_plano: cadastro.tipo_plano,
          empresa_id: cadastro.empresa_id || null,
          dependentes: [],
        }
      : cadastro

    return NextResponse.json({
      cadastro: cadastroResposta,
      usuario,
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
    const auth = await requireActiveClienteAuth(request)

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
