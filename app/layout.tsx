import type { Metadata } from 'next'
import type { Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { PwaAnalyticsListeners } from '@/components/pwa/pwa-analytics-listeners'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  preload: false,
})

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : configuredAppUrl && !configuredAppUrl.includes('localhost')
    ? configuredAppUrl
    : 'https://novaaliancasaude.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'Nova Aliança - Cadastro e Adesão',
  description: 'Sistema de cadastro e adesão ao serviço Nova Aliança com termo digital',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nova Aliança',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: 'Nova Aliança Saúde',
    title: 'Nova Aliança - Cadastro e Adesão',
    description: 'Sistema de cadastro e adesão ao serviço Nova Aliança com termo digital',
    images: [
      {
        url: '/nova-alianca-social.png',
        width: 1200,
        height: 630,
        alt: 'Nova Aliança Saúde',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nova Aliança - Cadastro e Adesão',
    description: 'Sistema de cadastro e adesão ao serviço Nova Aliança com termo digital',
    images: ['/nova-alianca-social.png'],
  },
  icons: {
    icon: [{ url: '/nova-alianca-icon-32.png', type: 'image/png', sizes: '32x32' }],
    shortcut: '/nova-alianca-icon-32.png',
    apple: [{ url: '/nova-alianca-apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  viewportFit: 'cover',
  colorScheme: 'light dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <ServiceWorkerRegister />
        <PwaAnalyticsListeners />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
