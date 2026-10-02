import { createAdminClient } from '@/lib/supabase/admin'
import type { PharmacyKind, PharmacyCatalog } from '@/lib/pharmacy-catalog'

export const pharmacyTables = { medicamentos: 'farmacia_popular_medicamentos', lojas: 'farmacia_popular_lojas' } as const
export const pharmacyColumns = { medicamentos: 'id,codigo,dv,nome,indicacao,substancia,ativo', lojas: 'id,codigo,nome,endereco,bairro,cidade,uf,cep,ativo,latitude,longitude' } as const
export async function readPharmacyCatalog(activeOnly: boolean): Promise<PharmacyCatalog> {
  const db = createAdminClient()
  async function read(kind: PharmacyKind) {
    const rows: Record<string, unknown>[] = []
    for (let offset = 0; offset < 10000; offset += 500) {
      let query = db.from(pharmacyTables[kind]).select(pharmacyColumns[kind]).order('nome').order('id').range(offset, offset + 499)
      if (activeOnly) query = query.eq('ativo', true)
      const { data, error } = await query
      if (error) throw new Error('Não foi possível consultar o catálogo da Farmácia Popular.')
      rows.push(...(data || []) as unknown as Record<string, unknown>[])
      if (!data || data.length < 500) return rows
    }
    throw new Error('O catálogo excedeu o limite de consulta.')
  }
  const [medicamentos, lojas] = await Promise.all([read('medicamentos'), read('lojas')])
  return { medicamentos, lojas } as unknown as PharmacyCatalog
}
