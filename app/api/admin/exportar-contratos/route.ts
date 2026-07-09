import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { getTermoBodyText } from '@/lib/termo-template'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import JSZip from 'jszip'
import React from 'react'
import { get } from '@vercel/blob'
import { TermoAdesaoPDF } from '../gerar-pdf/TermoAdesaoPDF'

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function getUniqueFileName(baseName: string, usedNames: Map<string, number>) {
  const count = usedNames.get(baseName) || 0
  usedNames.set(baseName, count + 1)

  if (count === 0) {
    return baseName
  }

  return `${baseName}-${count + 1}`
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const arrayBuffer = await new Response(stream).arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = createAdminClient()

    const { data: cadastros, error: cadastrosError } = await supabase
      .from('cadastros')
      .select('*')
      .order('created_at', { ascending: false })

    if (cadastrosError) {
      return NextResponse.json(
        { error: 'Erro ao buscar clientes' },
        { status: 500 }
      )
    }

    if (!cadastros || cadastros.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum contrato encontrado para exportar' },
        { status: 404 }
      )
    }

    const cadastroIds = cadastros.map((cadastro) => cadastro.id)
    const { data: dependentes, error: dependentesError } = await supabase
      .from('dependentes')
      .select('*')
      .in('cadastro_id', cadastroIds)

    if (dependentesError) {
      console.error('Dependentes fetch error:', dependentesError)
    }

    const dependentesByCadastroId = new Map<string, any[]>()
    ;(dependentes || []).forEach((dependente) => {
      const current = dependentesByCadastroId.get(dependente.cadastro_id) || []
      current.push(dependente)
      dependentesByCadastroId.set(dependente.cadastro_id, current)
    })

    const termoBodyText = await getTermoBodyText()
    const zip = new JSZip()
    const usedNames = new Map<string, number>()

    for (const cadastro of cadastros) {
      let pdfBuffer: Buffer | null = null

      if (cadastro.termo_pdf_path) {
        try {
          const storedPdf = await get(cadastro.termo_pdf_path, { access: 'private' })
          if (!storedPdf?.stream) {
            throw new Error('Stored PDF not found')
          }

          pdfBuffer = await streamToBuffer(storedPdf.stream)
        } catch (storedPdfError) {
          console.warn('Could not read stored PDF, regenerating...', {
            cadastroId: cadastro.id,
            termo_pdf_path: cadastro.termo_pdf_path,
            error: storedPdfError,
          })
        }
      }

      if (!pdfBuffer) {
        const pdfDocument = React.createElement(TermoAdesaoPDF, {
          data: cadastro,
          dependentes: dependentesByCadastroId.get(cadastro.id) || [],
          termoBodyText,
        }) as unknown as React.ReactElement<DocumentProps>

        const generatedBuffer = await renderToBuffer(pdfDocument)
        pdfBuffer = Buffer.from(generatedBuffer)
      }

      const safeName = sanitizeFileName(cadastro.nome || '')
      const baseFileName = safeName || 'contrato'
      const uniqueFileName = getUniqueFileName(baseFileName, usedNames)

      zip.file(`${uniqueFileName}.pdf`, pdfBuffer)
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="contratos-shalom-${date}.zip"`,
      },
    })
  } catch (error) {
    console.error('Bulk PDF export error:', error)
    return NextResponse.json(
      { error: 'Erro ao exportar contratos' },
      { status: 500 }
    )
  }
}
