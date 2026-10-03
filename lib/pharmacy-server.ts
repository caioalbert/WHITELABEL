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

export async function readPharmacyRegionStores(uf: string, city: string) {
  const db = createAdminClient()
  const { data, error } = await db.from(pharmacyTables.lojas).select(pharmacyColumns.lojas).eq('ativo', true).eq('uf', uf).eq('cidade', city).order('nome').order('id').limit(1000)
  if (error) throw new Error('Não foi possível consultar as lojas desta região.')
  if (data && data.length >= 1000) throw new Error('A região excedeu o limite de consulta.')
  return (data || []) as unknown as PharmacyCatalog['lojas']
}
export async function readPharmacyInitialCatalog() {
  const db = createAdminClient()
  const { data: medicamentos, error } = await db.from(pharmacyTables.medicamentos).select(pharmacyColumns.medicamentos).eq('ativo', true).order('nome').order('id').limit(1000)
  if (error) throw new Error('Não foi possível consultar os medicamentos.')
  if (medicamentos && medicamentos.length >= 1000) throw new Error('O catálogo de medicamentos excedeu o limite de consulta.')
  const locations: { uf: string; cidade: string }[] = []
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error: regionError } = await db.from(pharmacyTables.lojas).select('uf,cidade').eq('ativo', true).order('uf').order('cidade').order('id').range(offset, offset + 499)
    if (regionError) throw new Error('Não foi possível consultar as regiões.')
    locations.push(...(data || []))
    if (!data || data.length < 500) break
    if (offset === 9500) throw new Error('O catálogo de regiões excedeu o limite de consulta.')
  }
  const regions = Array.from(new Map(locations.map(row => [`${row.uf}:${row.cidade}`, row])).values())
  return { medicamentos: medicamentos || [], lojas: [], regioes: regions, mapsBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '' }
}
