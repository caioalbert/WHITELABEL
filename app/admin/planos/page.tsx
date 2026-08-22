'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { BrandLogoImage } from '@/components/brand-logo'
import { isSupportedBrandLogoUrl, normalizeBranding } from '@/lib/branding'

type BillingType = 'BOLETO' | 'CREDIT_CARD'

type Plano = {
  id: string
  codigo: string
  nome: string
  valor: number
  ativo: boolean
  ordem: number
}

const MIN_CHARGE_VALUE = 5

const BILLING_TYPE_LABEL: Record<BillingType, string> = {
  BOLETO: 'BolePIX',
  CREDIT_CARD: 'Cartão de Crédito',
}

function normalizeBillingType(value: unknown): BillingType | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'CREDIT_CARD') return 'CREDIT_CARD'
  if (normalized === 'BOLETO' || normalized === 'PIX') return 'BOLETO'
  return null
}

function normalizeBillingTypeList(values: unknown): BillingType[] {
  if (!Array.isArray(values)) return []
  return Array.from(
    new Set(
      values
        .map((v) => normalizeBillingType(v))
        .filter((v): v is BillingType => Boolean(v))
    )
  )
}

export default function AdminPlanosPage() {
  const router = useRouter()

  // ── Planos ──
  const [planos, setPlanos] = useState<Plano[]>([])
  const [isLoadingPlanos, setIsLoadingPlanos] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [novoPlanoNome, setNovoPlanoNome] = useState('')
  const [novoPlanoValor, setNovoPlanoValor] = useState('')
  const [planosError, setPlanosError] = useState<string | null>(null)
  const [planosMessage, setPlanosMessage] = useState<string | null>(null)

  // ── Plano padrão ──
  const [defaultPlanType, setDefaultPlanType] = useState('')
  const [isSavingDefaultPlan, setIsSavingDefaultPlan] = useState(false)

  // ── Formas de cobrança ──
  const [allowedBillingTypes] = useState<BillingType[]>(['BOLETO', 'CREDIT_CARD'])
  const [mensalidadeBillingTypes, setMensalidadeBillingTypes] = useState<BillingType[]>(['BOLETO', 'CREDIT_CARD'])
  const [defaultMensalidadeBillingType, setDefaultMensalidadeBillingType] = useState<BillingType>('BOLETO')
  const [isSavingCobranca, setIsSavingCobranca] = useState(false)
  const [cobrancaError, setCobrancaError] = useState<string | null>(null)
  const [cobrancaMessage, setCobrancaMessage] = useState<string | null>(null)

  // ── Comissões ──
  const [comissaoPercentualAdesao, setComissaoPercentualAdesao] = useState('')
  const [comissaoPercentualMensalidade, setComissaoPercentualMensalidade] = useState('')
  type ComissaoModo = 'primeiro' | 'custom' | 'vitalicio'
  const [comissaoModo, setComissaoModo] = useState<ComissaoModo>('vitalicio')
  const [comissaoMensalidadesMaxCustom, setComissaoMensalidadesMaxCustom] = useState('12')
  const [isSavingComissao, setIsSavingComissao] = useState(false)
  const [comissaoError, setComissaoError] = useState<string | null>(null)
  const [comissaoMessage, setComissaoMessage] = useState<string | null>(null)

  // ── Identidade visual ──
  const [brandName, setBrandName] = useState('')
  const [brandShortName, setBrandShortName] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandLogoAlt, setBrandLogoAlt] = useState('')
  const [appTagline, setAppTagline] = useState('')
  const [isSavingBranding, setIsSavingBranding] = useState(false)
  const [brandingError, setBrandingError] = useState<string | null>(null)
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null)

  // ── Operacional ──
  const [telefoneEmergencia, setTelefoneEmergencia] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [isSavingOperacional, setIsSavingOperacional] = useState(false)
  const [operacionalError, setOperacionalError] = useState<string | null>(null)
  const [operacionalMessage, setOperacionalMessage] = useState<string | null>(null)

  // ── Fetch planos ──
  const fetchPlanos = useCallback(async () => {
    try {
      setIsLoadingPlanos(true)
      setPlanosError(null)
      const response = await fetch('/api/admin/planos', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (response.status === 401) { router.push('/admin/login'); return }
      if (!response.ok) throw new Error(payload?.error || 'Erro ao carregar planos.')
      const list: Plano[] = Array.isArray(payload?.planos) ? payload.planos : []
      setPlanos(list)
    } catch (err) {
      setPlanosError(err instanceof Error ? err.message : 'Erro ao carregar planos.')
    } finally {
      setIsLoadingPlanos(false)
    }
  }, [router])

  // ── Fetch configurações de cobrança/comissões/branding ──
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cobranca-configuracoes', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (response.status === 401) { router.push('/admin/login'); return }
      if (!response.ok) return
      const s = payload?.settings || {}
      const types = normalizeBillingTypeList(s.mensalidadeBillingTypes)
      const effectiveTypes: BillingType[] = types.length > 0 ? types : ['BOLETO', 'CREDIT_CARD']
      setMensalidadeBillingTypes(effectiveTypes)
      const reqDefault = normalizeBillingType(s.defaultMensalidadeBillingType)
      setDefaultMensalidadeBillingType(
        reqDefault && effectiveTypes.includes(reqDefault) ? reqDefault : effectiveTypes[0]
      )
      const dp = String(s.defaultPlanType || '').trim().toUpperCase()
      if (dp) setDefaultPlanType(dp)
      setComissaoPercentualAdesao(s.comissaoPercentualAdesao != null ? String(s.comissaoPercentualAdesao) : '0')
      setComissaoPercentualMensalidade(s.comissaoPercentualMensalidade != null ? String(s.comissaoPercentualMensalidade) : '0')
      const maxM = s.comissaoMensalidadesMax
      if (maxM === null || maxM === undefined) setComissaoModo('vitalicio')
      else if (Number(maxM) === 1) setComissaoModo('primeiro')
      else { setComissaoModo('custom'); setComissaoMensalidadesMaxCustom(String(maxM)) }
      setBrandName(s.brandName || '')
      setBrandShortName(s.brandShortName || '')
      setBrandLogoUrl(s.brandLogoUrl || '')
      setBrandLogoAlt(s.brandLogoAlt || '')
      setAppTagline(s.appTagline || '')
      setTelefoneEmergencia(s.telefoneEmergencia || '')
      setWhatsappUrl(s.whatsappUrl || '')
    } catch {
      // silently ignore — planos still load
    }
  }, [router])

  useEffect(() => {
    fetchPlanos()
    fetchSettings()
  }, [fetchPlanos, fetchSettings])

  const sortedPlanos = useMemo(
    () => [...planos].sort((a, b) => a.ordem - b.ordem),
    [planos]
  )

  const defaultPlanOptions = useMemo(
    () =>
      sortedPlanos.reduce<Array<{ codigo: string; nome: string }>>((acc, p) => {
        const codigo = String(p.codigo || '').trim().toUpperCase()
        if (!codigo || acc.some((e) => e.codigo === codigo)) return acc
        acc.push({ codigo, nome: String(p.nome || '').trim() || codigo })
        return acc
      }, []),
    [sortedPlanos]
  )

  useEffect(() => {
    if (defaultPlanOptions.length === 0) return
    if (!defaultPlanOptions.some((p) => p.codigo === defaultPlanType))
      setDefaultPlanType(defaultPlanOptions[0].codigo)
  }, [defaultPlanOptions, defaultPlanType])

  const brandingPreview = useMemo(
    () => normalizeBranding({ brandName, brandShortName, brandLogoUrl, brandLogoAlt, appTagline }),
    [brandName, brandShortName, brandLogoUrl, brandLogoAlt, appTagline]
  )

  const handleLogout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }) } catch {}
    router.push('/admin/login')
  }

  const handleCreatePlano = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsCreating(true)
      setPlanosError(null)
      setPlanosMessage(null)
      const nome = novoPlanoNome.trim()
      const valor = Number(novoPlanoValor)
      if (!nome) throw new Error('Informe o nome do novo plano.')
      if (!Number.isFinite(valor) || valor < MIN_CHARGE_VALUE)
        throw new Error('Informe um valor válido (mínimo R$ 5,00).')
      const res = await fetch('/api/admin/planos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, valor }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) throw new Error(payload?.error || 'Erro ao criar plano.')
      setPlanosMessage(payload?.message || 'Plano criado com sucesso.')
      setNovoPlanoNome('')
      setNovoPlanoValor('')
      await fetchPlanos()
    } catch (err) {
      setPlanosError(err instanceof Error ? err.message : 'Erro ao criar plano.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSaveDefaultPlan = async () => {
    const selected = defaultPlanOptions.find((p) => p.codigo === defaultPlanType)
    if (!selected) { setCobrancaError('Selecione um plano padrão válido.'); return }
    try {
      setIsSavingDefaultPlan(true)
      setCobrancaError(null)
      setCobrancaMessage(null)
      const res = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensalidadeBillingTypes, defaultMensalidadeBillingType, defaultPlanType: selected.codigo }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) throw new Error(payload?.error || 'Erro ao atualizar plano padrão.')
      setCobrancaMessage('Plano padrão atualizado com sucesso.')
      const next = String(payload?.settings?.defaultPlanType || selected.codigo).trim().toUpperCase()
      setDefaultPlanType(next || selected.codigo)
    } catch (err) {
      setCobrancaError(err instanceof Error ? err.message : 'Erro ao atualizar plano padrão.')
    } finally {
      setIsSavingDefaultPlan(false)
    }
  }

  const handleToggleBillingType = (billingType: BillingType, checked: boolean) => {
    setCobrancaError(null)
    setCobrancaMessage(null)
    if (checked) {
      setMensalidadeBillingTypes((prev) => prev.includes(billingType) ? prev : [...prev, billingType])
      return
    }
    setMensalidadeBillingTypes((prev) => {
      const next = prev.filter((t) => t !== billingType)
      if (next.length === 0) return prev
      if (!next.includes(defaultMensalidadeBillingType)) setDefaultMensalidadeBillingType(next[0])
      return next
    })
  }

  const handleSaveCobranca = async () => {
    try {
      setIsSavingCobranca(true)
      setCobrancaError(null)
      setCobrancaMessage(null)
      if (mensalidadeBillingTypes.length === 0) throw new Error('Selecione ao menos uma forma de cobrança.')
      const res = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensalidadeBillingTypes, defaultMensalidadeBillingType, defaultPlanType }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) throw new Error(payload?.error || 'Erro ao salvar formas de cobrança.')
      setCobrancaMessage('Formas de cobrança salvas com sucesso.')
    } catch (err) {
      setCobrancaError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setIsSavingCobranca(false)
    }
  }

  const handleSaveComissao = async () => {
    try {
      setIsSavingComissao(true)
      setComissaoError(null)
      setComissaoMessage(null)
      const pctAdesao = Number(comissaoPercentualAdesao)
      const pctMensalidade = Number(comissaoPercentualMensalidade)
      if (!Number.isFinite(pctAdesao) || pctAdesao < 0 || pctAdesao > 100) throw new Error('% sobre adesão deve ser entre 0 e 100.')
      if (!Number.isFinite(pctMensalidade) || pctMensalidade < 0 || pctMensalidade > 100) throw new Error('% sobre mensalidade deve ser entre 0 e 100.')
      let comissaoMensalidadesMax: number | null
      if (comissaoModo === 'vitalicio') comissaoMensalidadesMax = null
      else if (comissaoModo === 'primeiro') comissaoMensalidadesMax = 1
      else {
        const v = Number(comissaoMensalidadesMaxCustom)
        if (!Number.isFinite(v) || v < 1 || !Number.isInteger(v)) throw new Error('Informe um número inteiro maior ou igual a 1.')
        comissaoMensalidadesMax = v
      }
      const res = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comissaoPercentualAdesao: pctAdesao, comissaoPercentualMensalidade: pctMensalidade, comissaoMensalidadesMax }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) throw new Error(payload?.error || 'Erro ao salvar comissões.')
      setComissaoMessage('Configurações de comissão salvas com sucesso.')
    } catch (err) {
      setComissaoError(err instanceof Error ? err.message : 'Erro ao salvar comissões.')
    } finally {
      setIsSavingComissao(false)
    }
  }

  const handleSaveBranding = async () => {
    try {
      setIsSavingBranding(true)
      setBrandingError(null)
      setBrandingMessage(null)
      const normalizedName = brandName.trim()
      if (!normalizedName) throw new Error('Informe o nome da marca.')
      if (!isSupportedBrandLogoUrl(brandLogoUrl)) throw new Error('Informe uma URL de logo válida começando com /, http:// ou https://.')
      const res = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: normalizedName, brandShortName: brandShortName.trim(), brandLogoUrl: brandLogoUrl.trim(), brandLogoAlt: brandLogoAlt.trim(), appTagline: appTagline.trim() }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) throw new Error(payload?.error || 'Erro ao salvar identidade visual.')
      setBrandName(payload?.settings?.brandName || normalizedName)
      setBrandShortName(payload?.settings?.brandShortName || brandShortName.trim())
      setBrandLogoUrl(payload?.settings?.brandLogoUrl || brandLogoUrl.trim())
      setBrandLogoAlt(payload?.settings?.brandLogoAlt || brandLogoAlt.trim())
      setBrandingMessage('Identidade visual salva com sucesso.')
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : 'Erro ao salvar identidade visual.')
    } finally {
      setIsSavingBranding(false)
    }
  }

  const handleSaveOperacional = async () => {
    try {
      setIsSavingOperacional(true)
      setOperacionalError(null)
      setOperacionalMessage(null)
      const res = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefoneEmergencia, whatsappUrl }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) throw new Error(payload?.error || 'Erro ao salvar.')
      setOperacionalMessage('Configurações operacionais salvas com sucesso.')
    } catch (err) {
      setOperacionalError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setIsSavingOperacional(false)
    }
  }


  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Planos</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Gerencie planos, cobrança, comissões e identidade visual</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Button onClick={fetchPlanos} variant="outline">Atualizar</Button>
            <Link href="/admin/configuracoes"><Button variant="outline">Configurações</Button></Link>
            <Link href="/admin/dashboard"><Button variant="outline">Dashboard</Button></Link>
            <Button onClick={handleLogout} variant="outline">Sair</Button>
          </div>
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild><Button onClick={fetchPlanos} variant="outline" className="w-full justify-start">Atualizar</Button></SheetClose>
                  <SheetClose asChild><Button asChild variant="outline" className="w-full justify-start"><Link href="/admin/configuracoes">Configurações</Link></Button></SheetClose>
                  <SheetClose asChild><Button asChild variant="outline" className="w-full justify-start"><Link href="/admin/dashboard">Dashboard</Link></Button></SheetClose>
                  <SheetClose asChild><Button onClick={handleLogout} variant="outline" className="w-full justify-start">Sair</Button></SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Feedback global de planos ── */}
        {planosError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{planosError}</p>
          </div>
        )}
        {planosMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-700">{planosMessage}</p>
          </div>
        )}

        {/* ── Lista de planos ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Planos</h2>
              <p className="mt-1 text-sm text-gray-500">Clique no nome do plano para editar detalhes, benefícios e regras de dependentes.</p>
            </div>
          </div>

          {isLoadingPlanos ? (
            <p className="mt-4 text-sm text-gray-500">Carregando planos...</p>
          ) : sortedPlanos.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Nenhum plano cadastrado.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Nome</th>
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedPlanos.map((plano) => (
                    <tr key={plano.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-blue-600 hover:text-blue-800">
                        <Link href={`/admin/planos/${plano.id}`}>{plano.nome}</Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{plano.codigo}</td>
                      <td className="px-4 py-3 text-right text-gray-800">
                        R$ {Number(plano.valor).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${plano.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {plano.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Criar novo plano */}
          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-800">Criar novo plano</h3>
            <p className="mt-1 text-xs text-gray-500">O código é gerado automaticamente a partir do nome.</p>
            <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={handleCreatePlano}>
              <div className="flex-1 min-w-40 space-y-1">
                <label className="block text-xs font-medium text-gray-700">Nome</label>
                <input
                  value={novoPlanoNome}
                  onChange={(e) => setNovoPlanoNome(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Ex: Plano Empresarial"
                  disabled={isCreating}
                  required
                />
              </div>
              <div className="w-36 space-y-1">
                <label className="block text-xs font-medium text-gray-700">Valor (R$)</label>
                <input
                  type="number"
                  min={MIN_CHARGE_VALUE}
                  step="0.01"
                  value={novoPlanoValor}
                  onChange={(e) => setNovoPlanoValor(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="49.90"
                  disabled={isCreating}
                  required
                />
              </div>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Criando...' : 'Criar Plano'}
              </Button>
            </form>
          </div>
        </section>


        {/* ── Plano padrão + Formas de cobrança ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Cobrança</h2>

          {/* Plano padrão */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-800">Plano padrão para novos clientes</p>
            {defaultPlanOptions.length === 0 ? (
              <p className="text-sm text-gray-500">Cadastre ao menos um plano para definir o padrão.</p>
            ) : (
              <RadioGroup
                value={defaultPlanType}
                onValueChange={(v) => setDefaultPlanType(String(v || '').trim().toUpperCase())}
                className="space-y-2"
              >
                {defaultPlanOptions.map((plan) => (
                  <label key={plan.codigo} className="flex items-center gap-3">
                    <RadioGroupItem value={plan.codigo} id={`plan-${plan.codigo}`} disabled={isSavingDefaultPlan} />
                    <span className="text-sm text-gray-800">{plan.nome}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSaveDefaultPlan} disabled={isSavingDefaultPlan || defaultPlanOptions.length === 0} size="sm">
                {isSavingDefaultPlan ? 'Salvando...' : 'Salvar plano padrão'}
              </Button>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Formas de cobrança */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-800">Formas de cobrança da mensalidade</p>
            <p className="text-xs text-gray-500">Se houver mais de uma opção marcada, o cliente escolherá no fim da adesão.</p>
            <div className="space-y-2">
              {allowedBillingTypes.map((billingType) => (
                <label key={billingType} className="flex items-center gap-3">
                  <Checkbox
                    checked={mensalidadeBillingTypes.includes(billingType)}
                    onCheckedChange={(v) => handleToggleBillingType(billingType, v === true)}
                    disabled={isSavingCobranca}
                  />
                  <span className="text-sm text-gray-800">{BILLING_TYPE_LABEL[billingType]}</span>
                </label>
              ))}
            </div>

            <p className="text-sm font-medium text-gray-800 pt-2">Opção padrão</p>
            <RadioGroup
              value={defaultMensalidadeBillingType}
              onValueChange={(v) => setDefaultMensalidadeBillingType(v as BillingType)}
              className="space-y-2"
            >
              {allowedBillingTypes
                .filter((t) => mensalidadeBillingTypes.includes(t))
                .map((billingType) => (
                  <label key={billingType} className="flex items-center gap-3">
                    <RadioGroupItem value={billingType} id={`default-${billingType}`} disabled={isSavingCobranca} />
                    <span className="text-sm text-gray-800">{BILLING_TYPE_LABEL[billingType]}</span>
                  </label>
                ))}
            </RadioGroup>

            {cobrancaError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{cobrancaError}</p>
              </div>
            )}
            {cobrancaMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm text-green-700">{cobrancaMessage}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSaveCobranca} disabled={isSavingCobranca} size="sm">
                {isSavingCobranca ? 'Salvando...' : 'Salvar formas de cobrança'}
              </Button>
            </div>
          </div>
        </section>

        {/* ── Comissões ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Comissões dos Vendedores</h2>
          <p className="text-sm text-gray-500">Defina os percentuais e a vigência das comissões pagas aos vendedores.</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">% sobre adesão</span>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={comissaoPercentualAdesao}
                  onChange={(e) => setComissaoPercentualAdesao(e.target.value)}
                  className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={isSavingComissao}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">% sobre mensalidade</span>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={comissaoPercentualMensalidade}
                  onChange={(e) => setComissaoPercentualMensalidade(e.target.value)}
                  className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={isSavingComissao}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Mensalidades que geram comissão</p>
            <RadioGroup
              value={comissaoModo}
              onValueChange={(v) => setComissaoModo(v as 'primeiro' | 'custom' | 'vitalicio')}
              className="space-y-2"
            >
              <label className="flex items-center gap-3">
                <RadioGroupItem value="primeiro" id="comissao-primeiro" disabled={isSavingComissao} />
                <span className="text-sm text-gray-800">Apenas a 1ª mensalidade</span>
              </label>
              <label className="flex items-center gap-3">
                <RadioGroupItem value="custom" id="comissao-custom" disabled={isSavingComissao} />
                <span className="text-sm text-gray-800">Número customizado</span>
              </label>
              {comissaoModo === 'custom' && (
                <div className="ml-7 flex items-center gap-2">
                  <input
                    type="number" min={1} step={1}
                    value={comissaoMensalidadesMaxCustom}
                    onChange={(e) => setComissaoMensalidadesMaxCustom(e.target.value)}
                    className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={isSavingComissao}
                  />
                  <span className="text-sm text-gray-500">mensalidade(s)</span>
                </div>
              )}
              <label className="flex items-center gap-3">
                <RadioGroupItem value="vitalicio" id="comissao-vitalicio" disabled={isSavingComissao} />
                <span className="text-sm text-gray-800">Vitalício (todas as mensalidades)</span>
              </label>
            </RadioGroup>
          </div>

          {comissaoError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{comissaoError}</p>
            </div>
          )}
          {comissaoMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-700">{comissaoMessage}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSaveComissao} disabled={isSavingComissao} size="sm">
              {isSavingComissao ? 'Salvando...' : 'Salvar comissões'}
            </Button>
          </div>
        </section>


        {/* ── Identidade Visual ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Identidade Visual</h2>
            <p className="mt-1 text-sm text-gray-500">Nome da marca e logo exibidos nas telas públicas e no app do cliente.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-500">Prévia</p>
              <div className="flex min-h-20 items-center justify-center rounded-lg bg-white p-4">
                <BrandLogoImage branding={brandingPreview} width={420} height={136} className="max-h-14 w-auto" />
              </div>
              <p className="mt-2 text-xs text-gray-500">{brandingPreview.brandName}</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nome da marca</label>
                  <input
                    type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Nome da marca"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    disabled={isSavingBranding}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nome curto</label>
                  <input
                    type="text" value={brandShortName} onChange={(e) => setBrandShortName(e.target.value)}
                    placeholder="Marca"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    disabled={isSavingBranding}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">URL da logo</label>
                <input
                  type="text" value={brandLogoUrl} onChange={(e) => setBrandLogoUrl(e.target.value)}
                  placeholder="/logo-cliente.png"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={isSavingBranding}
                />
                <p className="mt-1 text-xs text-gray-400">Caminho do public/ ou URL http/https.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Texto alternativo da logo</label>
                <input
                  type="text" value={brandLogoAlt} onChange={(e) => setBrandLogoAlt(e.target.value)}
                  placeholder="Logo da marca"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={isSavingBranding}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Slogan do App</label>
                <input
                  type="text" value={appTagline} onChange={(e) => setAppTagline(e.target.value)}
                  placeholder="Sua saúde completa e segura"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={isSavingBranding}
                />
              </div>

              {brandingError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">{brandingError}</p>
                </div>
              )}
              {brandingMessage && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm text-green-700">{brandingMessage}</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveBranding} disabled={isSavingBranding} size="sm">
                  {isSavingBranding ? 'Salvando...' : 'Salvar Identidade Visual'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Configurações Operacionais ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Configurações Operacionais</h2>
            <p className="mt-1 text-sm text-gray-500">Telefone de emergência e WhatsApp exibidos no app do cliente.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Telefone de Emergência</label>
            <input
              type="text" value={telefoneEmergencia} onChange={(e) => setTelefoneEmergencia(e.target.value)}
              placeholder="(85) 3000-0000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={isSavingOperacional}
            />
            <p className="mt-1 text-xs text-gray-400">Exibido na tela do cliente com botão "Ligar".</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Link do WhatsApp</label>
            <input
              type="url" value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)}
              placeholder="https://wa.me/5585999999999"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={isSavingOperacional}
            />
            <p className="mt-1 text-xs text-gray-400">Formato: https://wa.me/55DDD999999999</p>
          </div>

          {operacionalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{operacionalError}</p>
            </div>
          )}
          {operacionalMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-700">{operacionalMessage}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSaveOperacional} disabled={isSavingOperacional} size="sm">
              {isSavingOperacional ? 'Salvando...' : 'Salvar Configurações Operacionais'}
            </Button>
          </div>
        </section>

      </div>
    </main>
  )
}
