'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClienteNav } from '@/components/cliente/cliente-nav'
import { ClienteScreenHeader } from '@/components/cliente/screen-header'
import { clienteColors, clienteRadius } from '@/lib/cliente-ui'

type CadastroForm = {
  nome: string
  email: string
  telefone: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  cpf: string // readonly
}

type DependenteConta = {
  nome: string
  cpf: string
  email?: string | null
  telefone?: string | null
  data_nascimento?: string | null
  relacao?: string | null
  sexo?: string | null
}

type PlanoResumo = {
  nome: string
  status: string
}

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
]

function formatCPF(cpf: string) {
  const clean = cpf.replace(/\D/g, '').slice(0, 11)
  return clean
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatCEP(cep: string) {
  return cep.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

function formatTelefone(tel: string) {
  const clean = tel.replace(/\D/g, '').slice(0, 11)
  if (clean.length <= 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '')
  }
  return clean.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '')
}

function formatDate(date?: string | null) {
  if (!date) return 'Não informado'
  const [year, month, day] = date.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : date
}

export default function ClienteConta() {
  const router = useRouter()
  const [form, setForm] = useState<CadastroForm>({
    nome: '', email: '', telefone: '', endereco: '', numero: '',
    complemento: '', bairro: '', cidade: '', estado: '', cep: '', cpf: '',
  })
  const [nomeCliente, setNomeCliente] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDependente, setIsDependente] = useState(false)
  const [dependente, setDependente] = useState<DependenteConta | null>(null)
  const [plano, setPlano] = useState<PlanoResumo | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/cliente/me')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      if (!res.ok) { return }

      const c = data.cadastro
      const u = data.usuario
      const usuarioIsDependente = u?.tipo === 'dependente'
      setNomeCliente(u?.nome || c?.nome || '')
      setIsDependente(usuarioIsDependente)
      setDependente(usuarioIsDependente ? u : null)
      setPlano({ nome: c?.tipo_plano || 'Plano do titular', status: c?.status || 'ATIVO' })
      setForm({
        nome: usuarioIsDependente ? u?.nome || '' : c.nome || '',
        email: usuarioIsDependente ? u?.email || '' : c.email || '',
        telefone: usuarioIsDependente ? u?.telefone || '' : c.telefone || '',
        endereco: c.endereco || '',
        numero: c.numero || '',
        complemento: c.complemento || '',
        bairro: c.bairro || '',
        cidade: c.cidade || '',
        estado: c.estado || '',
        cep: c.cep || '',
        cpf: usuarioIsDependente ? u?.cpf || '' : c.cpf || '',
      })
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const handleChange = (field: keyof CadastroForm, value: string) => {
    setSuccessMessage('')
    setErrorMessage('')
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const res = await fetch('/api/cliente/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
          endereco: form.endereco,
          numero: form.numero,
          complemento: form.complemento,
          bairro: form.bairro,
          cidade: form.cidade,
          estado: form.estado,
          cep: form.cep,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error || 'Erro ao salvar.')
      } else {
        setSuccessMessage('Dados atualizados com sucesso!')
        setNomeCliente(form.nome)
      }
    } catch {
      setErrorMessage('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: clienteColors.background }}>
        <p style={{ color: clienteColors.textMuted }}>Carregando...</p>
      </div>
    )
  }

  return (
    <ClienteNav nomeCliente={nomeCliente} usuarioTipo={isDependente ? 'dependente' : 'titular'}>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <ClienteScreenHeader
          title="Minha Conta"
          subtitle={isDependente ? 'Consulte seus dados e as informações do plano' : 'Atualize seus dados pessoais e de contato'}
        />

        {isDependente ? (
          <div className="space-y-4">
            <section
              className="rounded-2xl border p-5"
              style={{ backgroundColor: `${clienteColors.primary}08`, borderColor: clienteColors.borderMint }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
                    Meu plano
                  </p>
                  <h2 className="mt-1 text-lg font-bold" style={{ color: clienteColors.text }}>
                    {plano?.nome || 'Plano do titular'}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: clienteColors.textMuted }}>
                    Você está vinculado como dependente deste plano.
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: '#D1FAE5', color: clienteColors.success }}
                >
                  {plano?.status || 'ATIVO'}
                </span>
              </div>
            </section>

            <section
              className="rounded-2xl border p-5"
              style={{ backgroundColor: clienteColors.surface, borderColor: clienteColors.border }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
                  Meus dados
                </p>
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: clienteColors.textMuted }}>
                  <Lock className="h-3.5 w-3.5" />
                  Somente leitura
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {[
                  ['Nome completo', dependente?.nome || 'Não informado'],
                  ['CPF', formatCPF(dependente?.cpf || '') || 'Não informado'],
                  ['Data de nascimento', formatDate(dependente?.data_nascimento)],
                  ['Relação', dependente?.relacao || 'Não informado'],
                  ['E-mail', dependente?.email || 'Não informado'],
                  ['Telefone', dependente?.telefone ? formatTelefone(dependente.telefone) : 'Não informado'],
                  ['Sexo', dependente?.sexo || 'Não informado'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium" style={{ color: clienteColors.textMuted }}>{label}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold" style={{ color: clienteColors.text }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <p className="px-1 text-xs leading-5" style={{ color: clienteColors.textMuted }}>
              Para corrigir algum dado, solicite a alteração ao titular do plano ou entre em contato com o suporte.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* CPF — readonly */}
            <div
              className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ backgroundColor: `${clienteColors.primary}08`, borderColor: clienteColors.borderMint }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
                  CPF (não editável)
                </p>
                <p className="mt-0.5 font-mono font-semibold" style={{ color: clienteColors.text }}>
                  {formatCPF(form.cpf)}
                </p>
              </div>
              <Lock className="h-4 w-4" style={{ color: clienteColors.textMuted }} />
            </div>

            {/* Dados pessoais */}
            <div
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: clienteColors.surface, borderColor: clienteColors.border }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
                Dados pessoais
              </p>
              <div>
                <Label htmlFor="nome" className="text-sm" style={{ color: clienteColors.text }}>Nome completo</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => handleChange('nome', e.target.value)}
                  className="mt-1.5 h-11"
                  required
                  minLength={3}
                  style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="email" className="text-sm" style={{ color: clienteColors.text }}>E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="mt-1.5 h-11"
                    style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                  />
                </div>
                <div>
                  <Label htmlFor="telefone" className="text-sm" style={{ color: clienteColors.text }}>Telefone</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    value={form.telefone}
                    onChange={(e) => handleChange('telefone', formatTelefone(e.target.value))}
                    className="mt-1.5 h-11"
                    placeholder="(85) 99999-0000"
                    style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: clienteColors.surface, borderColor: clienteColors.border }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
                Endereço
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="endereco" className="text-sm" style={{ color: clienteColors.text }}>Rua / Logradouro</Label>
                  <Input
                    id="endereco"
                    value={form.endereco}
                    onChange={(e) => handleChange('endereco', e.target.value)}
                    className="mt-1.5 h-11"
                    style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                  />
                </div>
                <div>
                  <Label htmlFor="numero" className="text-sm" style={{ color: clienteColors.text }}>Número</Label>
                  <Input
                    id="numero"
                    value={form.numero}
                    onChange={(e) => handleChange('numero', e.target.value)}
                    className="mt-1.5 h-11"
                    style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="complemento" className="text-sm" style={{ color: clienteColors.text }}>Complemento</Label>
                <Input
                  id="complemento"
                  value={form.complemento}
                  onChange={(e) => handleChange('complemento', e.target.value)}
                  className="mt-1.5 h-11"
                  placeholder="Apto, bloco, sala... (opcional)"
                  style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="bairro" className="text-sm" style={{ color: clienteColors.text }}>Bairro</Label>
                  <Input
                    id="bairro"
                    value={form.bairro}
                    onChange={(e) => handleChange('bairro', e.target.value)}
                    className="mt-1.5 h-11"
                    style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                  />
                </div>
                <div>
                  <Label htmlFor="cidade" className="text-sm" style={{ color: clienteColors.text }}>Cidade</Label>
                  <Input
                    id="cidade"
                    value={form.cidade}
                    onChange={(e) => handleChange('cidade', e.target.value)}
                    className="mt-1.5 h-11"
                    style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                  />
                </div>
                <div>
                  <Label htmlFor="estado" className="text-sm" style={{ color: clienteColors.text }}>Estado</Label>
                  <select
                    id="estado"
                    value={form.estado}
                    onChange={(e) => handleChange('estado', e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-md border px-3 text-sm"
                    style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md, color: clienteColors.text }}
                  >
                    <option value="">UF</option>
                    {ESTADOS.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="max-w-[180px]">
                <Label htmlFor="cep" className="text-sm" style={{ color: clienteColors.text }}>CEP</Label>
                <Input
                  id="cep"
                  value={form.cep}
                  onChange={(e) => handleChange('cep', formatCEP(e.target.value))}
                  className="mt-1.5 h-11"
                  placeholder="00000-000"
                  maxLength={9}
                  style={{ borderColor: clienteColors.border, borderRadius: clienteRadius.md }}
                />
              </div>
            </div>

            {/* Feedback */}
            {successMessage && (
              <div
                className="rounded-xl border px-4 py-3 text-sm font-medium"
                style={{ backgroundColor: '#D1FAE5', borderColor: '#6EE7B7', color: '#065F46' }}
              >
                ✓ {successMessage}
              </div>
            )}
            {errorMessage && (
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: clienteColors.danger }}
              >
                {errorMessage}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSaving}
              className="flex h-12 w-full items-center justify-center gap-2 text-base font-bold"
              style={{
                backgroundColor: clienteColors.primary,
                color: clienteColors.surface,
                borderRadius: clienteRadius.full,
              }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        )}
      </div>
    </ClienteNav>
  )
}
