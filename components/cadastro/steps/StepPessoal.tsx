'use client'

import { CadastroFormData } from '@/lib/types'
import { isValidCPF } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

interface StepPessoalProps {
  data: Partial<CadastroFormData>
  onUpdate: (data: Partial<CadastroFormData>) => void
  showValidation?: boolean
}

const ESCOLARIDADE_OPTIONS = [
  'Ensino Fundamental - Incompleto',
  'Ensino Fundamental - Completo',
  'Ensino Médio - Incompleto',
  'Ensino Médio - Completo',
  'Ensino Superior - Incompleto',
  'Ensino Superior - Completo',
]

const CPF_CHECK_FALLBACK_ERROR = 'Não foi possível validar o CPF agora. Tente novamente.'

function formatDateInput(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2')
}

function parseDateInputToISO(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null

  const [dayString, monthString, yearString] = value.split('/')
  const day = Number(dayString)
  const month = Number(monthString)
  const year = Number(yearString)

  if (day < 1 || month < 1 || month > 12 || year < 1900 || year > 2100) return null

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatISOToDateInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return value
  }

  return ''
}

function normalizeDateToISO(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return parseDateInputToISO(value) || ''
}

function sanitizeApiErrorMessage(value: unknown) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  if (/(<!doctype|<html|cloudflare|error code 52\d|ssl handshake|cf-ray)/i.test(normalized)) {
    return null
  }

  const withoutHtmlTags = normalized.replace(/<[^>]+>/g, '').trim()
  if (!withoutHtmlTags || withoutHtmlTags.length > 220) {
    return null
  }

  return withoutHtmlTags
}

async function readApiErrorMessage(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return fallbackMessage
  }

  const payload = await response.json().catch(() => null) as { error?: unknown } | null
  const safeMessage = sanitizeApiErrorMessage(payload?.error)
  return safeMessage || fallbackMessage
}

