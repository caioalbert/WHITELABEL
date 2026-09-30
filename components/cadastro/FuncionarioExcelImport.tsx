'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  MAX_FUNCIONARIOS_EXCEL,
  parseFuncionariosExcel,
  type FuncionarioExcelRowError,
} from '@/lib/funcionarios-excel'
import type { DependenteFormData } from '@/lib/types'
import { downloadFuncionariosTemplate } from '@/lib/funcionarios-template'
import { readSpreadsheetMatrix } from '@/lib/spreadsheet'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const DISPLAYED_ERRORS_LIMIT = 20

type ImportFeedback = {
  kind: 'success' | 'warning' | 'error'
  title: string
  description: string
  errors?: FuncionarioExcelRowError[]
}

interface FuncionarioExcelImportProps {
  funcionariosExistentes: DependenteFormData[]
  emailTitular?: string
  vagasDisponiveis?: number | null
  onImport: (funcionarios: DependenteFormData[]) => void
}

function getErrorDescription(errors: FuncionarioExcelRowError[]) {
  const total = errors.length
  return `${total} ${total === 1 ? 'linha não foi importada' : 'linhas não foram importadas'}. Corrija o arquivo e envie essas linhas novamente.`
}

export function FuncionarioExcelImport({
  funcionariosExistentes,
  emailTitular = '',
  vagasDisponiveis = null,
  onImport,
}: FuncionarioExcelImportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null)

  const handleDownloadTemplate = async () => {
    setFeedback(null)

    try {
      await downloadFuncionariosTemplate()
    } catch (error) {
      console.error('Erro ao gerar modelo de colaboradores:', error)
      setFeedback({
        kind: 'error',
        title: 'Não foi possível gerar o modelo',
        description: 'Tente novamente. Se o erro continuar, recarregue a página.',
      })
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFeedback(null)

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension !== 'xlsx' && extension !== 'xls') {
      setFeedback({
        kind: 'error',
        title: 'Arquivo inválido',
        description: 'Selecione um arquivo Excel nos formatos .xlsx ou .xls.',
      })
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFeedback({
        kind: 'error',
        title: 'Arquivo muito grande',
        description: 'O arquivo deve ter no máximo 5 MB.',
      })
      return
    }

    setIsProcessing(true)

    try {
      const matrix = await readSpreadsheetMatrix(file)
      const result = parseFuncionariosExcel(matrix, {
        existentes: funcionariosExistentes,
        emailTitular,
        vagasDisponiveis,
      })

      if (result.errosGerais.length > 0) {
        setFeedback({
          kind: 'error',
          title: 'Não foi possível importar a planilha',
          description: result.errosGerais.join(' '),
        })
        return
      }

      if (result.funcionarios.length > 0) {
        onImport(result.funcionarios)
      }

      if (result.erros.length > 0) {
        setFeedback({
          kind: result.funcionarios.length > 0 ? 'warning' : 'error',
          title:
            result.funcionarios.length > 0
              ? `${result.funcionarios.length} colaborador(es) importado(s)`
              : 'Nenhum colaborador foi importado',
          description: getErrorDescription(result.erros),
          errors: result.erros,
        })
        return
      }

      setFeedback({
        kind: 'success',
        title: 'Importação concluída',
        description: `${result.funcionarios.length} colaborador(es) adicionado(s) ao cadastro. Revise a lista antes de continuar.`,
      })
    } catch (error) {
      console.error('Erro ao importar colaboradores:', error)
      setFeedback({
        kind: 'error',
        title: 'Não foi possível ler o arquivo',
        description:
          error instanceof Error
            ? error.message
            : 'Verifique se o arquivo é uma planilha Excel válida e tente novamente.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const isLimitReached = vagasDisponiveis !== null && vagasDisponiveis <= 0
  const displayedErrors = feedback?.errors?.slice(0, DISPLAYED_ERRORS_LIMIT) || []
  const hiddenErrorsCount = Math.max(0, (feedback?.errors?.length || 0) - displayedErrors.length)

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700" aria-hidden>
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Importar colaboradores por Excel</h3>
          <p className="mt-1 text-sm text-gray-600">
            Baixe o modelo, preencha uma linha por colaborador e selecione o arquivo pronto. O
            arquivo é lido somente no seu navegador.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={handleDownloadTemplate}
          disabled={isProcessing}
        >
          <Download />
          Baixar modelo Excel
        </Button>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing || isLimitReached}
          className="bg-emerald-700 text-white hover:bg-emerald-800"
        >
          {isProcessing ? <Loader2 className="animate-spin" /> : <Upload />}
          {isProcessing ? 'Lendo planilha...' : 'Selecionar arquivo'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Selecionar planilha de colaboradores"
        />
      </div>

      <p className="text-xs text-gray-600">
        Formatos aceitos: .xlsx e .xls, até 5 MB e {MAX_FUNCIONARIOS_EXCEL} colaboradores por
        arquivo.
      </p>

      {isLimitReached ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertCircle />
          <AlertTitle>Limite do plano atingido</AlertTitle>
          <AlertDescription>
            Remova uma pessoa da lista para importar outro colaborador.
          </AlertDescription>
        </Alert>
      ) : null}

      {feedback ? (
        <Alert
          aria-live="polite"
          variant={feedback.kind === 'error' ? 'destructive' : 'default'}
          className={
            feedback.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : feedback.kind === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : undefined
          }
        >
          {feedback.kind === 'success' ? <CheckCircle2 /> : <AlertCircle />}
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>
            <p>{feedback.description}</p>
            {displayedErrors.length > 0 ? (
              <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
                {displayedErrors.map((error) => (
                  <li key={error.linha}>
                    Linha {error.linha}: {error.mensagens.join('; ')}.
                  </li>
                ))}
                {hiddenErrorsCount > 0 ? (
                  <li>E mais {hiddenErrorsCount} linha(s) com erro.</li>
                ) : null}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
