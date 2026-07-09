import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { getTermoBodyText } from '@/lib/termo-template'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { get } from '@vercel/blob'
import { TermoAdesaoPDF } from './TermoAdesaoPDF'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const cadastroId = body?.cadastroId

    if (!cadastroId || typeof cadastroId !== 'string') {
      return NextResponse.json(
        { error: 'cadastroId é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Buscar cadastro
    const { data: cadastro, error: cadastroError } = await supabase
      .from('cadastros')
      .select('*')
      .eq('id', cadastroId)
      .single()

    if (cadastroError || !cadastro) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    if (cadastro.termo_pdf_path) {
      try {
        const storedPdf = await get(cadastro.termo_pdf_path, {
          access: 'private',
          ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
        })

        if (!storedPdf) {
          throw new Error('Stored PDF not found')
        }

        if (storedPdf.statusCode === 304) {
          return new NextResponse(null, {
            status: 304,
            headers: {
              ETag: storedPdf.blob.etag,
              'Cache-Control': 'private, no-cache',
            },
          })
        }

        if (!storedPdf.stream) {
          throw new Error('Stored PDF stream is empty')
        }

        return new NextResponse(storedPdf.stream, {
          headers: {
            'Content-Type': storedPdf.blob.contentType || 'application/pdf',
            'Content-Disposition': `attachment; filename="termo-adesao-${cadastro.cpf}.pdf"`,
            ETag: storedPdf.blob.etag,
            'Cache-Control': 'private, no-cache',
          },
        })
      } catch (storedPdfError) {
        console.warn('Stored PDF not available, regenerating...', {
          cadastroId,
          termo_pdf_path: cadastro.termo_pdf_path,
          error: storedPdfError,
        })
      }
    }

    // Buscar dependentes
    const { data: dependentes } = await supabase
      .from('dependentes')
      .select('*')
      .eq('cadastro_id', cadastroId)

    const termoBodyText = await getTermoBodyText()

    // Gerar PDF usando renderToBuffer do @react-pdf/renderer
    const pdfDocument = React.createElement(TermoAdesaoPDF, {
      data: cadastro,
      dependentes: dependentes || [],
      termoBodyText,
    }) as unknown as React.ReactElement<DocumentProps>

    const pdfBuffer = await renderToBuffer(pdfDocument)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="termo-adesao-${cadastro.cpf}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF' },
      { status: 500 }
    )
  }
}
