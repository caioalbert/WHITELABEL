import { z } from 'zod'

export const PHARMACY_NOTICE = 'Consulte a disponibilidade e as condições do programa diretamente na loja. Esta lista não substitui orientação médica.'
export const pharmacyKinds = ['medicamentos', 'lojas'] as const
export type PharmacyKind = typeof pharmacyKinds[number]
export type Medicine = { id: string; codigo: string; dv: string; nome: string; indicacao: string; substancia: string; ativo: boolean }
export type PharmacyStore = { id: string; codigo: string; nome: string; endereco: string; bairro: string; cidade: string; uf: string; cep: string; ativo: boolean; latitude?: number | null; longitude?: number | null }
export type PharmacyCatalog = { medicamentos: Medicine[]; lojas: PharmacyStore[] }
const required = z.string().trim().min(1, 'Campo obrigatório').max(300)
const optional = z.string().trim().max(300).default('')
export const medicineSchema = z.object({ codigo: required.max(30), dv: z.string().regex(/^\d$/, 'DV deve ter um dígito'), nome: required, indicacao: required, substancia: required, ativo: z.boolean() }).strict()
export const storeSchema = z.object({ codigo: required.max(30), nome: required, endereco: required, bairro: optional, cidade: required, uf: z.string().trim().toUpperCase().regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/), cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'), ativo: z.boolean(), latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional() }).strict()
export function normalizePharmacySearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}
export function filterMedicines(items: Medicine[], search: string, category = '') {
  const q = normalizePharmacySearch(search)
  return items.filter(m => (!category || m.indicacao === category) && normalizePharmacySearch(`${m.nome} ${m.substancia} ${m.indicacao} ${m.codigo}-${m.dv}`).includes(q))
}
export function filterStores(items: PharmacyStore[], search: string, uf = '', city = '') {
  const q = normalizePharmacySearch(search)
  return items.filter(s => (!uf || s.uf === uf) && (!city || s.cidade === city) && normalizePharmacySearch(`${s.nome} ${s.codigo} ${s.endereco} ${s.bairro} ${s.cidade} ${s.uf} ${s.cep}`).includes(q))
}
export function pharmacyMapsUrl(store: Pick<PharmacyStore, 'endereco' | 'bairro' | 'cidade' | 'uf' | 'cep'>) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([store.endereco, store.bairro, store.cidade, store.uf, store.cep].filter(Boolean).join(', '))}`
}
