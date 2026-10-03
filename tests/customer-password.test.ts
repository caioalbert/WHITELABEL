import { describe, expect, it } from 'vitest'
import { hashCustomerPassword, verifyCustomerPassword, initialPassword, passwordPolicy } from '../lib/customer-password'
import { buildCustomerAccessEmail } from '../lib/customer-access-email'

describe('customer password material', () => {
  it('hashes with independent salts, accepts NFC equivalence and rejects wrong/dummy/malformed hashes', async () => {
    const password = 'Uma frase pessoal com café'
    const a = await hashCustomerPassword(password), b = await hashCustomerPassword(password)
    expect(a).not.toBe(b); expect(a).not.toContain(password)
    expect(await verifyCustomerPassword(password.normalize('NFD'), a)).toBe(true)
    expect(await verifyCustomerPassword('Uma frase pessoal incorreta', a)).toBe(false)
    expect(await verifyCustomerPassword(password, null)).toBe(false)
    expect(await verifyCustomerPassword(password, 'nas-scrypt-v1$999999999999$anything')).toBe(false)
    expect(initialPassword()).toMatch(/^[A-Za-z0-9_-]{16}$/)
  }, 30000)
  it('accepts long phrases without forced composition and blocks weak/control/oversized passwords', () => {
    expect(passwordPolicy('esta é minha frase de acesso', '52998224725')).toBeNull()
    expect(passwordPolicy('x'.repeat(129), '52998224725')).toBeTruthy()
    expect(passwordPolicy('Curta!', '52998224725')).toBeTruthy()
    expect(passwordPolicy('PASSWORDPASSWORD', '52998224725')).toBeTruthy()
    expect(passwordPolicy('uma senha com\ncontrole', '52998224725')).toBeTruthy()
  })
  it('produces escaped named HTML/text with the logo and no temporary expiry', () => {
    const mail = buildCustomerAccessEmail({ nome: '<img src=x onerror="alert(1)">', password: 'Temp<&"Password123' })
    expect(mail.html).toContain('&lt;img'); expect(mail.html).not.toContain('onerror="alert')
    expect(mail.html).toContain('Válida até o primeiro uso'); expect(mail.text).toContain('não tem prazo de expiração')
    expect(mail.html + mail.text).not.toMatch(/24\s*(horas|h)/i)
    expect(mail.html).toContain('logo-nova-alianca-azul.png'); expect(mail.text).toContain('CPF cadastrado')
    expect(mail.text).toContain('criar sua senha pessoal')
  })
})
