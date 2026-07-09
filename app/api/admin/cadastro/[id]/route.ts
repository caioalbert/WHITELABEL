import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { isValidCPF } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

async function getValidatedId(context: RouteContext) {
  const { id } = await context.params

  if (!id) {
    return null
  }

  return id
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const id = await getValidatedId(context)
    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Buscar cadastro
    const { data: cadastro, error: cadastroError } = await supabase
      .from('cadastros')
      .select('*')
      .eq('id', id)
      .single()

    if (cadastroError) {
      console.error('Cadastro error:', cadastroError)
      if (cadastroError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Cliente não encontrado' },
          { status: 404 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar cliente' }, { status: 500 })
    }

    // Buscar dependentes
    const { data: dependentes, error: dependentesError } = await supabase
      .from('dependentes')
      .select('*')
      .eq('cadastro_id', id)
      .order('created_at', { ascending: false })

    if (dependentesError) {
      console.error('Dependentes error:', dependentesError)
    }

    return NextResponse.json({
      success: true,
      cadastro,
      dependentes: dependentes || [],
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const id = await getValidatedId(context)
    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const toValue = (value: unknown) =>
      typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()

    const nome = toValue(body.nome)
    const email = toValue(body.email)
    const cpf = toValue(body.cpf)
    const rg = toValue(body.rg)
    const data_nascimento = toValue(body.data_nascimento)
    const telefone = toValue(body.telefone)
    const sexo = toValue(body.sexo)
    const estado_civil = toValue(body.estado_civil)
    const nome_conjuge = toValue(body.nome_conjuge)
    const escolaridade = toValue(body.escolaridade)
    const endereco = toValue(body.endereco)
    const numero = toValue(body.numero)
    const complemento = toValue(body.complemento)
    const bairro = toValue(body.bairro)
    const cidade = toValue(body.cidade)
    const estado = toValue(body.estado)
    const cep = toValue(body.cep)

    if (
      !nome ||
      !email ||
      !cpf ||
      !rg ||
      !data_nascimento ||
      !telefone ||
      !sexo ||
      !estado_civil ||
      !escolaridade ||
      !endereco ||
      !numero ||
      !bairro ||
      !cidade ||
      !estado ||
      !cep
    ) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400 })
    }

    if (estado_civil === 'Casado(a)' && !nome_conjuge) {
      return NextResponse.json(
        { error: 'Nome do cônjuge é obrigatório para estado civil casado(a).' },
        { status: 400 }
      )
    }

    if (!isValidCPF(cpf)) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('cadastros')
      .update({
        nome,
        email,
        cpf,
        rg,
        data_nascimento,
        telefone,
        sexo,
        estado_civil,
        nome_conjuge: nome_conjuge || null,
        escolaridade,
        endereco,
        numero,
        complemento: complemento || null,
        bairro,
        cidade,
        estado,
        cep,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Patch cadastro error:', error)
      return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 })
    }

    return NextResponse.json({ success: true, cadastro: data })
  } catch (error) {
    console.error('PATCH cadastro API error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const id = await getValidatedId(context)
    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('cadastros').delete().eq('id', id)

    if (error) {
      console.error('Delete cadastro error:', error)
      return NextResponse.json({ error: 'Erro ao excluir cliente' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE cadastro API error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição' }, { status: 500 })
  }
}
