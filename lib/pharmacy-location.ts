type AddressComponent = { long_name: string; short_name: string; types: string[] }
type GeocoderResult = { address_components: AddressComponent[] }
type BrowserGoogle = { maps: { Geocoder: new () => { geocode(options: { location: { lat: number; lng: number } }): Promise<{ results: GeocoderResult[] }> } } }
declare global { interface Window { google?: BrowserGoogle; initPharmacyLocation?: () => void } }
let sdkPromise: Promise<void> | null = null
function loadLocationSdk(key: string) {
  if (window.google?.maps.Geocoder) return Promise.resolve()
  if (!sdkPromise) sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const timer = window.setTimeout(() => { sdkPromise = null; script.remove(); reject(new Error('Não foi possível localizar sua região. Escolha estado e cidade.')) }, 15000)
    window.initPharmacyLocation = () => { clearTimeout(timer); resolve() }
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=initPharmacyLocation&language=pt-BR&region=BR`
    script.async = true
    script.onerror = () => { clearTimeout(timer); sdkPromise = null; script.remove(); reject(new Error('Não foi possível consultar sua região.')) }
    document.head.append(script)
  })
  return sdkPromise
}
export async function locatePharmacyRegion(key: string, point: { lat: number; lng: number }, regions: { uf: string; cidade: string }[]) {
  if (!key) throw new Error('Escolha estado e cidade para consultar as lojas.')
  await loadLocationSdk(key)
  if (!window.google) throw new Error('Escolha estado e cidade para consultar as lojas.')
  const { results } = await new window.google.maps.Geocoder().geocode({ location: point })
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  for (const result of results) {
    const uf = result.address_components.find(c => c.types.includes('administrative_area_level_1'))?.short_name
    const city = result.address_components.find(c => c.types.includes('administrative_area_level_2'))?.long_name
    const match = regions.find(r => r.uf === uf && normalize(r.cidade) === normalize(city || ''))
    if (match) return match
  }
  throw new Error('Não encontramos lojas cadastradas na sua cidade. Escolha outra região.')
}
