import fs from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
const source = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
function worker() {
  const handlers: Record<string, (event: unknown) => void> = {}
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), match: vi.fn() }
  const caches = { keys: vi.fn().mockResolvedValue(['whitelabel-pwa-v6','other-app-cache','whitelabel-pwa-v7']), delete: vi.fn().mockResolvedValue(true), open: vi.fn().mockResolvedValue(cache), match: vi.fn().mockResolvedValue(new Response('old red pin script')) }
  const fetch = vi.fn().mockResolvedValue(new Response('new logo pin script'))
  vm.runInNewContext(source, { self: { addEventListener: (name: string, fn: (e: unknown) => void) => handlers[name] = fn, location: { origin: 'https://example.com' }, clients: { claim: vi.fn().mockResolvedValue(undefined) } }, caches, fetch, Request, Response, URL })
  return { handlers, caches, fetch, cache }
}
describe('atualização do cache de pins em aparelhos existentes', () => {
  it('remove v6 e preserva caches que não pertencem ao app', async () => { const w = worker(); let work: Promise<unknown> | undefined; w.handlers.activate({ waitUntil: (p: Promise<unknown>) => work=p }); await work; expect(w.caches.delete.mock.calls).toEqual([['whitelabel-pwa-v6']]) })
  it('consulta o script novo mesmo que a versão antiga já exista no cache', async () => { const w = worker(); let response: Promise<Response> | undefined; w.handlers.fetch({ request: Object.defineProperty(new Request('https://example.com/pharmacy-map.js'), 'destination', { value: 'script' }), respondWith: (p: Promise<Response>) => response=p, waitUntil: () => {} }); expect(await (await response!).text()).toBe('new logo pin script'); expect(w.fetch).toHaveBeenCalledTimes(1); expect(w.caches.match).not.toHaveBeenCalled() })
  it('não intercepta APIs autenticadas', () => { const w = worker(); const respondWith = vi.fn(); w.handlers.fetch({ request: { url: 'https://example.com/api/cliente/farmacia-popular', method: 'GET' }, respondWith }); expect(respondWith).not.toHaveBeenCalled() })
})
