'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HelpCircle, Lock, Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClienteScreenHeader } from '@/components/cliente/screen-header'
import { clienteColors, clienteCopy, clienteRadius, clienteSupport } from '@/lib/cliente-ui'

type Dependente = {
  id: string
  nome: string
  cpf: string
  data_nascimento: string
  relacao: string
  email?: string
  telefone_celular?: string
  sexo?: string
}

type Plano = {
  codigo: string
  nome: string
  permite_dependentes: boolean
  min_dependentes: number
  max_dependentes: number | null
}

const RELACOES = ['Cônjuge', 'Filho(a)', 'Pai/Mãe', 'Irmão(ã)', 'Outro']
const SEXOS = ['Masculino', 'Feminino']

export default function ClienteDependentes() {
  const router = useRouter()
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [plano, setPlano] = useState<Plano | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [canManage, setCanManage] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    data_nascimento: '',
    relacao: '',
    email: '',
    telefone_celular: '',
    sexo: '',
  })
  const [usuarioTipo, setUsuarioTipo] = useState<string | null>(null)

  const fetchPlano = useCallback(async () => {
    try {
      const response = await fetch('/api/cliente/plano')

      if (response.status === 401) {
        router.push('/login')
        return
      }

      const data = await response.json()
      if (response.ok) {
        setPlano(data.plano)
      }
    } catch {
      setPlano(null)
    }
  }, [router])

  const fetchDependentes = useCallback(async () => {
    try {
      const response = await fetch('/api/cliente/dependentes')

      if (response.status === 401) {
        router.push('/login')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao carregar dependentes')
        return
      }

      setDependentes(data.dependentes || [])
      setCanManage(data.canManage === true)
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchDependentes()
    fetchPlano()
  }, [fetchDependentes, fetchPlano])

  useEffect(() => {
    fetch('/api/cliente/me')
      .then((r) => r.json())
      .then((data) => setUsuarioTipo(data.usuario?.tipo || 'titular'))
      .catch(() => setUsuarioTipo('titular'))
  }, [])

  const canAdd = useMemo(() => {
    if (!canManage) return false
    if (!plano?.permite_dependentes) return false
    if (plano.max_dependentes === null) return true
    return dependentes.length < plano.max_dependentes
  }, [canManage, plano, dependentes.length])

  const handleAdd = () => {
    setEditingId(null)
    setFormData({
      nome: '',
      cpf: '',
      data_nascimento: '',
      relacao: '',
      email: '',
      telefone_celular: '',
      sexo: '',
    })
    setIsDialogOpen(true)
  }

  const handleEdit = (dependente: Dependente) => {
    setEditingId(dependente.id)
    setFormData({
      nome: dependente.nome,
      cpf: dependente.cpf,
      data_nascimento: dependente.data_nascimento,
      relacao: dependente.relacao,
      email: dependente.email || '',
      telefone_celular: dependente.telefone_celular || '',
      sexo: dependente.sexo || '',
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')

    try {
      const url = '/api/cliente/dependentes'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? { ...formData, id: editingId } : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao salvar dependente')
        return
      }

      setIsDialogOpen(false)
      fetchDependentes()
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este dependente?')) return

    try {
      const response = await fetch(`/api/cliente/dependentes?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Erro ao remover dependente')
        return
      }

      fetchDependentes()
    } catch {
      setError('Erro ao conectar com o servidor')
    }
  }

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    }
    return value
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR')

  const initials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: clienteColors.background }}>
        <p style={{ color: clienteColors.textMuted }}>Carregando...</p>
      </div>
    )
  }

  if (usuarioTipo === 'dependente') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: clienteColors.background }}>
        <div
          className="w-full max-w-md border p-8 text-center"
          style={{
            backgroundColor: clienteColors.surface,
            borderColor: clienteColors.border,
            borderRadius: clienteRadius.lg,
          }}
        >
          <Lock className="mx-auto h-12 w-12" style={{ color: clienteColors.border }} />
          <h2 className="mt-3 text-lg font-semibold" style={{ color: clienteColors.text }}>
            Acesso exclusivo do titular
          </h2>
          <p className="mt-2 text-sm" style={{ color: clienteColors.textMuted }}>
            Esta área é restrita ao titular do plano.
          </p>
          <Link href="/cliente/dashboard">
            <Button
              className="mt-4"
              style={{
                backgroundColor: clienteColors.primary,
                color: clienteColors.surface,
                borderRadius: clienteRadius.full,
              }}
            >
              Voltar ao início
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: clienteColors.background }}>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex justify-end">
          <Link href="/cliente/dashboard">
            <Button variant="outline" style={{ borderRadius: clienteRadius.full, borderColor: clienteColors.border }}>
              Voltar
            </Button>
          </Link>
        </div>

        <ClienteScreenHeader
          title={clienteCopy.modules.dependentes.title}
          subtitle={clienteCopy.modules.dependentes.subtitle}
        />

        {error ? (
          <div
            className="mb-4 border px-4 py-3 text-sm"
            style={{
              borderColor: '#FECACA',
              backgroundColor: '#FEF2F2',
              color: clienteColors.danger,
              borderRadius: clienteRadius.md,
            }}
          >
            {error}
          </div>
        ) : null}

        {plano === null ? (
          <div
            className="mb-4 border p-8 text-center"
            style={{
              backgroundColor: clienteColors.surface,
              borderColor: clienteColors.border,
              borderRadius: clienteRadius.lg,
            }}
          >
            <HelpCircle className="mx-auto h-12 w-12" style={{ color: clienteColors.border }} />
            <h2 className="mt-3 text-lg font-semibold" style={{ color: clienteColors.text }}>
              Plano não identificado
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: clienteColors.textMuted }}>
              Entre em contato com o suporte para mais informações.
            </p>
            <a
              href={clienteSupport.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: '#25D366' }}
            >
              Contatar suporte
            </a>
          </div>
        ) : null}

        {plano && !plano.permite_dependentes ? (
          <div
            className="mb-4 border p-8 text-center"
            style={{
              backgroundColor: clienteColors.surface,
              borderColor: clienteColors.border,
              borderRadius: clienteRadius.lg,
            }}
          >
            <Lock className="mx-auto h-12 w-12" style={{ color: clienteColors.border }} />
            <h2 className="mt-3 text-lg font-semibold" style={{ color: clienteColors.text }}>
              Seu plano não permite dependentes
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: clienteColors.textMuted }}>
              Faça upgrade para um plano familiar e adicione seus dependentes.
            </p>
            {canManage ? (
              <Button
                onClick={() => setShowUpgradeDialog(true)}
                className="mt-4 rounded-full px-6 py-3 text-base font-bold"
                style={{
                  backgroundColor: clienteColors.primary,
                  color: clienteColors.surface,
                  borderRadius: clienteRadius.full,
                }}
              >
                Fazer upgrade para plano familiar
              </Button>
            ) : null}
          </div>
        ) : null}

        {plano?.permite_dependentes ? (
          <>
            <div
              className="mb-4 flex items-start gap-2 border p-4"
              style={{
                backgroundColor: `${clienteColors.primary}10`,
                borderColor: clienteColors.borderMint,
                borderRadius: clienteRadius.md,
              }}
            >
              <Users className="mt-0.5 h-4 w-4 shrink-0" style={{ color: clienteColors.primary }} />
              <p className="text-sm leading-5" style={{ color: clienteColors.primary }}>
                <span className="font-semibold">{plano.nome}</span>
                {' - '}
                {dependentes.length}
                {plano.max_dependentes !== null ? ` de ${plano.max_dependentes}` : ''}
                {' dependente'}
                {dependentes.length !== 1 ? 's' : ''}
                {' cadastrado'}
                {dependentes.length !== 1 ? 's' : ''}
              </p>
            </div>

            {dependentes.length === 0 ? (
              <div
                className="border p-8 text-center"
                style={{
                  backgroundColor: clienteColors.surface,
                  borderColor: clienteColors.border,
                  borderRadius: clienteRadius.lg,
                }}
              >
                <Users className="mx-auto h-12 w-12" style={{ color: clienteColors.border }} />
                <h2 className="mt-3 text-lg font-semibold" style={{ color: clienteColors.text }}>
                  Nenhum dependente cadastrado
                </h2>
                <p className="mt-2 text-sm leading-6" style={{ color: clienteColors.textMuted }}>
                  {canManage
                    ? 'Adicione os membros da família ao seu plano.'
                    : 'Os dependentes vinculados ao plano aparecerão aqui.'}
                </p>
                {canManage ? (
                  <Button
                    onClick={handleAdd}
                    className="mt-4 rounded-full px-5"
                    style={{
                      backgroundColor: clienteColors.primary,
                      color: clienteColors.surface,
                      borderRadius: clienteRadius.full,
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar primeiro dependente
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {dependentes.map((dependente) => (
                  <div
                    key={dependente.id}
                    className="border p-4"
                    style={{
                      backgroundColor: clienteColors.surface,
                      borderColor: clienteColors.border,
                      borderRadius: clienteRadius.md,
                    }}
                  >
                    <div className="mb-4 flex items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center text-sm font-bold text-white"
                        style={{
                          backgroundColor: clienteColors.primary,
                          borderRadius: clienteRadius.full,
                        }}
                      >
                        {initials(dependente.nome)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold" style={{ color: clienteColors.text }}>
                          {dependente.nome}
                        </p>
                        <p className="text-xs" style={{ color: clienteColors.textMuted }}>
                          {dependente.relacao}
                        </p>
                        <p className="mt-1 text-xs" style={{ color: clienteColors.textMuted }}>
                          {formatCPF(dependente.cpf)}
                        </p>
                        <p className="text-xs" style={{ color: clienteColors.textMuted }}>
                          Nasc.: {formatDate(dependente.data_nascimento)}
                        </p>
                      </div>
                    </div>

                    {canManage ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleEdit(dependente)}
                          style={{ borderColor: clienteColors.primary, color: clienteColors.primary }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleDelete(dependente.id)}
                          style={{
                            borderColor: '#FECACA',
                            backgroundColor: '#FEF2F2',
                            color: clienteColors.danger,
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>

      {canAdd ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <Button
              onClick={handleAdd}
              className="pointer-events-auto h-12 w-full text-base font-bold"
              style={{
                backgroundColor: clienteColors.primary,
                color: clienteColors.surface,
                borderRadius: clienteRadius.full,
                boxShadow: `0 10px 20px ${clienteColors.primaryDark}55`,
              }}
            >
              <UserPlus className="mr-2 h-5 w-5" />
              Adicionar dependente
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={canManage && isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar dependente' : 'Adicionar dependente'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formatCPF(formData.cpf)}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '') })}
                maxLength={14}
                required
              />
            </div>

            <div>
              <Label htmlFor="data_nascimento">Data de nascimento *</Label>
              <Input
                id="data_nascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="relacao">Relacao *</Label>
              <Select
                value={formData.relacao}
                onValueChange={(value) => setFormData({ ...formData, relacao: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {RELACOES.map((relacao) => (
                    <SelectItem key={relacao} value={relacao}>
                      {relacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sexo">Sexo</Label>
              <Select
                value={formData.sexo}
                onValueChange={(value) => setFormData({ ...formData, sexo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SEXOS.map((sexo) => (
                    <SelectItem key={sexo} value={sexo}>
                      {sexo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="telefone_celular">Telefone celular</Label>
              <Input
                id="telefone_celular"
                value={formData.telefone_celular}
                onChange={(e) => setFormData({ ...formData, telefone_celular: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              style={{ backgroundColor: clienteColors.primary, color: clienteColors.surface }}
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fazer upgrade para plano familiar</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border p-4" style={{ borderColor: clienteColors.borderMint, backgroundColor: `${clienteColors.primary}10` }}>
              <Users className="h-5 w-5 mt-0.5 shrink-0" style={{ color: clienteColors.primary }} />
              <div className="flex-1 text-sm">
                <p className="font-semibold" style={{ color: clienteColors.text }}>Plano Familiar</p>
                <p className="mt-1" style={{ color: clienteColors.textMuted }}>
                  • Mínimo de 3 vidas (você + 2 dependentes)<br />
                  • Adicione até 2 dependentes sem custo adicional<br />
                  • R$ 24,90 por cada vida excedente
                </p>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: clienteColors.danger }}>
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpgradeDialog(false)}
              disabled={isUpgrading}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                setIsUpgrading(true)
                setError('')
                try {
                  const res = await fetch('/api/cliente/plano/upgrade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target_plan: 'FAMILIAR' }),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    setError(data.error || 'Erro ao fazer upgrade')
                    return
                  }
                  setShowUpgradeDialog(false)
                  fetchPlano()
                  fetchDependentes()
                } catch {
                  setError('Erro ao conectar com o servidor')
                } finally {
                  setIsUpgrading(false)
                }
              }}
              disabled={isUpgrading}
              style={{ backgroundColor: clienteColors.primary, color: clienteColors.surface }}
            >
              {isUpgrading ? 'Processando...' : 'Confirmar upgrade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
