import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { DEFAULT_TERMO_BODY } from '@/lib/termo-template'

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 30,
    fontSize: 10,
    lineHeight: 1.35,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: {
    marginBottom: 4,
  },
  paragraph: {
    marginBottom: 8,
    textAlign: 'justify',
  },
  smallGap: {
    marginBottom: 3,
  },
  confirmationBlock: {
    marginTop: 14,
    alignItems: 'center',
  },
  confirmationLine: {
    marginTop: 4,
  },
})

type CadastroPdfData = {
  nome: string
  cpf: string
  rg?: string | null
  email: string
  telefone?: string | null
  sexo?: string | null
  data_nascimento?: string | null
  estado_civil?: string | null
  nome_conjuge?: string | null
  escolaridade?: string | null
  endereco?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
}

type DependentePdfData = {
  nome?: string | null
  relacao?: string | null
  rg?: string | null
  cpf?: string | null
  data_nascimento?: string | null
  email?: string | null
  telefone_celular?: string | null
  sexo?: string | null
}

type TermoAdesaoPDFProps = {
  data: CadastroPdfData
  dependentes: DependentePdfData[]
  termoBodyText?: string
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR')
}

function formatAddress(data: CadastroPdfData) {
  const endereco = [data.endereco, data.numero, data.complemento]
    .filter(Boolean)
    .join(', ')

  const localizacao = [data.bairro, data.cidade, data.estado]
    .filter(Boolean)
    .join(' - ')

  return [endereco, localizacao].filter(Boolean).join(' | ')
}

function splitTemplateBlocks(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function isHeadingBlock(block: string) {
  return /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s]+$/.test(block) && block.length <= 80
}

export function TermoAdesaoPDF({ data, dependentes, termoBodyText }: TermoAdesaoPDFProps) {
  const dependentesRows = dependentes.filter((dep) => dep && dep.nome)
  const templateBlocks = splitTemplateBlocks(termoBodyText || DEFAULT_TERMO_BODY)
  const cidadeConfirmacao = data.cidade || 'Belo Horizonte'
  const estadoConfirmacao = data.estado || 'MG'
  const dataConfirmacao = new Date().toLocaleDateString('pt-BR')

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>TERMO DE ADESÃO AO SERVIÇO novaalianca SAÚDE</Text>

        <Text style={styles.sectionTitle}>Responsável Financeiro</Text>
        <Text style={styles.row}>Nome: {data.nome || ''}</Text>
        <Text style={styles.row}>Endereço: {formatAddress(data)}</Text>
        <Text style={styles.row}>CEP: {data.cep || ''}</Text>
        <Text style={styles.row}>Email: {data.email || ''}</Text>
        <Text style={styles.row}>CPF: {data.cpf || ''}   RG: {data.rg || ''}</Text>
        <Text style={styles.row}>Telefone: {data.telefone || ''}</Text>
        <Text style={styles.row}>
          Data de Nascimento: {formatDate(data.data_nascimento)}   Sexo: {data.sexo || 'Não informado'}
        </Text>
        <Text style={styles.row}>Estado Civil: {data.estado_civil || ''}</Text>
        {data.nome_conjuge ? (
          <Text style={styles.row}>Nome do Cônjuge: {data.nome_conjuge}</Text>
        ) : null}
        <Text style={styles.row}>Escolaridade: {data.escolaridade || ''}</Text>

        <Text style={styles.sectionTitle}>Dados dos Dependentes</Text>
        {dependentesRows.length > 0 ? (
          dependentesRows.map((dep, index) => (
            <View key={`dep-${index}`} style={styles.smallGap}>
              <Text>Nome: {dep.nome || ''}</Text>
              <Text>
                RG: {dep.rg || ''}   CPF: {dep.cpf || ''}   Nascimento: {formatDate(dep.data_nascimento)}   Sexo: {dep.sexo || 'Não informado'}
              </Text>
              <Text>Email: {dep.email || ''}</Text>
              <Text>Celular: {dep.telefone_celular || ''}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.row}>Nenhum dependente cadastrado.</Text>
        )}

        <Text style={styles.paragraph}>
          Pela adesão aos serviços da novaalianca Saúde, o(a) CONTRATANTE pagará ao Prestador de Serviços o valor de R$ 19,90 (dezenove reais e noventa centavos), plano individual, sem taxa de adesão.
        </Text>
        <Text style={styles.paragraph}>
          O pagamento pelos serviços contratados será realizado por meio de boleto bancário via e-mail do Responsável Financeiro, com vencimento todo dia 05 (cinco) do mês subsequente ao ato da adesão a este termo.
        </Text>

        {templateBlocks.map((block, index) => (
          <Text
            key={`template-block-${index}`}
            style={isHeadingBlock(block) ? styles.sectionTitle : styles.paragraph}
          >
            {block}
          </Text>
        ))}

        <View style={styles.confirmationBlock}>
          <Text>
            {cidadeConfirmacao}/{estadoConfirmacao}, {dataConfirmacao}
          </Text>
          <Text style={styles.confirmationLine}>{data.nome || 'TITULAR DO CADASTRO'}</Text>
          <Text>Confirmação eletrônica de adesão registrada no sistema.</Text>
        </View>
      </Page>
    </Document>
  )
}
