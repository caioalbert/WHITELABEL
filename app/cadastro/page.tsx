import CadastroPageClient from './CadastroPageClient'

type SearchParamsValue = string | string[] | undefined
type SearchParamsRecord = Record<string, SearchParamsValue>

type CadastroPageProps = {
  searchParams?: SearchParamsRecord | Promise<SearchParamsRecord>
}

function toSingleValue(value: SearchParamsValue) {
  if (Array.isArray(value)) {
    return value[0] || ''
  }

  return value || ''
}

export default async function CadastroPage({ searchParams }: CadastroPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {})
  const vendedorRef = toSingleValue(resolvedSearchParams.ref).trim().toUpperCase()
  const planoCode = toSingleValue(resolvedSearchParams.plano).trim()

  return <CadastroPageClient initialVendedorRef={vendedorRef} initialPlanoCode={planoCode} />
}
