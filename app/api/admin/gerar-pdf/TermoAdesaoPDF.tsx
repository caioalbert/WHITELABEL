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
  mensalidade_valor?: number | null
  tipo_plano?: string | null
  primeira_parcela_vencimento?: string | null
  dia_vencimento?: number | null
  contrato_meses?: number | null
  mensalidade_billing_type?: string | null
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
          Pelos serviços da novaalianca Saúde, o(a) CONTRATANTE pagará parcelas mensais
          {data.mensalidade_valor != null ? ` de ${Number(data.mensalidade_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ' no valor acordado no cadastro'}
          {data.tipo_plano ? `, plano ${data.tipo_plano}` : ''}.
          {data.contrato_meses ? ` O contrato possui ${data.contrato_meses} parcelas ao todo, incluindo a primeira parcela.` : ''}
        </Text>
        <Text style={styles.paragraph}>
          O pagamento será realizado por {data.mensalidade_billing_type === 'CREDIT_CARD' ? 'cartão de crédito' : 'BolePIX (boleto ou Pix)'}.
          {data.primeira_parcela_vencimento ? ` A primeira parcela vence em ${formatDate(data.primeira_parcela_vencimento)}.` : ''}
          {data.dia_vencimento && (data.contrato_meses ?? 12) > 1 ? ` As demais vencem no dia ${data.dia_vencimento} de cada mês, a partir do mês seguinte, ou no último dia do mês quando não houver esse dia.` : ''}
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
