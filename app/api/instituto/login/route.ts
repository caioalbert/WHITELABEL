import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

    if (data.user?.user_metadata?.is_instituto !== true) {
      return NextResponse.json({ error: 'Acesso restrito a institutos' }, { status: 403 })
    }

    const institutoId = String(data.user.user_metadata?.instituto_id || '').trim()
    if (!institutoId) {
      return NextResponse.json({ error: 'Usuário sem vínculo de instituto' }, { status: 403 })
    }

    const supabaseAdmin = createAdminClient()
    const { data: instituto, error: institutoError } = await supabaseAdmin
      .from('institutos')
      .select('id, nome, email, codigo_indicacao, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max')
      .eq('id', institutoId)
      .maybeSingle()

    if (institutoError) {
      const details = `${institutoError.message || ''} ${institutoError.details || ''}`
      if (/relation .*institutos|does not exist|42P01|column .*instituto_id/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao validar instituto' }, { status: 500 })
    }

    if (!instituto || instituto.ativo !== true) {
      return NextResponse.json({ error: 'Instituto inativo ou não encontrado' }, { status: 403 })
    }

    const response = NextResponse.json({
      success: true,
      instituto: {
        id: instituto.id,
        nome: instituto.nome,
        email: instituto.email,
        codigoIndicacao: instituto.codigo_indicacao,
        comissaoPercentualMensalidade: instituto.comissao_percentual_mensalidade,
        comissaoMensalidadesMax: instituto.comissao_mensalidades_max,
      },
    })

    if (data.session) {
      response.cookies.set('supabase-instituto-auth-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: data.session.expires_in,
      })
    }

    return response
  } catch (error) {
    console.error('Instituto login error:', error)
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 })
  }
}
