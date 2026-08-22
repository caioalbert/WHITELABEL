'use client'

import { CadastroSuccess } from '@/components/cadastro/CadastroSuccess'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type CadastroStatus = {
  id: string
  nome: string
  email: string
  status: string
  pagamento?: {
    id: string
    descricao?: string
    valor: number
    vencimento: string
    billingType?: string
    invoiceUrl?: string | null
    bankSlipUrl?: string | null
  } | null
}

export default function CadastroStatusPage() {
  const router = useRouter()
  const [data, setData] = useState<CadastroStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/cadastro/status', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar o cadastro.')
        setData(payload)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Erro ao consultar cadastro.'))
  }, [])

  if (data) return <CadastroSuccess data={data} />

  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-lg">
        <p className={error ? 'text-red-700' : 'text-gray-600'}>{error || 'Consultando pagamento...'}</p>
        {error && <Button className="mt-4" onClick={() => router.push('/login')}>Voltar ao login</Button>}
      </div>
    </main>
  )
}
