import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('cadastros')
      .select('id')
      .limit(1)

    if (!error) {
      return NextResponse.json({
        success: true,
        message: 'Banco conectado e tabela "cadastros" disponível.',
      })
    }

    const details = `${error.message || ''} ${error.details || ''}`

    if (error.code === '42P01') {
      return NextResponse.json(
        {
          error:
            'As tabelas ainda não existem. Execute o script scripts/001_create_tables.sql no SQL Editor do Supabase.',
        },
        { status: 400 }
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

    console.error('Database validation error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao validar banco de dados' },
      { status: 500 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (/fetch failed|enotfound|getaddrinfo|network/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        },
        { status: 503 }
      )
    }

    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Erro ao validar banco de dados' },
      { status: 500 }
    )
  }
}
