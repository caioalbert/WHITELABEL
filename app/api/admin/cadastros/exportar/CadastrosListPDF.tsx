import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

type CadastroExportRow = {
  nome: string
  email: string
  cpf: string
  dataCadastro: string
  financeiroStatus: string
  dadosStatus: string
}

type CadastrosListPDFProps = {
  generatedAt: string
  scopeLabel: string
  filtersSummary: string
  total: number
  rows: CadastroExportRow[]
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 2,
  },
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'solid',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  headerRow: {
    backgroundColor: '#f3f4f6',
  },
  colNome: { width: '24%', padding: 5 },
  colEmail: { width: '25%', padding: 5 },
  colCpf: { width: '12%', padding: 5 },
  colData: { width: '11%', padding: 5 },
  colFinanceiro: { width: '14%', padding: 5 },
  colDados: { width: '14%', padding: 5 },
  headerText: {
    fontWeight: 700,
    fontSize: 8.5,
  },
  bodyText: {
    fontSize: 8.2,
  },
})

export function CadastrosListPDF({
  generatedAt,
  scopeLabel,
  filtersSummary,
  total,
  rows,
}: CadastrosListPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Lista de Clientes - SHALOM Saúde</Text>
        <Text style={styles.meta}>Gerado em: {generatedAt}</Text>
        <Text style={styles.meta}>Escopo: {scopeLabel}</Text>
        <Text style={styles.meta}>Filtros: {filtersSummary}</Text>
        <Text style={styles.meta}>Total de registros: {total}</Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <View style={styles.colNome}>
              <Text style={styles.headerText}>Nome</Text>
            </View>
            <View style={styles.colEmail}>
              <Text style={styles.headerText}>Email</Text>
            </View>
            <View style={styles.colCpf}>
              <Text style={styles.headerText}>CPF</Text>
            </View>
            <View style={styles.colData}>
              <Text style={styles.headerText}>Cliente desde</Text>
            </View>
            <View style={styles.colFinanceiro}>
              <Text style={styles.headerText}>Financeiro</Text>
            </View>
            <View style={styles.colDados}>
              <Text style={styles.headerText}>Dados</Text>
            </View>
          </View>

          {rows.map((row) => (
            <View key={`${row.cpf}-${row.email}`} style={styles.row}>
              <View style={styles.colNome}>
                <Text style={styles.bodyText}>{row.nome}</Text>
              </View>
              <View style={styles.colEmail}>
                <Text style={styles.bodyText}>{row.email}</Text>
              </View>
              <View style={styles.colCpf}>
                <Text style={styles.bodyText}>{row.cpf}</Text>
              </View>
              <View style={styles.colData}>
                <Text style={styles.bodyText}>{row.dataCadastro}</Text>
              </View>
              <View style={styles.colFinanceiro}>
                <Text style={styles.bodyText}>{row.financeiroStatus}</Text>
              </View>
              <View style={styles.colDados}>
                <Text style={styles.bodyText}>{row.dadosStatus}</Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
