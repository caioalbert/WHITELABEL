'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Menu, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const ESCOLARIDADE_OPTIONS = [
  'Ensino Fundamental - Incompleto',
  'Ensino Fundamental - Completo',
  'Ensino Médio - Incompleto',
  'Ensino Médio - Completo',
  'Ensino Superior - Incompleto',
  'Ensino Superior - Completo',
]

const ESTADOS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

type FormData = {
  nome: string
  email: string
  cpf: string
  rg: string
  data_nascimento: string
  telefone: string
  sexo: string
  estado_civil: string
  nome_conjuge: string
  escolaridade: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

const EMPTY_FORM: FormData = {
  nome: '',
  email: '',
  cpf: '',
  rg: '',
  data_nascimento: '',
  telefone: '',
  sexo: '',
  estado_civil: '',
  nome_conjuge: '',
  escolaridade: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
}

function normalizeDateInput(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  return value.slice(0, 10)
}

export default function AdminCadastroEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCadastro = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/admin/cadastro/${id}`)
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/admin/login')
            return
          }
          throw new Error('Cliente não encontrado')
        }

        const data = await response.json()
        const cadastro = data.cadastro || {}

        setForm({
          nome: cadastro.nome || '',
          email: cadastro.email || '',
          cpf: cadastro.cpf || '',
          rg: cadastro.rg || '',
          data_nascimento: normalizeDateInput(cadastro.data_nascimento),
          telefone: cadastro.telefone || '',
          sexo: cadastro.sexo || '',
          estado_civil: cadastro.estado_civil || '',
          nome_conjuge: cadastro.nome_conjuge || '',
          escolaridade: cadastro.escolaridade || '',
          endereco: cadastro.endereco || '',
          numero: cadastro.numero || '',
          complemento: cadastro.complemento || '',
          bairro: cadastro.bairro || '',
          cidade: cadastro.cidade || '',
          estado: cadastro.estado || '',
          cep: cadastro.cep || '',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar cliente')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCadastro()
  }, [id, router])

  const requiredFieldsFilled = useMemo(
    () =>
      Boolean(
        form.nome.trim() &&
          form.email.trim() &&
          form.cpf.trim() &&
          form.rg.trim() &&
          form.data_nascimento.trim() &&
          form.telefone.trim() &&
          form.sexo.trim() &&
          form.estado_civil.trim() &&
          form.escolaridade.trim() &&
          form.endereco.trim() &&
          form.numero.trim() &&
          form.bairro.trim() &&
          form.cidade.trim() &&
          form.estado.trim() &&
          form.cep.trim() &&
          (form.estado_civil !== 'Casado(a)' || form.nome_conjuge.trim())
      ),
    [form]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'estado_civil' && value !== 'Casado(a)' ? { nome_conjuge: '' } : {}),
    }))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!requiredFieldsFilled) {
      setError('Preencha todos os campos obrigatórios antes de salvar.')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch(`/api/admin/cadastro/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error(data.error || 'Erro ao atualizar cliente')
      }

      router.push(`/admin/cliente/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar cliente')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-gray-600">Carregando cliente...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">Editar Cliente</h1>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/admin/clientes">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <Button onClick={handleSubmit} disabled={isSaving || !requiredFieldsFilled} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando...' : 'Salvar'}
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
                  <SheetTitle>Menu Edição</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start gap-2">
                      <Link href="/admin/clientes">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar
                      </Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSaving || !requiredFieldsFilled}
                      className="w-full justify-start gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Dados Pessoais</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" name="nome" value={form.nome} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input id="cpf" name="cpf" value={form.cpf} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="rg">RG *</Label>
                <Input id="rg" name="rg" value={form.rg} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="data_nascimento">Data de Nascimento *</Label>
                <Input
                  id="data_nascimento"
                  name="data_nascimento"
                  type="date"
                  value={form.data_nascimento}
                  onChange={handleChange}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input id="telefone" name="telefone" value={form.telefone} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="sexo">Sexo *</Label>
                <select id="sexo" name="sexo" value={form.sexo} onChange={handleChange} required className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2">
                  <option value="">Selecione...</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <Label htmlFor="estado_civil">Estado Civil *</Label>
                <select
                  id="estado_civil"
                  name="estado_civil"
                  value={form.estado_civil}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Selecione...</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </div>

              {form.estado_civil === 'Casado(a)' && (
                <div className="sm:col-span-2">
                  <Label htmlFor="nome_conjuge">Nome do Cônjuge *</Label>
                  <Input
                    id="nome_conjuge"
                    name="nome_conjuge"
                    value={form.nome_conjuge}
                    onChange={handleChange}
                    required
                    className="mt-2"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="escolaridade">Escolaridade *</Label>
                <select
                  id="escolaridade"
                  name="escolaridade"
                  value={form.escolaridade}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Selecione...</option>
                  {ESCOLARIDADE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Endereço</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="endereco">Endereço *</Label>
                <Input id="endereco" name="endereco" value={form.endereco} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="numero">Número *</Label>
                <Input id="numero" name="numero" value={form.numero} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" name="complemento" value={form.complemento} onChange={handleChange} className="mt-2" />
              </div>

              <div>
                <Label htmlFor="bairro">Bairro *</Label>
                <Input id="bairro" name="bairro" value={form.bairro} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="cidade">Cidade *</Label>
                <Input id="cidade" name="cidade" value={form.cidade} onChange={handleChange} required className="mt-2" />
              </div>

              <div>
                <Label htmlFor="estado">Estado *</Label>
                <select
                  id="estado"
                  name="estado"
                  value={form.estado}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Selecione...</option>
                  {ESTADOS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="cep">CEP *</Label>
                <Input id="cep" name="cep" value={form.cep} onChange={handleChange} required className="mt-2" />
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}
