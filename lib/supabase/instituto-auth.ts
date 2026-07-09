import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

type InstitutoAuthSuccess = {
  ok: true
  token: string
  user: User
  institutoId: string
}

type InstitutoAuthFailure = {
  ok: false
  status: 401 | 403 | 503 | 500
  error: string
}

export type InstitutoAuthResult = InstitutoAuthSuccess | InstitutoAuthFailure

export async function requireInstitutoAuth(request: NextRequest): Promise<InstitutoAuthResult> {
  const token = request.cookies.get('supabase-instituto-auth-token')?.value

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: 'Não autenticado',
    }
  }

  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !data.user) {
      const details = `${error?.message || ''} ${error?.status || ''}`
      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return {
          ok: false,
          status: 503,
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        }
      }

      return {
        ok: false,
        status: 401,
        error: 'Sessão inválida ou expirada',
      }
    }

    if (data.user.user_metadata?.is_instituto !== true) {
      return {
        ok: false,
        status: 403,
        error: 'Acesso restrito a institutos',
      }
    }

    const institutoId = String(data.user.user_metadata?.instituto_id || '').trim()
    if (!institutoId) {
      return {
        ok: false,
        status: 403,
        error: 'Usuário sem vínculo de instituto',
      }
    }

    const { data: instituto, error: institutoError } = await supabaseAdmin
      .from('institutos')
      .select('id, ativo')
      .eq('id', institutoId)
      .maybeSingle()

    if (institutoError) {
      const details = `${institutoError.message || ''} ${institutoError.details || ''}`
      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return {
          ok: false,
          status: 503,
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        }
      }

      if (/relation .*institutos|does not exist|42P01|column .*instituto_id/i.test(details)) {
        return {
          ok: false,
          status: 500,
          error: 'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
        }
      }

      return {
        ok: false,
        status: 500,
        error: 'Erro ao validar instituto.',
      }
    }

    if (!instituto || instituto.ativo !== true) {
      return {
        ok: false,
        status: 403,
        error: 'Instituto inativo ou não encontrado.',
      }
    }

    return {
      ok: true,
      token,
      user: data.user,
      institutoId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/fetch failed|enotfound|getaddrinfo|network/i.test(message)) {
      return {
        ok: false,
        status: 503,
        error:
          'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
      }
    }

    console.error('Instituto auth validation error:', error)
    return {
      ok: false,
      status: 500,
      error: 'Erro ao validar sessão do instituto',
    }
  }
}
