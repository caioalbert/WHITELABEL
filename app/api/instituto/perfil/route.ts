import { createAdminClient } from '@/lib/supabase/admin'
import { requireInstitutoAuth } from '@/lib/supabase/instituto-auth'
import { isValidEmail } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

function isConnectivityIssue(details: string) {
  return /fetch failed|enotfound|getaddrinfo|network/i.test(details)
}

function isInstitutosSchemaIssue(details: string) {
  return /relation .*institutos|does not exist|42P01|column .*instituto_id|auth_user_id/i.test(details)
}

export async function GET(request: NextRequest) {
  const authResult = await requireInstitutoAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const supabase = createAdminClient()

    const { data: instituto, error: institutoError } = await supabase
      .from('institutos')
      .select('id, nome, email, codigo_indicacao, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max, created_at, updated_at')
      .eq('id', authResult.institutoId)
      .maybeSingle()

    if (institutoError) {
      const details = `${institutoError.message || ''} ${institutoError.details || ''}`
      if (isInstitutosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar instituto.' }, { status: 500 })
    }

    if (!instituto || instituto.ativo !== true) {
      return NextResponse.json({ error: 'Instituto inativo ou não encontrado.' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      instituto: {
        id: instituto.id,
        nome: instituto.nome,
        email: instituto.email,
        codigoIndicacao: instituto.codigo_indicacao,
        ativo: instituto.ativo,
        comissaoPercentualMensalidade: instituto.comissao_percentual_mensalidade,
        comissaoMensalidadesMax: instituto.comissao_mensalidades_max,
      },
    })
  } catch (error) {
    console.error('Instituto perfil GET error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireInstitutoAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          nome?: unknown
          email?: unknown
          senha?: unknown
          comissaoPercentualMensalidade?: unknown
          comissaoMensalidadesMax?: unknown
        }
      | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const hasNome = Object.prototype.hasOwnProperty.call(body, 'nome')
    const hasEmail = Object.prototype.hasOwnProperty.call(body, 'email')
    const hasSenha = Object.prototype.hasOwnProperty.call(body, 'senha')
    const hasComissaoPercentual = Object.prototype.hasOwnProperty.call(body, 'comissaoPercentualMensalidade')
    const hasComissaoMax = Object.prototype.hasOwnProperty.call(body, 'comissaoMensalidadesMax')

    if (!hasNome && !hasEmail && !hasSenha && !hasComissaoPercentual && !hasComissaoMax) {
      return NextResponse.json({ error: 'Nenhum dado de atualização foi enviado.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: institutoAtual, error: institutoAtualError } = await supabase
      .from('institutos')
      .select('id, nome, email, codigo_indicacao, auth_user_id, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max')
      .eq('id', authResult.institutoId)
      .maybeSingle()

    if (institutoAtualError) {
      const details = `${institutoAtualError.message || ''} ${institutoAtualError.details || ''}`
      if (isInstitutosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar instituto.' }, { status: 500 })
    }

    if (!institutoAtual || institutoAtual.ativo !== true) {
      return NextResponse.json({ error: 'Instituto inativo ou não encontrado.' }, { status: 403 })
    }

    const nome = hasNome ? String(body.nome || '').trim() : institutoAtual.nome
    const email = hasEmail ? String(body.email || '').trim().toLowerCase() : institutoAtual.email
    const senha = hasSenha ? String(body.senha || '').trim() : ''

    if (!nome) {
      return NextResponse.json({ error: 'Nome do instituto é obrigatório.' }, { status: 400 })
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email do instituto inválido.' }, { status: 400 })
    }

    if (senha && senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 })
    }

    if (senha && !institutoAtual.auth_user_id) {
      return NextResponse.json(
        { error: 'Usuário sem vínculo de autenticação para alteração de senha.' },
        { status: 400 }
      )
    }

    if (institutoAtual.auth_user_id && (email !== institutoAtual.email || senha)) {
      const authPayload: { email?: string; password?: string } = {}
      if (email !== institutoAtual.email) {
        authPayload.email = email
      }
      if (senha) {
        authPayload.password = senha
      }

      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        institutoAtual.auth_user_id,
        authPayload
      )

      if (authUpdateError) {
        const details = `${authUpdateError.message || ''} ${authUpdateError.status || ''}`
        if (/already registered|already exists|already been registered|duplicate/i.test(details)) {
          return NextResponse.json(
            { error: 'Já existe usuário autenticado com este email.' },
            { status: 409 }
          )
        }

        if (isConnectivityIssue(details)) {
          return NextResponse.json(
            {
              error:
                'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
            },
            { status: 503 }
          )
        }

        return NextResponse.json(
          { error: 'Erro ao atualizar credenciais de acesso.' },
          { status: 500 }
        )
      }
    }

    const updateData: Record<string, unknown> = { nome, email }

    if (hasComissaoPercentual) {
      updateData.comissao_percentual_mensalidade = Number(body.comissaoPercentualMensalidade)
    }

    if (hasComissaoMax) {
      updateData.comissao_mensalidades_max =
        body.comissaoMensalidadesMax === null || body.comissaoMensalidadesMax === ''
          ? null
          : Number(body.comissaoMensalidadesMax)
    }

    const { data: institutoAtualizado, error: updateError } = await supabase
      .from('institutos')
      .update(updateData)
      .eq('id', institutoAtual.id)
      .select('id, nome, email, codigo_indicacao, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max, created_at, updated_at')
      .maybeSingle()

    if (updateError) {
      const details = `${updateError.message || ''} ${updateError.details || ''}`
      if (isInstitutosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao atualizar cadastro do instituto.' }, { status: 500 })
    }

    if (!institutoAtualizado) {
      return NextResponse.json({ error: 'Instituto não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      instituto: {
        id: institutoAtualizado.id,
        nome: institutoAtualizado.nome,
        email: institutoAtualizado.email,
        codigoIndicacao: institutoAtualizado.codigo_indicacao,
        ativo: institutoAtualizado.ativo,
        comissaoPercentualMensalidade: institutoAtualizado.comissao_percentual_mensalidade,
        comissaoMensalidadesMax: institutoAtualizado.comissao_mensalidades_max,
      },
      message: 'Seu cadastro foi atualizado com sucesso.',
    })
  } catch (error) {
    console.error('Instituto perfil PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
