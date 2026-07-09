import { createClient } from '@/lib/supabase/server'
import { getTermoBodyText } from '@/lib/termo-template'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { Resend } from 'resend'
import { get, put } from '@vercel/blob'
import { TermoAdesaoPDF } from '../admin/gerar-pdf/TermoAdesaoPDF'

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const arrayBuffer = await new Response(stream).arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const cadastroId = body?.cadastroId

    if (!cadastroId) {
      return NextResponse.json(
        { error: 'cadastroId é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Buscar cadastro
    const { data: cadastro, error: cadastroError } = await supabase
      .from('cadastros')
      .select('*')
      .eq('id', cadastroId)
      .single()

    if (cadastroError) {
      const details = `${cadastroError.message || ''} ${cadastroError.details || ''}`
      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      if (cadastroError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Cliente não encontrado' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: cadastroError.message || 'Erro ao consultar cliente' },
        { status: 500 }
      )
    }

    if (!cadastro) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    if (cadastro.status && cadastro.status !== 'ATIVO') {
      return NextResponse.json(
        { error: 'Termo disponível somente após confirmação do pagamento da adesão.' },
        { status: 409 }
      )
    }

    const { data: dependentes, error: dependentesError } = await supabase
      .from('dependentes')
      .select('*')
      .eq('cadastro_id', cadastroId)

    if (dependentesError) {
      const details = `${dependentesError.message || ''} ${dependentesError.details || ''}`
      if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: 'Erro ao buscar dependentes para anexar o termo.' },
        { status: 500 }
      )
    }

    let pdfBuffer: Buffer | null = null

    // Reenvio: reaproveita o contrato já gerado
    if (cadastro.termo_pdf_path) {
      try {
        const existingPdf = await get(cadastro.termo_pdf_path, { access: 'private' })
        if (!existingPdf?.stream) {
          throw new Error('Stored PDF not found')
        }

        pdfBuffer = await streamToBuffer(existingPdf.stream)
      } catch (readStoredPdfError) {
        console.warn('Could not read stored PDF, regenerating...', {
          cadastroId,
          termo_pdf_path: cadastro.termo_pdf_path,
          error: readStoredPdfError,
        })
      }
    }

    // Primeiro envio: gera e salva PDF final
    if (!pdfBuffer) {
      const termoBodyText = await getTermoBodyText()
      const pdfDocument = React.createElement(TermoAdesaoPDF, {
        data: cadastro,
        dependentes: dependentes || [],
        termoBodyText,
      }) as unknown as React.ReactElement<DocumentProps>

      const generatedBuffer = await renderToBuffer(pdfDocument)
      pdfBuffer = Buffer.from(generatedBuffer)

      const safeName = sanitizeFileName(cadastro.nome || '')
      const fallbackId = String(cadastro.cpf || cadastroId)
        .replace(/\D/g, '')
        .slice(-11)

      const pdfBlob = await put(
        `termos/${Date.now()}-${safeName || fallbackId || 'contrato'}.pdf`,
        pdfBuffer,
        {
          access: 'private',
          contentType: 'application/pdf',
        }
      )

      await supabase
        .from('cadastros')
        .update({ termo_pdf_path: pdfBlob.pathname })
        .eq('id', cadastroId)
    }

    const safeName = sanitizeFileName(cadastro.nome || '')
    const fallbackId = String(cadastro.cpf || cadastroId)
      .replace(/\D/g, '')
      .slice(-11)
    const attachmentFileName = `termo-adesao-${safeName || fallbackId || 'contrato'}.pdf`

    // Verificar se Resend está configurado
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY não configurado. Email não será enviado.')
      await supabase
        .from('cadastros')
        .update({ email_enviado_em: new Date().toISOString() })
        .eq('id', cadastroId)

      return NextResponse.json({
        success: true,
        message: 'Cliente processado. Configure RESEND_API_KEY para enviar emails.',
      })
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev'
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { error: emailError } = await resend.emails.send({
      from: `SHALOM Saúde <${fromEmail}>`,
      to: cadastro.email,
      subject: 'Seu Termo de Adesão - SHALOM Saúde',
      attachments: [
        {
          filename: attachmentFileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <div style="background: linear-gradient(135deg, #1d4ed8, #4f46e5); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SHALOM Saúde</h1>
            <p style="color: #bfdbfe; margin: 8px 0 0 0;">Confirmação de Adesão</p>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e40af; margin-top: 0;">Olá, ${cadastro.nome}!</h2>
            <p>Seu cadastro foi realizado com sucesso e o Termo de Adesão ao serviço SHALOM Saúde foi gerado.</p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Dados do Cliente</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 40%;">Nome:</td><td style="padding: 6px 0; font-weight: 500; font-size: 13px;">${cadastro.nome}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">CPF:</td><td style="padding: 6px 0; font-weight: 500; font-size: 13px;">${cadastro.cpf}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Email:</td><td style="padding: 6px 0; font-weight: 500; font-size: 13px;">${cadastro.email}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Cliente desde:</td><td style="padding: 6px 0; font-weight: 500; font-size: 13px;">${cadastro.created_at ? new Date(cadastro.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td></tr>
              </table>
            </div>
            <p style="font-size: 13px; color: #6b7280;">Seu termo segue em anexo neste email em formato PDF.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">Este é um email automático do sistema SHALOM Saúde. Não responda a este email.</p>
          </div>
        </body>
        </html>
      `,
    })

    if (emailError) {
      console.error('Resend error:', {
        to: cadastro.email,
        fromEmail,
        attachmentFileName,
        error: emailError,
      })
      return NextResponse.json(
        { error: 'Erro ao enviar email' },
        { status: 500 }
      )
    }

    // Atualizar status no banco
    await supabase
      .from('cadastros')
      .update({ email_enviado_em: new Date().toISOString() })
      .eq('id', cadastroId)

    return NextResponse.json({
      success: true,
      message: 'Email enviado com sucesso com contrato em anexo',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/fetch failed|enotfound|getaddrinfo|network/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        },
        { status: 503 }
      )
    }

    console.error('Email send error:', error)
    return NextResponse.json(
      { error: 'Erro ao enviar email' },
      { status: 500 }
    )
  }
}
