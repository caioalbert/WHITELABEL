'use client'

import Link from 'next/link'
import { ArrowLeft, LocateFixed } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClienteNav } from '@/components/cliente/cliente-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { filterMedicines, pharmacyMapsUrl, PHARMACY_NOTICE, type PharmacyCatalog, type PharmacyStore } from '@/lib/pharmacy-catalog'
import { locatePharmacyRegion } from '@/lib/pharmacy-location'

type Region = { uf: string; cidade: string }
type Point = { lat: number; lng: number }
export default function PharmacyClientPage() {
  const [catalog, setCatalog] = useState<PharmacyCatalog>({ medicamentos: [], lojas: [] })
  const [regions, setRegions] = useState<Region[]>([])
  const [mapsKey, setMapsKey] = useState('')
  const [mapQuery, setMapQuery] = useState({ uf: '', city: '', search: '', offset: 0 })
  const [mapRevision, setMapRevision] = useState(0)
  const [showMap, setShowMap] = useState(false)
  const [tab, setTab] = useState('medicamentos')
  const [search, setSearch] = useState('')
  const [uf, setUf] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [limit, setLimit] = useState(30)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingStores, setLoadingStores] = useState(false)
  const [error, setError] = useState('')
  const [regionError, setRegionError] = useState('')
  const [locationMessage, setLocationMessage] = useState('')
  const [locating, setLocating] = useState(false)
  const [point, setPoint] = useState<Point | null>(null)
  const [distances, setDistances] = useState<Record<string, number>>({})
  const [storeRevision, setStoreRevision] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)
  const [profile, setProfile] = useState<{ nome?: string; tipo?: 'titular' | 'dependente' }>({})
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/cliente/farmacia-popular?tipo=medicamentos', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a lista.')
      setCatalog(previous => ({ ...previous, medicamentos: data.medicamentos }))
      setRegions(data.regioes); setMapsKey(data.mapsBrowserKey)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar a lista.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void load()
    void fetch('/api/cliente/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (data?.usuario) setProfile(data.usuario) }).catch(() => {})
  }, [load])
  useEffect(() => {
    setDistances({}); setCatalog(previous => ({ ...previous, lojas: [] })); setTotal(0)
    if (tab !== 'lojas' || !uf || !city) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoadingStores(true); setRegionError('')
      try {
        const query = new URLSearchParams({ tipo: 'lojas', uf, cidade: city, busca: search, offset: String(offset) })
        const response = await fetch(`/api/cliente/farmacia-popular?${query}`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível consultar as lojas.')
        if (!controller.signal.aborted) { setCatalog(previous => ({ ...previous, lojas: data.lojas })); setTotal(data.total) }
      } catch (e) { if (!controller.signal.aborted) setRegionError(e instanceof Error ? e.message : 'Não foi possível consultar as lojas.') }
      finally { if (!controller.signal.aborted) setLoadingStores(false) }
    }, 300)
    return () => { controller.abort(); clearTimeout(timer); setLoadingStores(false) }
  }, [tab, uf, city, search, offset, storeRevision])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return
      if (event.data?.type === 'PHARMACY_MAP_READY' && point) frame.current?.contentWindow?.postMessage({ type: 'PHARMACY_USER_LOCATION', point }, location.origin)
      if (event.data?.type === 'PHARMACY_MAP_DISTANCES' && Array.isArray(event.data.distances)) {
        const values: Record<string, number> = {}
        for (const item of event.data.distances.slice(0, 20)) if (typeof item.id === 'string' && Number.isFinite(item.km) && item.km >= 0) values[item.id] = item.km
        setDistances(values)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [point])
  const locate = () => {
    if (!navigator.geolocation) { setLocationMessage('Escolha estado e cidade para consultar as lojas.'); return }
    setLocating(true); setLocationMessage('Buscando sua região…')
    navigator.geolocation.getCurrentPosition(async result => {
      const current = { lat: result.coords.latitude, lng: result.coords.longitude }
      try {
        const selected = await locatePharmacyRegion(mapsKey, current, regions)
        setUf(selected.uf); setCity(selected.cidade); setOffset(0); setPoint(current); setShowMap(false)
        setLocationMessage(`Lojas na sua região: ${selected.cidade}/${selected.uf}. No mapa, veja a distância das lojas desta busca.`)
      } catch (e) { setLocationMessage(e instanceof Error ? e.message : 'Escolha estado e cidade para consultar as lojas.') }
      finally { setLocating(false) }
    }, () => { setLocating(false); setLocationMessage('Localização não disponível. Escolha estado e cidade para consultar as lojas.') }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 })
  }
  const meds = useMemo(() => filterMedicines(catalog.medicamentos, search, category), [catalog.medicamentos, search, category])
  const stores = useMemo(() => [...catalog.lojas].sort((a, b) => (distances[a.id] ?? Infinity) - (distances[b.id] ?? Infinity)), [catalog.lojas, distances])
  const cities = regions.filter(r => r.uf === uf).map(r => r.cidade)
  const selectClass = 'w-full rounded-xl border bg-white px-3 py-2.5 text-sm'
  const changeRegion = () => { setOffset(0); setShowMap(false); setPoint(null); setLocationMessage(''); setDistances({}) }
  const query = new URLSearchParams({ uf: mapQuery.uf, cidade: mapQuery.city, busca: mapQuery.search, offset: String(mapQuery.offset) })
  return <ClienteNav nomeCliente={profile.nome} usuarioTipo={profile.tipo}><section className="mx-auto max-w-4xl space-y-5 p-5 pb-28">
    <Link href="/cliente/dashboard" aria-label="Voltar ao início" title="Voltar ao início" className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><ArrowLeft className="size-5" aria-hidden="true" /></Link>
    <header><p className="text-sm font-semibold text-red-600">Pague Menos</p><h1 className="text-3xl font-bold tracking-tight">Farmácia Popular</h1><p className="mt-2 text-slate-600">Consulte os medicamentos, itens e lojas participantes.</p></header>
    <div className="flex flex-wrap gap-2">{['medicamentos', 'lojas'].map(value => <Button key={value} variant={tab === value ? 'default' : 'outline'} aria-pressed={tab === value} onClick={() => { setTab(value); setSearch(''); setLimit(30); setOffset(0); setShowMap(false) }}>{value === 'lojas' ? 'Lojas Pague Menos' : 'Medicamentos e itens'}</Button>)}<Button variant="outline" onClick={() => { void load(); setStoreRevision(value => value + 1) }} disabled={loading}>Atualizar lista</Button></div>
    <Input aria-label="Buscar na Farmácia Popular" placeholder={tab === 'lojas' ? 'Buscar endereço, bairro ou CEP na cidade' : 'Buscar nome, substância ou SKU'} value={search} onChange={e => { setSearch(e.target.value); setLimit(30); setOffset(0) }} />
    {tab === 'medicamentos' ? <select aria-label="Categoria" className={selectClass} value={category} onChange={e => { setCategory(e.target.value); setLimit(30) }}><option value="">Todas as categorias</option>{[...new Set(catalog.medicamentos.map(m => m.indicacao))].sort().map(c => <option key={c}>{c}</option>)}</select> : <>
      <div className="space-y-2"><Button variant="outline" onClick={locate} disabled={locating || loading}><LocateFixed className="size-4" />{locating ? 'Localizando…' : 'Usar minha localização'}</Button><p className="text-xs text-slate-500">Com sua permissão, sua localização será usada pelo Google Maps para identificar sua cidade. Ela não é salva no cadastro.</p>{locationMessage && <p role="status" className="text-sm text-slate-600">{locationMessage}</p>}</div>
      <div className="grid gap-3 sm:grid-cols-2"><select aria-label="Estado" className={selectClass} value={uf} onChange={e => { changeRegion(); setUf(e.target.value); setCity('') }}><option value="">Escolha um estado</option>{[...new Set(regions.map(r => r.uf))].sort().map(s => <option key={s}>{s}</option>)}</select><select aria-label="Cidade" className={selectClass} value={city} disabled={!uf} onChange={e => { changeRegion(); setCity(e.target.value) }}><option value="">Escolha uma cidade</option>{cities.map(c => <option key={c}>{c}</option>)}</select></div>
      {uf && city && stores.length > 0 && <><Button variant="outline" aria-pressed={showMap} onClick={() => { setMapQuery({ uf, city, search, offset }); setShowMap(!showMap) }}>{showMap ? 'Ocultar mapa' : 'Mostrar mapa interativo'}</Button>{showMap && <><Button variant="outline" onClick={() => { setMapQuery({ uf, city, search, offset }); setMapRevision(value => value + 1) }}>Aplicar filtros ao mapa</Button><iframe ref={frame} key={`${query}-${mapRevision}`} title="Mapa das lojas Pague Menos" className="h-[480px] w-full rounded-2xl border" src={`/api/cliente/farmacia-popular/mapa?${query}`} referrerPolicy="strict-origin-when-cross-origin" /></>}</>}
      {!uf || !city ? <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Use sua localização ou escolha estado e cidade para encontrar as lojas.</p> : null}
    </>}
    {(error || regionError) && <div role="alert" className="rounded-xl border border-red-200 p-4 text-red-700">{error || regionError}</div>}
    {loading || (tab === 'lojas' && loadingStores) ? <p role="status">Carregando lista…</p> : <>
      <p role="status" className="text-sm text-slate-500">{tab === 'lojas' ? uf && city ? `${total} lojas nesta cidade · até 20 por página` : '' : `${meds.length} resultados`}</p>
      <div className="grid gap-3 sm:grid-cols-2">{tab === 'medicamentos' ? meds.slice(0, limit).map(m => <article key={m.id} className="space-y-2 rounded-2xl border bg-white p-5"><h2 className="font-semibold">{m.nome}</h2><p className="text-sm text-slate-700">{m.substancia}</p><p className="text-xs text-slate-500">Categoria: {m.indicacao} · SKU {m.codigo}-{m.dv}</p></article>) : stores.map((s: PharmacyStore) => <article key={s.id} className="space-y-2 rounded-2xl border bg-white p-5"><h2 className="font-semibold">{s.nome}</h2>{distances[s.id] !== undefined && <p className="text-sm font-medium text-blue-700">{distances[s.id].toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km de você</p>}<p className="text-sm">{s.endereco}</p><p className="text-sm text-slate-600">{s.bairro} · {s.cidade}/{s.uf}<br />CEP {s.cep}</p><a className="inline-block text-sm font-semibold text-blue-700" href={pharmacyMapsUrl(s)} target="_blank" rel="noopener noreferrer">Ver no mapa ↗</a></article>)}</div>
      {tab === 'medicamentos' && meds.length > limit && <Button variant="outline" onClick={() => setLimit(limit + 30)}>Mostrar mais</Button>}
      {tab === 'lojas' && total > 20 && <div className="flex gap-2"><Button variant="outline" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 20)); setShowMap(false) }}>Anterior</Button><Button variant="outline" disabled={offset + 20 >= total} onClick={() => { setOffset(offset + 20); setShowMap(false) }}>Próximas lojas</Button></div>}
      {tab === 'lojas' && uf && city && !total && !regionError && <p>Nenhuma loja encontrada para esta busca.</p>}
    </>}
    <p className="rounded-xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">{PHARMACY_NOTICE}</p>
  </section></ClienteNav>
}
