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

    if (data.user?.user_metadata?.is_vendedor !== true) {
      return NextResponse.json({ error: 'Acesso restrito a vendedores' }, { status: 403 })
    }

    const vendedorId = String(data.user.user_metadata?.vendedor_id || '').trim()
    if (!vendedorId) {
      return NextResponse.json({ error: 'Usuário sem vínculo de vendedor' }, { status: 403 })
    }

    const supabaseAdmin = createAdminClient()
    const { data: vendedor, error: vendedorError } = await supabaseAdmin
      .from('vendedores')
      .select('id, nome, email, codigo_indicacao, ativo')
      .eq('id', vendedorId)
      .maybeSingle()

    if (vendedorError) {
      const details = `${vendedorError.message || ''} ${vendedorError.details || ''}`
      if (/relation .*vendedores|does not exist|42P01|column .*vendedor_id/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/007_add_vendedores_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao validar vendedor' }, { status: 500 })
    }

    if (!vendedor || vendedor.ativo !== true) {
      return NextResponse.json({ error: 'Vendedor inativo ou não encontrado' }, { status: 403 })
    }

    const response = NextResponse.json({
      success: true,
      vendedor: {
        id: vendedor.id,
        nome: vendedor.nome,
        email: vendedor.email,
        codigoIndicacao: vendedor.codigo_indicacao,
      },
    })

    if (data.session) {
      response.cookies.set('supabase-vendedor-auth-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: data.session.expires_in,
      })
    }

    return response
  } catch (error) {
    console.error('Vendedor login error:', error)
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 })
  }
}
