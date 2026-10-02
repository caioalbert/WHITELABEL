import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { filterMedicines, filterStores, medicineSchema, storeSchema, pharmacyMapsUrl, type PharmacyCatalog } from '../lib/pharmacy-catalog'
const source = JSON.parse(fs.readFileSync(new URL('../data/farmacia-popular-inicial.json', import.meta.url), 'utf8')) as PharmacyCatalog
describe('Farmácia Popular: fontes e filtros', () => {
  it('preserva os 207 produtos e apenas as 530 lojas Pague Menos da aba principal', () => {
    expect(source.medicamentos).toHaveLength(207); expect(source.lojas).toHaveLength(530)
    for (const m of source.medicamentos) expect(medicineSchema.safeParse(m).success).toBe(true)
    for (const s of source.lojas) expect(storeSchema.safeParse(s).success).toBe(true)
    expect(new Set(source.medicamentos.map(m => `${m.codigo}-${m.dv}`)).size).toBe(207)
    expect(new Set(source.lojas.map(s => s.codigo)).size).toBe(530)
  })
  it('busca nomes, substâncias, SKU e categorias sem exigir acentos', () => {
    expect(filterMedicines(source.medicamentos, '75091-3')).toHaveLength(1)
    const matches = filterMedicines(source.medicamentos, 'budesonida', 'RINITE')
    expect(matches.length).toBeGreaterThan(0); expect(matches.every(m => m.indicacao === 'RINITE')).toBe(true)
    expect(filterMedicines(source.medicamentos, 'não existe 99999')).toHaveLength(0)
  })
  it('combina UF, cidade e busca por endereço sem incluir outras cidades', () => {
    const matches = filterStores(source.lojas, 'senador pompeu', 'CE', 'FORTALEZA')
    expect(matches.length).toBeGreaterThan(0); expect(matches.every(s => s.uf === 'CE' && s.cidade === 'FORTALEZA')).toBe(true)
    expect(filterStores(source.lojas, '', 'SP', 'FORTALEZA')).toHaveLength(0)
  })
  it('codifica o endereço para mapa e não aceita URL fornecida como destino', () => {
    const url = new URL(pharmacyMapsUrl({ endereco: 'Rua A & B, 10', bairro: 'Centro', cidade: 'Fortaleza', uf: 'CE', cep: '60025-001' }))
    expect(url.origin).toBe('https://www.google.com'); expect(url.searchParams.get('query')).toContain('Rua A & B, 10')
  })
  it('rejeita registros inválidos, campos desconhecidos e posições fora da Terra', () => {
    expect(medicineSchema.safeParse({ ...source.medicamentos[0], dv: '12' }).success).toBe(false)
    expect(storeSchema.safeParse({ ...source.lojas[0], uf: 'XX' }).success).toBe(false)
    expect(storeSchema.safeParse({ ...source.lojas[0], latitude: 91, longitude: -38 }).success).toBe(false)
    expect(storeSchema.safeParse({ ...source.lojas[0], id: 'arbitrary-id' }).success).toBe(false)
    expect(storeSchema.safeParse({ ...source.lojas[0], latitude: -3.73, longitude: -38.52 }).success).toBe(true)
  })
})
