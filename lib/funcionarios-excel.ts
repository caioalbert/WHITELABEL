import type { DependenteFormData } from './types'
import { getAgeFromIsoDate, isValidCPF, isValidEmail, normalizeCPF } from './utils'

export const FUNCIONARIOS_EXCEL_HEADERS = [
  'Nome completo',
  'RG',
  'CPF',
  'Data de nascimento',
  'E-mail',
  'Telefone celular',
  'Sexo',
] as const

export const MAX_FUNCIONARIOS_EXCEL = 1000

type FuncionarioColumn =
  | 'nome'
  | 'rg'
  | 'cpf'
  | 'data_nascimento'
  | 'email'
  | 'telefone_celular'
  | 'sexo'

export type FuncionarioExcelRowError = {
  linha: number
  mensagens: string[]
}

export type FuncionarioExcelImportResult = {
  funcionarios: DependenteFormData[]
  erros: FuncionarioExcelRowError[]
  errosGerais: string[]
  totalLinhas: number
}

type ImportOptions = {
  existentes?: DependenteFormData[]
  emailTitular?: string
  vagasDisponiveis?: number | null
}

const COLUMN_ALIASES: Record<FuncionarioColumn, string[]> = {
  nome: [
    'nome',
    'nome completo',
    'funcionario',
    'funcionário',
    'colaborador',
    'colaboradora',
    'nome do funcionario',
    'nome do colaborador',
  ],
  rg: ['rg', 'identidade', 'registro geral'],
  cpf: ['cpf', 'cpf opcional', 'cpf do funcionario', 'cpf do colaborador'],
  data_nascimento: [
    'data de nascimento',
    'data nascimento',
    'nascimento',
    'data nasc',
    'data de nascimento opcional',
  ],
  email: ['email', 'e-mail', 'email pessoal', 'e-mail pessoal'],
  telefone_celular: ['telefone celular', 'celular', 'telefone', 'whatsapp'],
  sexo: ['sexo', 'genero', 'gênero'],
}

const REQUIRED_COLUMNS: FuncionarioColumn[] = ['nome', 'rg', 'email', 'telefone_celular', 'sexo']

const COLUMN_LABELS: Record<FuncionarioColumn, string> = {
  nome: 'Nome completo',
  rg: 'RG',
  cpf: 'CPF',
  data_nascimento: 'Data de nascimento',
  email: 'E-mail',
  telefone_celular: 'Telefone celular',
  sexo: 'Sexo',
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

function toIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return ''
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseExcelDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + Math.floor(value) * 24 * 60 * 60 * 1000)
    return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }

  const text = cellText(value)
  if (!text) return ''

  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    return parseExcelDate(Number(text))
  }

  const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
  }

  const brMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (brMatch) {
    return toIsoDate(Number(brMatch[3]), Number(brMatch[2]), Number(brMatch[1]))
  }

  return ''
}

function formatCpf(value: unknown) {
  const raw = cellText(value)
  if (!raw) return ''

  let digits = normalizeCPF(raw)
  if (/^\d+(?:\.0+)?$/.test(raw) && digits.length < 11) {
    digits = digits.padStart(11, '0')
  }

  if (digits.length !== 11) return raw
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatPhone(value: unknown) {
  const raw = cellText(value)
  if (!raw) return ''

  let digits = raw.replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2)
  }

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }

  return raw
}

function normalizeSexo(value: unknown) {
  const normalized = normalizeText(value)
  if (['f', 'fem', 'feminino', 'mulher'].includes(normalized)) return 'Feminino'
  if (['m', 'masc', 'masculino', 'homem'].includes(normalized)) return 'Masculino'
  if (['outro', 'outros', 'nao binario', 'não binário'].includes(normalized)) return 'Outro'
  return ''
}

function findHeaderRow(matrix: unknown[][]) {
  const searchLimit = Math.min(matrix.length, 10)
  let firstNonEmptyRow = -1
  let bestMatchRow = -1
  let bestMatchCount = 0

  for (let index = 0; index < searchLimit; index += 1) {
    const row = matrix[index] || []
    if (!row.some((cell) => cellText(cell))) continue

    if (firstNonEmptyRow < 0) firstNonEmptyRow = index
    const matchCount = mapColumnIndexes(row).size
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount
      bestMatchRow = index
    }
  }

  return bestMatchRow >= 0 ? bestMatchRow : firstNonEmptyRow
}

function mapColumnIndexes(headerRow: unknown[]) {
  const indexes = new Map<FuncionarioColumn, number>()

  headerRow.forEach((header, index) => {
    const normalizedHeader = normalizeText(header)
    if (!normalizedHeader) return

    for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as Array<
      [FuncionarioColumn, string[]]
    >) {
      if (aliases.some((alias) => normalizeText(alias) === normalizedHeader)) {
        if (!indexes.has(column)) indexes.set(column, index)
        break
      }
    }
  })

  return indexes
}

