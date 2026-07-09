'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { BrandLogoImage } from '@/components/brand-logo'
import { isSupportedBrandLogoUrl, normalizeBranding } from '@/lib/branding'

type BillingType = 'BOLETO' | 'CREDIT_CARD'
type PlanType = 'INDIVIDUAL' | 'FAMILIAR'
const MIN_CHARGE_VALUE = 5

const BILLING_TYPE_LABEL: Record<BillingType, string> = {
  BOLETO: 'BolePIX',
  CREDIT_CARD: 'Cartão de Crédito',
}

function normalizeBillingType(value: unknown): BillingType | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'CREDIT_CARD') {
    return 'CREDIT_CARD'
  }

  if (normalized === 'BOLETO' || normalized === 'PIX') {
    return 'BOLETO'
  }

  return null
}

function normalizeBillingTypeList(values: unknown): BillingType[] {
  if (!Array.isArray(values)) {
    return []
  }

  return Array.from(
    new Set(values.map((value) => normalizeBillingType(value)).filter((value): value is BillingType => Boolean(value)))
  )
}

export default function AdminCobrancaConfiguracoesPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allowedBillingTypes, setAllowedBillingTypes] = useState<BillingType[]>(['BOLETO', 'CREDIT_CARD'])
  const [mensalidadeIndividualValue, setMensalidadeIndividualValue] = useState('')
  const [mensalidadeFamiliarValue, setMensalidadeFamiliarValue] = useState('')
  const [defaultPlanType, setDefaultPlanType] = useState<PlanType>('INDIVIDUAL')
  const [mensalidadeBillingTypes, setMensalidadeBillingTypes] = useState<BillingType[]>(['BOLETO', 'CREDIT_CARD'])
  const [defaultMensalidadeBillingType, setDefaultMensalidadeBillingType] = useState<BillingType>('BOLETO')
  const [source, setSource] = useState<string | null>(null)
  // Commission state
  const [comissaoPercentualAdesao, setComissaoPercentualAdesao] = useState('')
  const [comissaoPercentualMensalidade, setComissaoPercentualMensalidade] = useState('')
  // 'primeiro' = apenas 1ª, 'custom' = número, 'vitalicio' = null
  type ComissaoModo = 'primeiro' | 'custom' | 'vitalicio'
  const [comissaoModo, setComissaoModo] = useState<ComissaoModo>('vitalicio')
  const [comissaoMensalidadesMaxCustom, setComissaoMensalidadesMaxCustom] = useState('12')
  const [isSavingComissao, setIsSavingComissao] = useState(false)
  const [comissaoMessage, setComissaoMessage] = useState<string | null>(null)
  const [comissaoError, setComissaoError] = useState<string | null>(null)
  // Configurações operacionais
  const [telefoneEmergencia, setTelefoneEmergencia] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [appTagline, setAppTagline] = useState('')
  const [isSavingOperacional, setIsSavingOperacional] = useState(false)
  const [operacionalMessage, setOperacionalMessage] = useState<string | null>(null)
  const [operacionalError, setOperacionalError] = useState<string | null>(null)
  // Identidade visual whitelabel
  const [brandName, setBrandName] = useState('')
  const [brandShortName, setBrandShortName] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandLogoAlt, setBrandLogoAlt] = useState('')
  const [isSavingBranding, setIsSavingBranding] = useState(false)
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null)
  const [brandingError, setBrandingError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      setMessage(null)

      const response = await fetch('/api/admin/cobranca-configuracoes')
      const data = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao carregar configurações de cobrança.')
      }

      const types = normalizeBillingTypeList(data?.settings?.mensalidadeBillingTypes)
      const effectiveTypes: BillingType[] =
        types.length > 0 ? types : ['BOLETO', 'CREDIT_CARD']
      const allowedTypes = normalizeBillingTypeList(data?.allowedBillingTypes)
      const effectiveAllowedTypes: BillingType[] =
        allowedTypes.length > 0 ? allowedTypes : ['BOLETO', 'CREDIT_CARD']
      setAllowedBillingTypes(effectiveAllowedTypes)
      setMensalidadeIndividualValue(
        String(data?.settings?.mensalidadeIndividualValue ?? data?.settings?.mensalidadeValue ?? '')
      )
      setMensalidadeFamiliarValue(
        String(data?.settings?.mensalidadeFamiliarValue ?? data?.settings?.mensalidadeValue ?? '')
      )
      setDefaultPlanType(data?.settings?.defaultPlanType || 'INDIVIDUAL')
      setMensalidadeBillingTypes(effectiveTypes)
      const requestedDefault = normalizeBillingType(data?.settings?.defaultMensalidadeBillingType)
      setDefaultMensalidadeBillingType(
        requestedDefault && effectiveTypes.includes(requestedDefault)
          ? requestedDefault
          : effectiveTypes[0]
      )
      setSource(data?.settings?.source || null)

      // Load commission values
      const pctAdesao = data?.settings?.comissaoPercentualAdesao
      const pctMensalidade = data?.settings?.comissaoPercentualMensalidade
      const maxMensalidades = data?.settings?.comissaoMensalidadesMax
      setComissaoPercentualAdesao(pctAdesao !== undefined && pctAdesao !== null ? String(pctAdesao) : '0')
      setComissaoPercentualMensalidade(pctMensalidade !== undefined && pctMensalidade !== null ? String(pctMensalidade) : '0')
      if (maxMensalidades === null || maxMensalidades === undefined) {
        setComissaoModo('vitalicio')
      } else if (Number(maxMensalidades) === 1) {
        setComissaoModo('primeiro')
      } else {
        setComissaoModo('custom')
        setComissaoMensalidadesMaxCustom(String(maxMensalidades))
      }
      // Configurações operacionais
      setTelefoneEmergencia(data?.settings?.telefoneEmergencia || '')
      setWhatsappUrl(data?.settings?.whatsappUrl || '')
      setAppTagline(data?.settings?.appTagline || '')
      // Identidade visual
      setBrandName(data?.settings?.brandName || '')
      setBrandShortName(data?.settings?.brandShortName || '')
      setBrandLogoUrl(data?.settings?.brandLogoUrl || '')
      setBrandLogoAlt(data?.settings?.brandLogoAlt || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações de cobrança.')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const sortedSelectedTypes = useMemo(
    () => allowedBillingTypes.filter((type) => mensalidadeBillingTypes.includes(type)),
    [allowedBillingTypes, mensalidadeBillingTypes]
  )
  const brandingPreview = useMemo(
    () => normalizeBranding({ brandName, brandShortName, brandLogoUrl, brandLogoAlt, appTagline }),
    [appTagline, brandLogoAlt, brandLogoUrl, brandName, brandShortName]
  )

  const handleToggleBillingType = (billingType: BillingType, checked: boolean) => {
    setError(null)
    setMessage(null)

    if (checked) {
      setMensalidadeBillingTypes((prev) => {
        if (prev.includes(billingType)) return prev
        return [...prev, billingType]
      })

      if (!mensalidadeBillingTypes.includes(defaultMensalidadeBillingType)) {
        setDefaultMensalidadeBillingType(billingType)
      }
      return
    }

    setMensalidadeBillingTypes((prev) => {
      const next = prev.filter((type) => type !== billingType)
      if (next.length === 0) {
        return prev
      }

      if (!next.includes(defaultMensalidadeBillingType)) {
        setDefaultMensalidadeBillingType(next[0])
      }
      return next
    })
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      if (mensalidadeBillingTypes.length === 0) {
        throw new Error('Selecione ao menos uma forma de cobrança de mensalidade.')
      }

      const individualValue = Number(mensalidadeIndividualValue)
      const familiarValue = Number(mensalidadeFamiliarValue)

      if (!Number.isFinite(individualValue) || !Number.isFinite(familiarValue)) {
        throw new Error('Informe valores numéricos válidos para os planos.')
      }

      if (individualValue < MIN_CHARGE_VALUE || familiarValue < MIN_CHARGE_VALUE) {
        throw new Error(
          `O valor mínimo permitido pelo Asaas é R$ ${MIN_CHARGE_VALUE.toFixed(2).replace('.', ',')}.`
        )
      }

      const response = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensalidadeIndividualValue: individualValue,
          mensalidadeFamiliarValue: familiarValue,
          mensalidadeBillingTypes,
          defaultMensalidadeBillingType,
          defaultPlanType,
        }),
      })

      const data = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar configurações de cobrança.')
      }

      setMessage(data?.message || 'Configurações salvas com sucesso.')
      setSource(data?.settings?.source || null)
      setMensalidadeIndividualValue(
        String(data?.settings?.mensalidadeIndividualValue ?? mensalidadeIndividualValue)
      )
      setMensalidadeFamiliarValue(
        String(data?.settings?.mensalidadeFamiliarValue ?? mensalidadeFamiliarValue)
      )
      setDefaultPlanType(data?.settings?.defaultPlanType || defaultPlanType)
      const nextTypes = normalizeBillingTypeList(data?.settings?.mensalidadeBillingTypes)
      const effectiveTypes: BillingType[] = nextTypes.length > 0 ? nextTypes : mensalidadeBillingTypes
      const requestedDefault = normalizeBillingType(data?.settings?.defaultMensalidadeBillingType)
      setMensalidadeBillingTypes(effectiveTypes)
      setDefaultMensalidadeBillingType(
        requestedDefault && effectiveTypes.includes(requestedDefault)
          ? requestedDefault
          : effectiveTypes[0]
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações de cobrança.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveComissao = async () => {
    try {
      setIsSavingComissao(true)
      setComissaoError(null)
      setComissaoMessage(null)

      const pctAdesao = Number(comissaoPercentualAdesao)
      const pctMensalidade = Number(comissaoPercentualMensalidade)

      if (!Number.isFinite(pctAdesao) || pctAdesao < 0 || pctAdesao > 100) {
        throw new Error('% sobre adesão deve ser entre 0 e 100.')
      }
      if (!Number.isFinite(pctMensalidade) || pctMensalidade < 0 || pctMensalidade > 100) {
        throw new Error('% sobre mensalidade deve ser entre 0 e 100.')
      }

      let comissaoMensalidadesMax: number | null
      if (comissaoModo === 'vitalicio') {
        comissaoMensalidadesMax = null
      } else if (comissaoModo === 'primeiro') {
        comissaoMensalidadesMax = 1
      } else {
        const customVal = Number(comissaoMensalidadesMaxCustom)
        if (!Number.isFinite(customVal) || customVal < 1 || !Number.isInteger(customVal)) {
          throw new Error('Informe um número inteiro maior ou igual a 1.')
        }
        comissaoMensalidadesMax = customVal
      }

      const response = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comissaoPercentualAdesao: pctAdesao,
          comissaoPercentualMensalidade: pctMensalidade,
          comissaoMensalidadesMax,
        }),
      })

      const data = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar configurações de comissão.')
      }

      setComissaoMessage(data?.message || 'Configurações de comissão salvas com sucesso.')
    } catch (err) {
      setComissaoError(err instanceof Error ? err.message : 'Erro ao salvar configurações de comissão.')
    } finally {
      setIsSavingComissao(false)
    }
  }

  const handleSaveOperacional = async () => {
    try {
      setIsSavingOperacional(true)
      setOperacionalError(null)
      setOperacionalMessage(null)

      const response = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefoneEmergencia, whatsappUrl, appTagline }),
      })

      const data = await response.json().catch(() => null)

      if (response.status === 401) { router.push('/admin/login'); return }
      if (!response.ok) throw new Error(data?.error || 'Erro ao salvar.')

      setOperacionalMessage('Configurações operacionais salvas com sucesso.')
    } catch (err) {
      setOperacionalError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setIsSavingOperacional(false)
    }
  }

  const handleSaveBranding = async () => {
    try {
      setIsSavingBranding(true)
      setBrandingError(null)
      setBrandingMessage(null)

      const normalizedName = brandName.trim()
      if (!normalizedName) {
        throw new Error('Informe o nome da marca.')
      }

      if (!isSupportedBrandLogoUrl(brandLogoUrl)) {
        throw new Error('Informe uma URL de logo válida começando com /, http:// ou https://.')
      }

      const response = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: normalizedName,
          brandShortName: brandShortName.trim(),
          brandLogoUrl: brandLogoUrl.trim(),
          brandLogoAlt: brandLogoAlt.trim(),
        }),
      })

      const data = await response.json().catch(() => null)

      if (response.status === 401) { router.push('/admin/login'); return }
      if (!response.ok) throw new Error(data?.error || 'Erro ao salvar identidade visual.')

      setBrandName(data?.settings?.brandName || normalizedName)
      setBrandShortName(data?.settings?.brandShortName || brandShortName.trim())
      setBrandLogoUrl(data?.settings?.brandLogoUrl || brandLogoUrl.trim())
      setBrandLogoAlt(data?.settings?.brandLogoAlt || brandLogoAlt.trim())
      setBrandingMessage('Identidade visual salva com sucesso.')
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : 'Erro ao salvar identidade visual.')
    } finally {
      setIsSavingBranding(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Configurações de Cobrança</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Defina formas e opção padrão de cobrança da mensalidade</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/admin/dashboard">
              <Button variant="outline">Voltar ao Dashboard</Button>
            </Link>
            <Link href="/admin/configuracoes">
              <Button variant="outline">Configurações</Button>
            </Link>
            <Button onClick={handleLogout} variant="outline">
              Sair
            </Button>
          </div>

          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu Cobrança</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/dashboard">Voltar ao Dashboard</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/configuracoes">Configurações</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button onClick={handleLogout} variant="outline" className="w-full justify-start">
                      Sair
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow space-y-6">
          {isLoading ? (
            <p className="text-sm text-gray-600">Carregando configurações...</p>
          ) : (
            <>
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-800">Formas de cobrança da mensalidade</p>
                <p className="text-xs text-gray-600">
                  Se houver mais de uma opção marcada, o cliente escolherá no fim da adesão.
                </p>

                <div className="space-y-2">
                  {allowedBillingTypes.map((billingType) => (
                    <label key={billingType} className="flex items-center gap-3">
                      <Checkbox
                        checked={mensalidadeBillingTypes.includes(billingType)}
                        onCheckedChange={(value) =>
                          handleToggleBillingType(billingType, value === true)
                        }
                        disabled={isSaving}
                      />
                      <span className="text-sm text-gray-800">{BILLING_TYPE_LABEL[billingType]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-800">Opção padrão</p>
                <RadioGroup
                  value={defaultMensalidadeBillingType}
                  onValueChange={(value) =>
                    setDefaultMensalidadeBillingType(value as BillingType)
                  }
                  className="space-y-2"
                >
                  {sortedSelectedTypes.map((billingType) => (
                    <label key={billingType} className="flex items-center gap-3">
                      <RadioGroupItem value={billingType} id={`default-${billingType}`} disabled={isSaving} />
                      <span className="text-sm text-gray-800">{BILLING_TYPE_LABEL[billingType]}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {source && (
                <p className="text-xs text-gray-500">
                  Fonte atual: {source === 'database' ? 'Banco (admin)' : 'Variáveis de ambiente (fallback)'}
                </p>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {message && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm text-green-700">{message}</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                  {isSaving ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>

              {/* ── Seção: Configuração de Comissões dos Vendedores ── */}
              <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Configuração de Comissões dos Vendedores</p>
                  <p className="text-xs text-gray-500 mt-1">Defina os percentuais e a vigência das comissões pagas aos vendedores.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">% de comissão sobre adesão</span>
                    <div className="flex items-center gap-2">
                      <input
                        id="comissao-pct-adesao"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={comissaoPercentualAdesao}
                        onChange={(e) => setComissaoPercentualAdesao(e.target.value)}
                        className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        disabled={isSavingComissao}
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">% de comissão sobre mensalidade</span>
                    <div className="flex items-center gap-2">
                      <input
                        id="comissao-pct-mensalidade"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={comissaoPercentualMensalidade}
                        onChange={(e) => setComissaoPercentualMensalidade(e.target.value)}
                        className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        disabled={isSavingComissao}
                      />
                      <span className="text-sm text-gray-600">%</span>
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
                      <RadioGroupItem value="primeiro" id="comissao-modo-primeiro" disabled={isSavingComissao} />
                      <span className="text-sm text-gray-800">Apenas a 1ª mensalidade</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <RadioGroupItem value="custom" id="comissao-modo-custom" disabled={isSavingComissao} />
                      <span className="text-sm text-gray-800">Número customizado de mensalidades</span>
                    </label>
                    {comissaoModo === 'custom' && (
                      <div className="ml-7 flex items-center gap-2">
                        <input
                          id="comissao-mensalidades-max-custom"
                          type="number"
                          min={1}
                          step={1}
                          value={comissaoMensalidadesMaxCustom}
                          onChange={(e) => setComissaoMensalidadesMaxCustom(e.target.value)}
                          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                          disabled={isSavingComissao}
                        />
                        <span className="text-sm text-gray-600">mensalidade(s)</span>
                      </div>
                    )}
                    <label className="flex items-center gap-3">
                      <RadioGroupItem value="vitalicio" id="comissao-modo-vitalicio" disabled={isSavingComissao} />
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
                  <Button onClick={handleSaveComissao} disabled={isSavingComissao || isLoading}>
                    {isSavingComissao ? 'Salvando...' : 'Salvar Configurações de Comissão'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── IDENTIDADE VISUAL ── */}
        <div id="identidade-visual" className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Identidade Visual</h2>
          <p className="mt-1 text-sm text-gray-500">Nome da marca e logo exibidos nas telas públicas e no app do cliente.</p>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-500">Prévia</p>
              <div className="flex min-h-24 items-center justify-center rounded-lg bg-white p-4">
                <BrandLogoImage branding={brandingPreview} width={420} height={136} className="max-h-16 w-auto" />
              </div>
              <p className="mt-3 text-xs text-gray-500">{brandingPreview.brandName}</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nome da marca
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Nome da marca"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isSavingBranding}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nome curto
                  </label>
                  <input
                    type="text"
                    value={brandShortName}
                    onChange={(e) => setBrandShortName(e.target.value)}
                    placeholder="Marca"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isSavingBranding}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  URL ou caminho da logo
                </label>
                <input
                  type="text"
                  value={brandLogoUrl}
                  onChange={(e) => setBrandLogoUrl(e.target.value)}
                  placeholder="/logo-cliente.png"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSavingBranding}
                />
                <p className="mt-1 text-xs text-gray-400">Use um caminho do public, como /logo-cliente.png, ou uma URL http/https.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Texto alternativo da logo
                </label>
                <input
                  type="text"
                  value={brandLogoAlt}
                  onChange={(e) => setBrandLogoAlt(e.target.value)}
                  placeholder="Logo da marca"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <Button onClick={handleSaveBranding} disabled={isSavingBranding || isLoading}>
                  {isSavingBranding ? 'Salvando...' : 'Salvar Identidade Visual'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONFIGURAÇÕES OPERACIONAIS ── */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Configurações Operacionais</h2>
          <p className="mt-1 text-sm text-gray-500">Telefone de emergência, WhatsApp e slogan exibidos no app do cliente.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Telefone de Emergência
              </label>
              <input
                type="text"
                value={telefoneEmergencia}
                onChange={(e) => setTelefoneEmergencia(e.target.value)}
                placeholder="(85) 3000-0000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">Exibido na tela do cliente com botão "Ligar".</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Link do WhatsApp
              </label>
              <input
                type="url"
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
                placeholder="https://wa.me/5585999999999"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">Formato: https://wa.me/55DDD999999999 (sem espaços ou traços).</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Slogan do App
              </label>
              <input
                type="text"
                value={appTagline}
                onChange={(e) => setAppTagline(e.target.value)}
                placeholder="Sua saúde completa e segura"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">Texto exibido abaixo do logo na tela do cliente.</p>
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
              <Button onClick={handleSaveOperacional} disabled={isSavingOperacional || isLoading}>
                {isSavingOperacional ? 'Salvando...' : 'Salvar Configurações Operacionais'}
              </Button>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}
