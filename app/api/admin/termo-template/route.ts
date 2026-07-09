import {
  getTermoTemplateInfo,
  removeCustomTermoBodyText,
  saveTermoBodyText,
} from '@/lib/termo-template'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function decodeXmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

async function extractDocxText(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const documentFile = zip.file('word/document.xml')

  if (!documentFile) {
    throw new Error('Arquivo .docx inválido: conteúdo principal não encontrado')
  }

  const xml = await documentFile.async('string')

  const plainText = xml
    .replace(/<w:p\b[^>]*>/g, '\n\n')
    .replace(/<\/w:p>/g, '')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<w:cr\/>/g, '\n')
    .replace(/<[^>]+>/g, '')

  return decodeXmlEntities(plainText)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const info = await getTermoTemplateInfo()

  return NextResponse.json({
    success: true,
    ...info,
    instructions: [
      'Envie arquivo .txt, .md ou .docx.',
      'Máximo de 200KB.',
      'Separe os parágrafos com linha em branco.',
      'Use títulos em linha isolada (ex: TELEMEDICINA, ASSISTÊNCIA FUNERÁRIA).',
    ],
  })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const formData = await request.formData()
    const template = formData.get('template')

    if (!template || !(template instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo de template não enviado' },
        { status: 400 }
      )
    }

    const fileName = template.name.toLowerCase()
    const isDocx = fileName.endsWith('.docx')
    const isTxtOrMd = /\.(txt|md)$/i.test(fileName)
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      DOCX_MIME_TYPE,
      'application/octet-stream',
      'application/zip',
    ]
    const isAllowedType = template.type ? allowedTypes.includes(template.type) : true
    const isAllowedName = isTxtOrMd || isDocx

    if (!isAllowedType || !isAllowedName) {
      return NextResponse.json(
        { error: 'Formato inválido. Use arquivo .txt, .md ou .docx' },
        { status: 400 }
      )
    }

    const text = isDocx ? await extractDocxText(template) : await template.text()
    await saveTermoBodyText(text)

    const info = await getTermoTemplateInfo()

    return NextResponse.json({
      success: true,
      message: 'Template salvo com sucesso',
      ...info,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar template'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  await removeCustomTermoBodyText()
  const info = await getTermoTemplateInfo()

  return NextResponse.json({
    success: true,
    message: 'Template personalizado removido. Voltando para o padrão.',
    ...info,
  })
}
