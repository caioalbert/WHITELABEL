import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getParceiroId } from '@/lib/supabase/auth-roles'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const errorMessage = `${error.message || ''} ${error.status || ''}`
      const isConnectivityError =
        error.status === 0 || /fetch failed|enotfound|getaddrinfo|network/i.test(errorMessage)

      if (isConnectivityError) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const parceiroId = getParceiroId(data.user)
    if (!parceiroId) {
      return NextResponse.json({ error: 'Usuário sem vínculo de parceiro' }, { status: 403 })
    }

    const supabaseAdmin = createAdminClient()
    const { data: parceiro, error: parceiroError } = await supabaseAdmin
      .from('parceiros')
      .select('id, nome, email, codigo_indicacao, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max')
      .eq('id', parceiroId)
      .eq('auth_user_id', data.user.id)
      .maybeSingle()

    if (parceiroError) {
      const details = `${parceiroError.message || ''} ${parceiroError.details || ''}`
      if (/relation .*parceiros|does not exist|42P01|column .*parceiro_id/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao validar parceiro' }, { status: 500 })
    }

    if (!parceiro || parceiro.ativo !== true) {
      return NextResponse.json({ error: 'Parceiro inativo ou não encontrado' }, { status: 403 })
    }

    const response = NextResponse.json({
      success: true,
      parceiro: {
        id: parceiro.id,
        nome: parceiro.nome,
        email: parceiro.email,
        codigoIndicacao: parceiro.codigo_indicacao,
        comissaoPercentualMensalidade: parceiro.comissao_percentual_mensalidade,
        comissaoMensalidadesMax: parceiro.comissao_mensalidades_max,
      },
    })

    if (data.session) {
      response.cookies.set('supabase-parceiro-auth-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: data.session.expires_in,
      })
    }

    return response
  } catch (error) {
    console.error('Parceiro login error:', error)
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 })
  }
}
