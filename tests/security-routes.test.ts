import { describe, expect, it } from 'vitest'
import { getAsaasWebhookToken, isHandledAsaasWebhookEvent } from '../lib/asaas-webhook-security'
import { hasValidCronAuthorization } from '../lib/rapidoc-sync-auth'
import {
  getRapidocSyncServiceType,
  isRapidocAuthenticationFailure,
  shouldLinkRapidocHolder,
} from '../lib/rapidoc-config'

describe('autenticação de integrações', () => {
  it('Rapidoc nunca libera acesso quando CRON_SECRET está ausente', () => {
    expect(hasValidCronAuthorization(null, undefined)).toBe(false)
    expect(hasValidCronAuthorization('Bearer qualquer', '')).toBe(false)
  })

  it('Rapidoc aceita somente o Bearer exato', () => {
    expect(hasValidCronAuthorization('Bearer segredo', 'segredo')).toBe(true)
    expect(hasValidCronAuthorization('Bearer errado', 'segredo')).toBe(false)
  })

  it('classifica falhas de credencial Rapidoc mesmo quando a API responde HTTP 200', () => {
    expect(isRapidocAuthenticationFailure(200, 'Authorization inválido.')).toBe(true)
    expect(isRapidocAuthenticationFailure(200, 'clientId inválido.')).toBe(true)
    expect(isRapidocAuthenticationFailure(200, 'token inválido para este cliente.')).toBe(true)
    expect(isRapidocAuthenticationFailure(200, 'Beneficiário não encontrado.')).toBe(false)
  })

  it('usa o plano GS e não vincula holder por padrão', () => {
    expect(getRapidocSyncServiceType(undefined)).toBe('GS')
    expect(getRapidocSyncServiceType('gsp')).toBe('GSP')
    expect(getRapidocSyncServiceType('inválido')).toBe('GS')
    expect(shouldLinkRapidocHolder(undefined)).toBe(false)
    expect(shouldLinkRapidocHolder('true')).toBe(true)
  })

  it('extrai os formatos aceitos de token do webhook Asaas', () => {
    expect(getAsaasWebhookToken(new Headers({ 'asaas-access-token': 'token-a' }))).toBe('token-a')
    expect(getAsaasWebhookToken(new Headers({ authorization: 'Bearer token-b' }))).toBe('token-b')
    expect(getAsaasWebhookToken(new Headers())).toBe('')
  })

  it('processa somente eventos de pagamento confirmados pelo contrato', () => {
    expect(isHandledAsaasWebhookEvent('PAYMENT_RECEIVED')).toBe(true)
    expect(isHandledAsaasWebhookEvent('PAYMENT_CONFIRMED')).toBe(true)
    expect(isHandledAsaasWebhookEvent('PAYMENT_CREATED')).toBe(false)
  })
})