export function StepPessoal({ data, onUpdate, showValidation = false }: StepPessoalProps) {
  const initialIsoDate = normalizeDateToISO(data.data_nascimento || '')

  const [localData, setLocalData] = useState({
    nome: data.nome || '',
    email: data.email || '',
    cpf: data.cpf || '',
    rg: data.rg || '',
    data_nascimento: initialIsoDate,
    telefone: data.telefone || '',
    sexo: data.sexo || '',
    estado_civil: data.estado_civil || '',
    nome_conjuge: data.nome_conjuge || '',
    escolaridade: data.escolaridade || '',
  })
  const [dataNascimentoInput, setDataNascimentoInput] = useState(formatISOToDateInput(initialIsoDate))
  const [cpfError, setCpfError] = useState<string | null>(null)
  const [isCheckingCpf, setIsCheckingCpf] = useState(false)
  const [dataNascimentoError, setDataNascimentoError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const next = { ...localData, [name]: value }
    setLocalData(next)
    onUpdate(next)
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    const next = {
      ...localData,
      [name]: value,
      ...(name === 'estado_civil' && value !== 'Casado(a)' ? { nome_conjuge: '' } : {}),
    }
    setLocalData(next)
    onUpdate(next)
  }

  const handleBlur = () => {
    onUpdate(localData)
  }

  const handleDataNascimentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateInput(e.target.value)
    setDataNascimentoInput(formatted)
    setDataNascimentoError(null)

    const isoDate = parseDateInputToISO(formatted)
    const next = {
      ...localData,
      data_nascimento: isoDate || '',
    }
    setLocalData(next)
    onUpdate(next)
  }

  const handleDataNascimentoBlur = () => {
    if (!dataNascimentoInput.trim()) {
      setDataNascimentoError('Data de nascimento é obrigatória')
      const next = { ...localData, data_nascimento: '' }
      setLocalData(next)
      onUpdate(next)
      return
    }

    const isoDate = parseDateInputToISO(dataNascimentoInput)
    if (!isoDate) {
      setDataNascimentoError('Digite uma data válida no formato DD/MM/AAAA')
      const next = { ...localData, data_nascimento: '' }
      setLocalData(next)
      onUpdate(next)
      return
    }

    setDataNascimentoError(null)
    const next = { ...localData, data_nascimento: isoDate }
    setLocalData(next)
    onUpdate(next)
  }

  const handleCpfBlur = async () => {
    if (!localData.cpf) {
      setCpfError('CPF é obrigatório')
      onUpdate(localData)
      return
    }

    if (!isValidCPF(localData.cpf)) {
      setCpfError('CPF inválido')
      onUpdate(localData)
      return
    }

    try {
      setIsCheckingCpf(true)
      const response = await fetch(`/api/cadastro/verificar-cpf?cpf=${encodeURIComponent(localData.cpf)}`)

      if (!response.ok) {
        const safeMessage = await readApiErrorMessage(response, CPF_CHECK_FALLBACK_ERROR)
        setCpfError(safeMessage)
        onUpdate(localData)
        return
      }

      const payload = await response.json().catch(() => ({}))
      if (payload.exists) {
        setCpfError('CPF já identificado na nossa base de cadastrados.')
        onUpdate(localData)
        return
      }

      setCpfError(null)
      onUpdate(localData)
    } catch {
      setCpfError(CPF_CHECK_FALLBACK_ERROR)
      onUpdate(localData)
    } finally {
      setIsCheckingCpf(false)
    }
  }

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14)
  }

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    return cleaned
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15)
  }

  const isMissingField = (field: keyof typeof localData) =>
    showValidation && !String(localData[field] || '').trim()

  const inputClass = (field: keyof typeof localData) =>
    `mt-2 ${isMissingField(field) ? 'border-red-400 focus-visible:ring-red-500' : 'border-gray-300'}`

  const selectClass = (field: keyof typeof localData) =>
    `mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
      isMissingField(field)
        ? 'border-red-400 focus:ring-red-500'
        : 'border-gray-300 focus:ring-blue-500'
    }`

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="nome" className="text-gray-700 font-medium">
          Nome Completo *
        </Label>
        <Input
          id="nome"
          name="nome"
          type="text"
          placeholder="João Silva"
          value={localData.nome}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          className={inputClass('nome')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cpf" className="text-gray-700 font-medium">
            CPF *
          </Label>
          <Input
            id="cpf"
            name="cpf"
            type="text"
            placeholder="000.000.000-00"
            value={formatCPF(localData.cpf)}
            onChange={(e) => {
              const formatted = formatCPF(e.target.value)
              const next = { ...localData, cpf: formatted }
              setLocalData(next)
              onUpdate(next)
              setCpfError(null)
            }}
            onBlur={handleCpfBlur}
            required
            className={`mt-2 ${
              cpfError || isMissingField('cpf')
                ? 'border-red-400 focus-visible:ring-red-500'
                : 'border-gray-300'
            }`}
            maxLength={14}
          />
          {cpfError && <p className="mt-1 text-xs text-red-600">{cpfError}</p>}
          {!cpfError && isCheckingCpf && (
            <p className="mt-1 text-xs text-gray-500">Validando CPF...</p>
          )}
        </div>

        <div>
          <Label htmlFor="rg" className="text-gray-700 font-medium">
            RG *
          </Label>
          <Input
            id="rg"
            name="rg"
            type="text"
            placeholder="00.000.000-0"
            value={localData.rg}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            className={inputClass('rg')}
          />
        </div>

        <div>
          <Label htmlFor="data_nascimento" className="text-gray-700 font-medium">
            Data de Nascimento *
          </Label>
          <Input
            id="data_nascimento"
            name="data_nascimento"
            type="text"
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            value={dataNascimentoInput}
            onChange={handleDataNascimentoChange}
            onBlur={handleDataNascimentoBlur}
            required
            maxLength={10}
            className={`mt-2 ${
              dataNascimentoError || isMissingField('data_nascimento')
                ? 'border-red-400 focus-visible:ring-red-500'
                : 'border-gray-300'
            }`}
          />
          {dataNascimentoError ? (
            <p className="mt-1 text-xs text-red-600">{dataNascimentoError}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">Digite no formato DD/MM/AAAA.</p>
          )}
        </div>

        <div>
          <Label htmlFor="sexo" className="text-gray-700 font-medium">
            Sexo *
          </Label>
          <select
            id="sexo"
            name="sexo"
            value={localData.sexo}
            onChange={handleSelectChange}
            onBlur={handleBlur}
            required
            className={selectClass('sexo')}
          >
            <option value="">Selecione...</option>
            <option value="Feminino">Feminino</option>
            <option value="Masculino">Masculino</option>
            <option value="Outro">Outro</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="estado_civil" className="text-gray-700 font-medium">
            Estado Civil *
          </Label>
          <select
            id="estado_civil"
            name="estado_civil"
            value={localData.estado_civil}
            onChange={handleSelectChange}
            onBlur={handleBlur}
            required
            className={selectClass('estado_civil')}
          >
            <option value="">Selecione...</option>
            <option value="Solteiro(a)">Solteiro(a)</option>
            <option value="Casado(a)">Casado(a)</option>
            <option value="Divorciado(a)">Divorciado(a)</option>
            <option value="Viúvo(a)">Viúvo(a)</option>
          </select>
        </div>

        {localData.estado_civil === 'Casado(a)' && (
          <div className="sm:col-span-2">
            <Label htmlFor="nome_conjuge" className="text-gray-700 font-medium">
              Nome do Cônjuge (se casado) *
            </Label>
            <Input
              id="nome_conjuge"
              name="nome_conjuge"
              type="text"
              placeholder="Nome do cônjuge"
              value={localData.nome_conjuge}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              className={`mt-2 ${
                showValidation &&
                localData.estado_civil === 'Casado(a)' &&
                !localData.nome_conjuge.trim()
                  ? 'border-red-400 focus-visible:ring-red-500'
                  : 'border-gray-300'
              }`}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <Label htmlFor="escolaridade" className="text-gray-700 font-medium">
            Escolaridade *
          </Label>
          <select
            id="escolaridade"
            name="escolaridade"
            value={localData.escolaridade}
            onChange={handleSelectChange}
            onBlur={handleBlur}
            required
            className={selectClass('escolaridade')}
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

      <div>
        <Label htmlFor="email" className="text-gray-700 font-medium">
          Email *
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          value={localData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          className={inputClass('email')}
        />
      </div>

      <div>
        <Label htmlFor="telefone" className="text-gray-700 font-medium">
          Telefone Celular *
        </Label>
        <Input
          id="telefone"
          name="telefone"
          type="tel"
          placeholder="(11) 99999-9999"
          value={formatPhone(localData.telefone)}
          onChange={(e) => {
            const formatted = formatPhone(e.target.value)
            const next = { ...localData, telefone: formatted }
            setLocalData(next)
            onUpdate(next)
          }}
          onBlur={handleBlur}
          required
          className={inputClass('telefone')}
          maxLength={15}
        />
        <p className="mt-1 text-xs text-gray-500">Necessário para acesso aos serviços de telemedicina.</p>
      </div>

      <p className="text-xs text-gray-500">* Campo obrigatório</p>
    </div>
  )
}