function duplicateKey(value: string) {
  return value.trim().toLowerCase()
}

export function parseFuncionariosExcel(
  matrix: unknown[][],
  options: ImportOptions = {}
): FuncionarioExcelImportResult {
  const result: FuncionarioExcelImportResult = {
    funcionarios: [],
    erros: [],
    errosGerais: [],
    totalLinhas: 0,
  }

  const headerIndex = findHeaderRow(matrix)
  if (headerIndex < 0) {
    result.errosGerais.push('A planilha está vazia.')
    return result
  }

  const columnIndexes = mapColumnIndexes(matrix[headerIndex] || [])
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !columnIndexes.has(column))
  if (missingColumns.length > 0) {
    result.errosGerais.push(
      `Colunas obrigatórias não encontradas: ${missingColumns.map((column) => COLUMN_LABELS[column]).join(', ')}.`
    )
    return result
  }

  const dataRows = matrix
    .slice(headerIndex + 1)
    .map((row, index) => ({ row: row || [], line: headerIndex + index + 2 }))
    .filter(({ row }) => row.some((cell) => cellText(cell)))

  result.totalLinhas = dataRows.length

  if (dataRows.length === 0) {
    result.errosGerais.push('A planilha não possui colaboradores para importar.')
    return result
  }

  if (dataRows.length > MAX_FUNCIONARIOS_EXCEL) {
    result.errosGerais.push(
      `A planilha possui ${dataRows.length} linhas. Importe no máximo ${MAX_FUNCIONARIOS_EXCEL} colaboradores por arquivo.`
    )
    return result
  }

  const existingCpfs = new Set(
    (options.existentes || []).map((item) => normalizeCPF(item.cpf || '')).filter(Boolean)
  )
  const existingEmails = new Set(
    (options.existentes || []).map((item) => duplicateKey(item.email || '')).filter(Boolean)
  )
  const emailTitular = duplicateKey(options.emailTitular || '')
  const vagasDisponiveis = options.vagasDisponiveis

  for (const { row, line } of dataRows) {
    const getCell = (column: FuncionarioColumn) => {
      const index = columnIndexes.get(column)
      return index === undefined ? '' : row[index]
    }

    const nome = cellText(getCell('nome'))
    const rg = cellText(getCell('rg'))
    const cpf = formatCpf(getCell('cpf'))
    const rawBirthDate = getCell('data_nascimento')
    const dataNascimento = parseExcelDate(rawBirthDate)
    const email = duplicateKey(cellText(getCell('email')))
    const telefone = formatPhone(getCell('telefone_celular'))
    const sexo = normalizeSexo(getCell('sexo'))
    const mensagens: string[] = []

    if (!nome) mensagens.push('nome não informado')
    if (!rg) mensagens.push('RG não informado')
    if (!email) mensagens.push('e-mail não informado')
    else if (!isValidEmail(email)) mensagens.push('e-mail inválido')
    if (!telefone) mensagens.push('telefone celular não informado')
    else if (![10, 11].includes(telefone.replace(/\D/g, '').length)) {
      mensagens.push('telefone celular deve ter DDD e 10 ou 11 dígitos')
    }
    if (!sexo) mensagens.push('sexo inválido (use Feminino, Masculino ou Outro)')
    if (cellText(rawBirthDate) && !dataNascimento) mensagens.push('data de nascimento inválida')
    if (cpf && !isValidCPF(cpf)) mensagens.push('CPF inválido')

    const cpfDigits = normalizeCPF(cpf)
    if (cpfDigits && existingCpfs.has(cpfDigits)) mensagens.push('CPF já adicionado')
    if (email && existingEmails.has(email)) mensagens.push('e-mail já adicionado')

    if (email && emailTitular && email === emailTitular) {
      const age = getAgeFromIsoDate(dataNascimento)
      if (age === null || age >= 18) {
        mensagens.push('colaborador adulto deve ter e-mail diferente do titular')
      }
    }

    if (
      vagasDisponiveis !== null &&
      vagasDisponiveis !== undefined &&
      result.funcionarios.length >= Math.max(0, vagasDisponiveis)
    ) {
      mensagens.push('limite de pessoas do plano atingido')
    }

    if (mensagens.length > 0) {
      result.erros.push({
        linha: line,
        mensagens: Array.from(new Set(mensagens)),
      })
      continue
    }

    const funcionario: DependenteFormData = {
      nome,
      rg,
      cpf,
      data_nascimento: dataNascimento,
      relacao: 'colaborador',
      email,
      telefone_celular: telefone,
      sexo,
    }

    result.funcionarios.push(funcionario)
    if (cpfDigits) existingCpfs.add(cpfDigits)
    existingEmails.add(email)
  }

  return result
}
