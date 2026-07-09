import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

type AdminAuthSuccess = {
  ok: true
  token: string
  user: User
}

type AdminAuthFailure = {
  ok: false
  status: 401 | 403 | 503 | 500
  error: string
}

export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure

export async function requireAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
  const token = request.cookies.get('supabase-auth-token')?.value

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

    if (data.user.user_metadata?.is_admin !== true) {
      return {
        ok: false,
        status: 403,
        error: 'Acesso restrito a administradores',
      }
    }

    return {
      ok: true,
      token,
      user: data.user,
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

    console.error('Admin auth validation error:', error)
    return {
      ok: false,
      status: 500,
      error: 'Erro ao validar sessão administrativa',
    }
  }
}
