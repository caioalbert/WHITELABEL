import { createAdminClient } from '@/lib/supabase/admin'
import { syncCadastroToRapidoc } from '@/lib/rapidoc-sync'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { hasValidCronAuthorization } from '@/lib/rapidoc-sync-auth'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const hasCronAccess = hasValidCronAuthorization(authHeader, process.env.CRON_SECRET)

    if (!hasCronAccess) {
      const adminAuth = await requireAdminAuth(request)
      if (!adminAuth.ok) {
        return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
      }
    }

    const supabase = createAdminClient()

    // Buscar todos os cadastros ATIVOS
    const { data: cadastros, error } = await supabase
      .from('cadastros')
      .select('id, nome, cpf')
      .eq('status', 'ATIVO')

    if (error) {
      throw error
    }

    if (!cadastros || cadastros.length === 0) {
      return NextResponse.json({ message: 'Nenhum cadastro ativo encontrado.' })
    }

    let successCount = 0
    let errorCount = 0
    let totalExported = 0
    const errors = []

    // Processar sequencialmente para não estourar rate limit da Rapidoc
    for (const cadastro of cadastros) {
      try {
        const result = await syncCadastroToRapidoc(cadastro.id)
        if (result.success) {
          successCount++
          totalExported += (result.count || 0)
        } else {
          errorCount++
          errors.push({ id: cadastro.id, nome: cadastro.nome, error: result.error })
        }
      } catch (err) {
        errorCount++
        errors.push({ id: cadastro.id, nome: cadastro.nome, error: String(err) })
      }

      // Delay pequeno para evitar throttling
      await new Promise(r => setTimeout(r, 200))
    }

    return NextResponse.json({
      message: 'Sincronização finalizada.',
      stats: {
        total_verificados: cadastros.length,
        sucessos: successCount,
        erros: errorCount,
        vidas_exportadas: totalExported
      },
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('[Sync Rapidoc API] Erro fatal:', error)
    return NextResponse.json({ error: 'Erro interno ao sincronizar' }, { status: 500 })
  }
}
