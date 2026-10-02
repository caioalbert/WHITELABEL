'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { filterMedicines, filterStores, type PharmacyCatalog, type PharmacyKind, type Medicine, type PharmacyStore } from '@/lib/pharmacy-catalog'

const fields = {
  medicamentos: [['codigo', 'Código SKU'], ['dv', 'DV'], ['nome', 'Nome do produto'], ['substancia', 'Substância / apresentação'], ['indicacao', 'Categoria na lista']],
  lojas: [['codigo', 'Código da loja'], ['nome', 'Nome da loja'], ['endereco', 'Endereço'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['uf', 'UF'], ['cep', 'CEP'], ['latitude', 'Latitude (opcional)'], ['longitude', 'Longitude (opcional)']],
} as const
type Item = Medicine | PharmacyStore

export default function PharmacyAdminPage() {
  const [catalog, setCatalog] = useState<PharmacyCatalog>({ medicamentos: [], lojas: [] })
  const [kind, setKind] = useState<PharmacyKind>('medicamentos')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<{ id?: string; values: Record<string, string>; ativo: boolean } | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/admin/farmacia-popular', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar o catálogo.')
      setCatalog(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const filtered = useMemo(() => {
    const rows = kind === 'medicamentos' ? filterMedicines(catalog.medicamentos, search) : filterStores(catalog.lojas, search)
    return rows.filter(row => status === 'todos' || row.ativo === (status === 'ativos'))
  }, [catalog, kind, search, status])
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1))
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20)
  function openEdit(item?: Item) {
    setError(''); setMessage('')
    const values = Object.fromEntries(fields[kind].map(([key]) => [key, item ? String((item as unknown as Record<string, unknown>)[key] ?? '') : '']))
    setEditing({ id: item?.id, values, ativo: item?.ativo ?? true })
  }
  async function mutate(method: string, id: string | undefined, registro?: object) {
    const response = await fetch('/api/admin/farmacia-popular', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: kind, ...(id ? { id } : {}), ...(registro ? { registro } : {}) }) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.')
    setCatalog(previous => ({ ...previous, [kind]: method === 'POST' ? [...previous[kind], data.registro] : previous[kind].map(item => item.id === id ? data.registro : item) }))
    setMessage('Alteração salva. A lista do cliente será atualizada na próxima consulta.')
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!editing) return
    setBusy(true); setError('')
    try { await mutate(editing.id ? 'PATCH' : 'POST', editing.id, { ...editing.values, ativo: editing.ativo, ...(kind === 'lojas' ? { latitude: editing.values.latitude ? Number(editing.values.latitude.replace(',', '.')) : null, longitude: editing.values.longitude ? Number(editing.values.longitude.replace(',', '.')) : null } : {}) }); setEditing(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao salvar.') }
    finally { setBusy(false) }
  }
  async function toggle(item: Item) {
    setBusy(true); setError('')
    try { await mutate('PATCH', item.id, { ativo: !item.ativo }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao salvar.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-6">
    <AdminPageHeader title="Farmácia Popular" description="Gerencie os medicamentos e as lojas Pague Menos exibidos aos clientes." />
    <div className="flex flex-wrap gap-2" aria-label="Tipo de lista">
      {(['medicamentos', 'lojas'] as const).map(value => <Button key={value} variant={kind === value ? 'default' : 'outline'} aria-pressed={kind === value} onClick={() => { setKind(value); setPage(0); setSearch(''); setStatus('todos'); setMessage(''); setError('') }}>{value === 'lojas' ? 'Lojas Pague Menos' : 'Medicamentos e itens'} ({catalog[value].length})</Button>)}
    </div>
    <div className="flex flex-wrap gap-3">
      <Input aria-label="Buscar no catálogo" placeholder={kind === 'lojas' ? 'Buscar por loja, cidade, bairro ou CEP' : 'Buscar por nome, substância ou SKU'} value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} className="max-w-lg" />
      <select aria-label="Filtrar situação" value={status} onChange={e => { setStatus(e.target.value); setPage(0) }} className="rounded-xl border bg-white px-3 py-2"><option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select>
      <Button disabled={loading || busy} onClick={() => openEdit()}>{kind === 'lojas' ? 'Nova loja' : 'Novo item'}</Button>
      <Button variant="outline" disabled={loading} onClick={() => void load()}>Atualizar</Button>
    </div>
    {!editing && error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-emerald-700">{message}</p>}
    {loading ? <p role="status">Carregando catálogo…</p> : <>
      <p className="text-sm text-slate-500">{filtered.length} registros · Apenas ativos aparecem no app.</p>
      <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">{kind === 'lojas' ? 'Loja' : 'Produto'}</th><th className="p-4">{kind === 'lojas' ? 'Endereço' : 'Substância / categoria'}</th><th className="p-4">Situação</th><th className="p-4">Ações</th></tr></thead><tbody>
        {visible.map(item => <tr key={item.id} className="border-t"><td className="p-4"><strong>{item.nome}</strong><p className="text-slate-500">{item.codigo}{'dv' in item ? `-${item.dv}` : ''}</p></td><td className="p-4">{'substancia' in item ? <>{item.substancia}<p className="text-slate-500">{item.indicacao}</p></> : <>{item.endereco}<p className="text-slate-500">{item.bairro} · {item.cidade}/{item.uf} · {item.cep}</p></>}</td><td className="p-4">{item.ativo ? 'Ativo' : 'Inativo'}</td><td className="p-4"><div className="flex gap-2"><Button variant="outline" disabled={busy} aria-label={`Editar ${item.nome}`} onClick={() => openEdit(item)}>Editar</Button><Button variant="outline" disabled={busy} aria-label={`${item.ativo ? 'Desativar' : 'Ativar'} ${item.nome}`} onClick={() => void toggle(item)}>{item.ativo ? 'Desativar' : 'Ativar'}</Button></div></td></tr>)}
        {!visible.length && <tr><td colSpan={4} className="p-8 text-center">Nenhum registro encontrado.</td></tr>}
      </tbody></table></div>
      <div className="flex items-center gap-3"><Button variant="outline" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>Página {currentPage + 1} de {Math.max(1, Math.ceil(filtered.length / 20))}</span><Button variant="outline" disabled={(currentPage + 1) * 20 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Próxima</Button></div>
    </>}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) { setEditing(null); setError('') } }}><DialogContent className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?.id ? 'Editar registro' : kind === 'lojas' ? 'Nova loja' : 'Novo item'}</DialogTitle><DialogDescription>As alterações salvas refletem na lista do cliente.</DialogDescription></DialogHeader>
      {editing && <form onSubmit={save} className="space-y-4">{fields[kind].map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`farm-${key}`}>{label}</Label><Input id={`farm-${key}`} value={editing.values[key]} maxLength={key === 'dv' ? 1 : key === 'uf' ? 2 : 300} required={!['bairro', 'latitude', 'longitude'].includes(key)} onChange={e => setEditing({ ...editing, values: { ...editing.values, [key]: e.target.value, ...(kind === 'lojas' && ['endereco','bairro','cidade','uf','cep'].includes(key) ? { latitude: '', longitude: '' } : {}) } })} /></div>)}<label className="flex items-center gap-2"><input type="checkbox" checked={editing.ativo} onChange={e => setEditing({ ...editing, ativo: e.target.checked })} />Exibir no app do cliente</label>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(null); setError('') }}>Cancelar</Button></div></form>}
    </DialogContent></Dialog>
  </div>
}
