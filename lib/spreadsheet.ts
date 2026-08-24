type WorksheetInput = {
  name: string
  rows: unknown[][]
  columnWidths?: number[]
}

export function parseCsvMatrix(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

export async function readSpreadsheetMatrix(file: File) {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsvMatrix(await file.text())

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames.find((name) =>
    name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('funcion')
  ) || workbook.SheetNames[0]

  if (!sheetName) throw new Error('A planilha não possui nenhuma aba.')
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: true,
  })
}

export async function downloadXlsx(fileName: string, sheets: WorksheetInput[]) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows)
    if (sheet.columnWidths) worksheet['!cols'] = sheet.columnWidths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }
  XLSX.writeFile(workbook, fileName, { compression: true })
}
