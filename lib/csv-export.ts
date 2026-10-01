/** Quote CSV delimiters and prevent untrusted text from becoming spreadsheet formulas. */
export function escapeCsvCell(value: string) {
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(value) || /^[\t\r\n]/u.test(value)
    ? `'${value}`
    : value
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
