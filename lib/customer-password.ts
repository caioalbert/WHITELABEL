import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const N = 131072, R = 8, P = 1
const common = new Set(['123456789012345', '1234567890123456', '12345678901234567890', 'passwordpassword', 'password123456789', 'Password123456!', 'qwertyuiopasdfgh', 'qwertyuiopasdfghjkl', 'novaaliancasaude', 'NovaAliancaSaude', 'novaaliançasaúde'])
const normalize = (password: string) => password.normalize('NFC')
export function passwordPolicy(password: string, document: string) {
  const value = normalize(password), length = Array.from(value).length
  if (length < 15 || length > 128 || Buffer.byteLength(value, 'utf8') > 512) return 'Use uma senha com 15 a 128 caracteres. Uma frase é uma boa opção.'
  if (/[\u0000-\u001f\u007f]/.test(value)) return 'Sua senha não pode conter caracteres de controle.'
  if (Array.from(common).some(item => item.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR')) || value === document || /^([\s\S])\1+$/.test(value)) return 'Escolha uma senha menos previsível.'
  return null
}
async function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => scrypt(normalize(password), salt, 32, { N, r: R, p: P, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)))
}
export async function hashCustomerPassword(password: string) {
  const salt = randomBytes(16), key = await derive(password, salt)
  return `nas-scrypt-v1$${salt.toString('hex')}$${key.toString('hex')}`
}
const DUMMY_HASH = `nas-scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(64)}`
export async function verifyCustomerPassword(password: string, stored: string | null) {
  const encoding = stored || DUMMY_HASH
  if (!/^nas-scrypt-v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(encoding)) return false
  const [, salt, expected] = encoding.split('$')
  const actual = await derive(password, Buffer.from(salt, 'hex'))
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && stored !== null
}
export function initialPassword() { return randomBytes(12).toString('base64url') }
