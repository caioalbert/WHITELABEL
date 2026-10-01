'use client'

import { AdminPageHeader } from '@/components/admin/page-header'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AdminTermoTemplatePage() {
  const router = useRouter()
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [templateInputKey, setTemplateInputKey] = useState(0)
  const [templateMessage, setTemplateMessage] = useState<string | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [hasCustomTemplate, setHasCustomTemplate] = useState(false)
  const [isLoadingInfo, setIsLoadingInfo] = useState(true)

  useEffect(() => {
    fetchTemplateInfo()
  }, [])

  const fetchTemplateInfo = async () => {
    try {
      setIsLoadingInfo(true)
      const response = await fetch('/api/admin/termo-template')

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error('Erro ao carregar informações do template')
      }

      const data = await response.json()
      setHasCustomTemplate(Boolean(data.hasCustomTemplate))
    } catch (err) {
      setTemplateMessage(
        err instanceof Error ? err.message : 'Erro ao carregar informações do template'
      )
    } finally {
      setIsLoadingInfo(false)
    }
  }

  const handleTemplateUpload = async () => {
    if (!templateFile) {
      setTemplateMessage('Selecione um arquivo .txt, .md ou .docx')
      return
    }

    try {
      setTemplateLoading(true)
      setTemplateMessage(null)

      const formData = new FormData()
      formData.append('template', templateFile)

      const response = await fetch('/api/admin/termo-template', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar template')
      }

      setTemplateMessage('Template salvo com sucesso. Novos PDFs já usarão este conteúdo.')
      setTemplateFile(null)
      setTemplateInputKey((prev) => prev + 1)
      setHasCustomTemplate(true)
    } catch (err) {
      setTemplateMessage(err instanceof Error ? err.message : 'Erro ao enviar template')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleTemplateReset = async () => {
    try {
      setTemplateLoading(true)
      setTemplateMessage(null)

      const response = await fetch('/api/admin/termo-template', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao restaurar template')
      }

      setTemplateMessage('Template padrão restaurado com sucesso.')
      setTemplateFile(null)
      setTemplateInputKey((prev) => prev + 1)
      setHasCustomTemplate(false)
    } catch (err) {
      setTemplateMessage(err instanceof Error ? err.message : 'Erro ao restaurar template')
    } finally {
      setTemplateLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AdminPageHeader title="Termos e contratos" description="Texto utilizado nos documentos dos clientes."></AdminPageHeader>

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4 rounded-lg bg-white p-6 shadow">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Template do Termo (PDF)</h2>
            <p className="mt-1 text-sm text-gray-600">
              Você pode enviar um arquivo para customizar o texto legal do termo sem editar
              código.
            </p>
          </div>

          <div className="space-y-1 text-sm text-gray-700">
            <p>Como carregar corretamente:</p>
            <p>1. Use arquivo .txt, .md ou .docx.</p>
            <p>2. Separe parágrafos com uma linha em branco.</p>
            <p>3. Títulos em linha isolada (ex.: TELEMEDICINA, ASSISTÊNCIA FUNERÁRIA).</p>
            <p>4. Tamanho máximo: 200KB.</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              key={templateInputKey}
              type="file"
              accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setTemplateFile(event.target.files?.[0] || null)}
              className="block w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700"
              disabled={templateLoading || isLoadingInfo}
            />
            <Button
              onClick={handleTemplateUpload}
              disabled={templateLoading || !templateFile || isLoadingInfo}
              className="md:w-auto"
            >
              {templateLoading ? 'Enviando...' : 'Enviar Template'}
            </Button>
            <Button
              onClick={handleTemplateReset}
              variant="outline"
              disabled={templateLoading || !hasCustomTemplate || isLoadingInfo}
              className="md:w-auto"
            >
              Restaurar Padrão
            </Button>
          </div>

          <p className="text-sm text-gray-600">
            Template ativo: {hasCustomTemplate ? 'Personalizado' : 'Padrão do sistema'}
          </p>

          {templateMessage && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-700">{templateMessage}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
