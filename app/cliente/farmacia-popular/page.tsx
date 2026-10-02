'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClienteNav } from '@/components/cliente/cliente-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { filterMedicines, filterStores, pharmacyMapsUrl, PHARMACY_NOTICE, type PharmacyCatalog } from '@/lib/pharmacy-catalog'

export default function PharmacyClientPage() {
  const [catalog, setCatalog] = useState<PharmacyCatalog>({ medicamentos: [], lojas: [] })
  const [mapQuery, setMapQuery] = useState({ uf: '', city: '', search: '' })
  const [mapRevision, setMapRevision] = useState(0)
  const [showMap, setShowMap] = useState(false)
  const [tab, setTab] = useState('medicamentos')
  const [search, setSearch] = useState('')
  const [uf, setUf] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [limit, setLimit] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<{ nome?: string; tipo?: 'titular' | 'dependente' }>({})
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const r = await fetch('/api/cliente/farmacia-popular', { cache: 'no-store' }); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Não foi possível carregar a lista.'); setCatalog(data); setMapRevision(previous => previous + 1) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar a lista.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void load()
    void fetch('/api/cliente/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (data?.usuario) setProfile(data.usuario) }).catch(() => {})
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  const meds = useMemo(() => filterMedicines(catalog.medicamentos, search, category), [catalog, search, category])
  const stores = useMemo(() => filterStores(catalog.lojas, search, uf, city), [catalog, search, uf, city])
  const cities = [...new Set(catalog.lojas.filter(s => !uf || s.uf === uf).map(s => s.cidade))].sort()
  const selectClass = 'w-full rounded-xl border bg-white px-3 py-2.5 text-sm'
  return <ClienteNav nomeCliente={profile.nome} usuarioTipo={profile.tipo}><main className="mx-auto max-w-4xl space-y-5 p-5 pb-28">
    <Link href="/cliente/dashboard" className="text-sm text-blue-700">← Voltar ao início</Link>
    <header><p className="text-sm font-semibold text-red-600">Pague Menos</p><h1 className="text-3xl font-bold tracking-tight">Farmácia Popular</h1><p className="mt-2 text-slate-600">Consulte os medicamentos, itens e lojas participantes.</p></header>
    <div className="flex flex-wrap gap-2">{['medicamentos', 'lojas'].map(value => <Button key={value} variant={tab === value ? 'default' : 'outline'} aria-pressed={tab === value} onClick={() => { setTab(value); setSearch(''); setLimit(30) }}>{value === 'lojas' ? 'Lojas Pague Menos' : 'Medicamentos e itens'}</Button>)}<Button variant="outline" onClick={() => void load()} disabled={loading}>Atualizar lista</Button></div>
    <Input aria-label="Buscar na Farmácia Popular" placeholder={tab === 'lojas' ? 'Buscar endereço, bairro, cidade ou CEP' : 'Buscar nome, substância ou SKU'} value={search} onChange={e => { setSearch(e.target.value); setLimit(30) }} />
    {tab === 'medicamentos' ? <select aria-label="Categoria" className={selectClass} value={category} onChange={e => { setCategory(e.target.value); setLimit(30) }}><option value="">Todas as categorias</option>{[...new Set(catalog.medicamentos.map(m => m.indicacao))].sort().map(c => <option key={c}>{c}</option>)}</select> : <div className="grid gap-3 sm:grid-cols-2"><select aria-label="Estado" className={selectClass} value={uf} onChange={e => { setUf(e.target.value); setCity(''); setLimit(30) }}><option value="">Todos os estados</option>{[...new Set(catalog.lojas.map(s => s.uf))].sort().map(s => <option key={s}>{s}</option>)}</select><select aria-label="Cidade" className={selectClass} value={city} onChange={e => { setCity(e.target.value); setLimit(30) }}><option value="">Todas as cidades</option>{cities.map(c => <option key={c}>{c}</option>)}</select></div>}
    {tab === 'lojas' && <><Button variant="outline" aria-pressed={showMap} onClick={() => { setMapQuery({ uf, city, search }); setShowMap(!showMap) }}>{showMap ? 'Ocultar mapa' : 'Mostrar mapa interativo'}</Button>{showMap && <><Button variant="outline" onClick={() => { setMapQuery({ uf, city, search }); setMapRevision(previous => previous + 1) }}>Aplicar filtros ao mapa</Button><iframe key={`${mapQuery.uf}-${mapQuery.city}-${mapQuery.search}-${mapRevision}`} title="Mapa das lojas Pague Menos" className="h-[480px] w-full rounded-2xl border" src={`/api/cliente/farmacia-popular/mapa?uf=${encodeURIComponent(mapQuery.uf)}&cidade=${encodeURIComponent(mapQuery.city)}&busca=${encodeURIComponent(mapQuery.search)}`} referrerPolicy="strict-origin-when-cross-origin" /></>}</>}
    {error ? <div role="alert" className="rounded-xl border border-red-200 p-4 text-red-700">{error}<Button variant="outline" className="mt-3 block" onClick={() => void load()}>Tentar novamente</Button></div> : loading ? <p role="status">Carregando lista…</p> : <>
      <p role="status" className="text-sm text-slate-500">{tab === 'lojas' ? stores.length : meds.length} resultados</p>
      <div className="grid gap-3 sm:grid-cols-2">{tab === 'medicamentos' ? meds.slice(0, limit).map(m => <article key={m.id} className="space-y-2 rounded-2xl border bg-white p-5"><h2 className="font-semibold">{m.nome}</h2><p className="text-sm text-slate-700">{m.substancia}</p><p className="text-xs text-slate-500">Categoria: {m.indicacao} · SKU {m.codigo}-{m.dv}</p></article>) : stores.slice(0, limit).map(s => <article key={s.id} className="space-y-2 rounded-2xl border bg-white p-5"><h2 className="font-semibold">{s.nome}</h2><p className="text-sm">{s.endereco}</p><p className="text-sm text-slate-600">{s.bairro} · {s.cidade}/{s.uf}<br />CEP {s.cep}</p><a className="inline-block text-sm font-semibold text-blue-700" href={pharmacyMapsUrl(s)} target="_blank" rel="noopener noreferrer">Ver no mapa ↗</a></article>)}</div>
      {(tab === 'lojas' ? stores.length : meds.length) === 0 && <p>Nenhum resultado encontrado. Tente outra busca ou filtro.</p>}
      {(tab === 'lojas' ? stores.length : meds.length) > limit && <Button variant="outline" onClick={() => setLimit(limit + 30)}>Mostrar mais</Button>}
    </>}
    <p className="rounded-xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">{PHARMACY_NOTICE}</p>
  </main></ClienteNav>
}
