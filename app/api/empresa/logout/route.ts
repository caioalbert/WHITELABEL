import { EMPRESA_APP_COOKIE, EMPRESA_FLOW_COOKIE } from '@/lib/supabase/empresa-auth'
import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(EMPRESA_APP_COOKIE)
  response.cookies.delete(EMPRESA_FLOW_COOKIE)
  return response
}
