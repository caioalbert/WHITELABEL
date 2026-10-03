/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  outputFileTracingIncludes: { '/api/cliente/login': ['./public/logo-nova-alianca-azul.png'] },
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, max-age=0, must-revalidate' }] }]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
