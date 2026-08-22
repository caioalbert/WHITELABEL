import { createAdminClient } from '@/lib/supabase/admin'
import { requireParceiroAuth } from '@/lib/supabase/parceiro-auth'
import { isValidEmail } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

function isConnectivityIssue(details: string) {
  return /fetch failed|enotfound|getaddrinfo|network/i.test(details)
}

function isParceirosSchemaIssue(details: string) {
  return /relation .*parceiros|does not exist|42P01|column .*parceiro_id|auth_user_id/i.test(details)
}

export async function GET(request: NextRequest) {
  const authResult = await requireParceiroAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const supabase = createAdminClient()

    const { data: parceiro, error: parceiroError } = await supabase
      .from('parceiros')
      .select('id, nome, email, codigo_indicacao, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max, created_at, updated_at')
      .eq('id', authResult.parceiroId)
      .maybeSingle()

    if (parceiroError) {
      const details = `${parceiroError.message || ''} ${parceiroError.details || ''}`
      if (isParceirosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao buscar parceiro.' }, { status: 500 })
    }

    if (!parceiro || parceiro.ativo !== true) {
      return NextResponse.json({ error: 'Parceiro inativo ou não encontrado.' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      parceiro: {
        id: parceiro.id,
        nome: parceiro.nome,
        email: parceiro.email,
        codigoIndicacao: parceiro.codigo_indicacao,
        ativo: parceiro.ativo,
        comissaoPercentualMensalidade: parceiro.comissao_percentual_mensalidade,
        comissaoMensalidadesMax: parceiro.comissao_mensalidades_max,
      },
    })
  } catch (error) {
    console.error('Parceiro perfil GET error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireParceiroAuth(request)
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

    const { data: parceiroAtual, error: parceiroAtualError } = await supabase
      .from('parceiros')
      .select('id, nome, email, codigo_indicacao, auth_user_id, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max')
      .eq('id', authResult.parceiroId)
      .maybeSingle()

    if (parceiroAtualError) {
      const details = `${parceiroAtualError.message || ''} ${parceiroAtualError.details || ''}`
      if (isParceirosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao buscar parceiro.' }, { status: 500 })
    }

    if (!parceiroAtual || parceiroAtual.ativo !== true) {
      return NextResponse.json({ error: 'Parceiro inativo ou não encontrado.' }, { status: 403 })
    }

    const nome = hasNome ? String(body.nome || '').trim() : parceiroAtual.nome
    const email = hasEmail ? String(body.email || '').trim().toLowerCase() : parceiroAtual.email
    const senha = hasSenha ? String(body.senha || '').trim() : ''

    if (!nome) {
      return NextResponse.json({ error: 'Nome do parceiro é obrigatório.' }, { status: 400 })
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email do parceiro inválido.' }, { status: 400 })
    }

    if (senha && senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 })
    }

    if (senha && !parceiroAtual.auth_user_id) {
      return NextResponse.json(
        { error: 'Usuário sem vínculo de autenticação para alteração de senha.' },
        { status: 400 }
      )
    }

    if (parceiroAtual.auth_user_id && (email !== parceiroAtual.email || senha)) {
      const authPayload: { email?: string; password?: string } = {}
      if (email !== parceiroAtual.email) {
        authPayload.email = email
      }
      if (senha) {
        authPayload.password = senha
      }

      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        parceiroAtual.auth_user_id,
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

    const { data: parceiroAtualizado, error: updateError } = await supabase
      .from('parceiros')
      .update(updateData)
      .eq('id', parceiroAtual.id)
      .select('id, nome, email, codigo_indicacao, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max, created_at, updated_at')
      .maybeSingle()

    if (updateError) {
      const details = `${updateError.message || ''} ${updateError.details || ''}`
      if (isParceirosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao atualizar cadastro do parceiro.' }, { status: 500 })
    }

    if (!parceiroAtualizado) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      parceiro: {
        id: parceiroAtualizado.id,
        nome: parceiroAtualizado.nome,
        email: parceiroAtualizado.email,
        codigoIndicacao: parceiroAtualizado.codigo_indicacao,
        ativo: parceiroAtualizado.ativo,
        comissaoPercentualMensalidade: parceiroAtualizado.comissao_percentual_mensalidade,
        comissaoMensalidadesMax: parceiroAtualizado.comissao_mensalidades_max,
      },
      message: 'Seu cadastro foi atualizado com sucesso.',
    })
  } catch (error) {
    console.error('Parceiro perfil PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
