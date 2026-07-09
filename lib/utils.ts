import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeCPF(value: string) {
  return value.replace(/\D/g, '')
}

export function isValidCPF(value: string) {
  const cpf = normalizeCPF(value)

  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false

  let sum = 0
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf.charAt(index)) * (10 - index)
  }

  let checkDigit = (sum * 10) % 11
  if (checkDigit === 10) checkDigit = 0
  if (checkDigit !== Number(cpf.charAt(9))) return false

  sum = 0
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf.charAt(index)) * (11 - index)
  }

  checkDigit = (sum * 10) % 11
  if (checkDigit === 10) checkDigit = 0

  return checkDigit === Number(cpf.charAt(10))
}

export function isValidEmail(value: string) {
  const email = String(value || '').trim()
  if (!email) return false

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function getAgeFromIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const [yearString, monthString, dayString] = value.split('-')
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)

  if (!year || !month || !day) return null

  const birthDate = new Date(year, month - 1, day)
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null
  }

  const now = new Date()
  let age = now.getFullYear() - year
  const beforeBirthday =
    now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)

  if (beforeBirthday) {
    age -= 1
  }

  return age
}
