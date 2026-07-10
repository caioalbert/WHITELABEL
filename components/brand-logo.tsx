'use client'

import Image from 'next/image'
import { usePublicBranding } from '@/hooks/use-public-branding'
import { DEFAULT_BRANDING, isSupportedBrandLogoUrl, normalizeBranding, type PublicBranding } from '@/lib/branding'
import { cn } from '@/lib/utils'

const passthroughImageLoader = ({ src }: { src: string }) => src

type BrandLogoImageProps = {
  branding?: Partial<PublicBranding> | null
  className?: string
  logoUrl?: string
  width?: number
  height?: number
  priority?: boolean
}

export function BrandLogoImage({
  branding,
  className,
  logoUrl,
  width = 420,
  height = 136,
  priority = false,
}: BrandLogoImageProps) {
  const normalizedBranding = normalizeBranding(branding || DEFAULT_BRANDING)
  const overrideLogoUrl = String(logoUrl || '').trim()
  const src = isSupportedBrandLogoUrl(overrideLogoUrl) && overrideLogoUrl
    ? overrideLogoUrl
    : normalizedBranding.brandLogoUrl

  return (
    <Image
      loader={passthroughImageLoader}
      src={src}
      alt={normalizedBranding.brandLogoAlt}
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={cn('object-contain', className)}
    />
  )
}

type BrandLogoProps = Omit<BrandLogoImageProps, 'branding'>

export function BrandLogo(props: BrandLogoProps) {
  const branding = usePublicBranding()
  return <BrandLogoImage branding={branding} {...props} />
}
