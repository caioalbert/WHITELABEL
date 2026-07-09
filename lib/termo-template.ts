import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { del, get, head, put } from '@vercel/blob'

const TEMPLATE_FILE_NAME = 'termo-adesao-custom.txt'
const TEMPLATE_BLOB_PATH = `templates/${TEMPLATE_FILE_NAME}`
const TEMPLATE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'templates')
  : path.join(process.cwd(), 'templates')
const TEMPLATE_FILE = path.join(TEMPLATE_DIR, TEMPLATE_FILE_NAME)
const MAX_TEMPLATE_SIZE_BYTES = 200 * 1024

export const DEFAULT_TERMO_BODY = `TELEMEDICINA

O Paciente ou seu Representante Legal reconhece e concorda que a plataforma RAPIDOC (RD BRASIL INTERMEDIACOES LTDA), empresa de direito privado, com sede na Avenida Itacolomi, n° 3160, Bairro São Vicente, na cidade de Gravataí, Rio Grande do Sul, CEP 94155-222, inscrita no CNPJ de n° 27.696.922/0001-31 é um meio de viabilizar a TELECONSULTA, possibilitando o atendimento médico ao paciente de forma remota nos moldes determinados pela Resolução CFM n° 2.314/2022.

O Paciente ou seu Representante Legal declara estar ciente de que a Igreja Cristã Ministério Efraim – CNPJ 43.677.025/0001-37, trata-se meramente de Agenciadora/Vendedora do produto do Prestador de Serviço de Telemedicina RAPIDOC, e se isenta de quaisquer responsabilidades referente ao serviço de Telemedicina prestado pela RAPIDOC.

Pelo presente termo, o paciente ou seu representante legal declara que procurou o serviço de Telemedicina RAPIDOC por livre e espontânea vontade para fins de realização de atendimento online e, para tanto, declara que, na condição de paciente/responsável legal, obteve orientação e esclarecimentos suficientes sobre o ato médico.

A prestação do serviço contempla atendimento pré-clínico, de suporte assistencial, de consulta, monitoramento e diagnóstico, por meio de tecnologia da informação para Clínico Geral e nas modalidades de Cardiologia, Dermatologia, Endocrinologia, Geriatria, Ginecologia, Neurologia, Pediatria, Psiquiatria, Traumatologia, Otorrinolaringologia e Urologia através da plataforma.

Telemedicina RAPIDOC não se trata de Seguro Saúde, bem como não possui cobertura para exames laboratoriais, operações cirúrgicas, internações e/ou consultas e/ou atendimentos emergenciais em hospitais e/ou outros, e nem oferece reembolso de despesas médicas, ficando estes custos a cargo do paciente/representante legal.

A plataforma de Telemedicina RAPIDOC transmitirá ao médico as informações pessoais e de saúde via videoconferência, bem como permitirá o registro dos dados coletados através da videoconferência em prontuário para todos os fins.

Estar ciente de que paciente menor de 18 (dezoito) anos deve estar acompanhado, no momento da consulta, de um responsável legal.

Conhecimento de que todas as informações estão asseguradas pelo sigilo médico, e como tal deve garantir sua confidencialidade, sob pena de responsabilização legal.

Concorda que as informações pessoais poderão ser compartilhadas com outros profissionais de saúde, e que a presente autorização é concedida a título gratuito, por tempo indeterminado, em todo o território nacional.

A plataforma do serviço de Telemedicina RAPIDOC dispõe de prescrição exclusivamente digital de receituários, emissão de atestados e pedidos de exames, com certificação digital do médico responsável.

Assim, expresso meu pleno consentimento para utilização da plataforma Telemedicina RAPIDOC.

ASSISTÊNCIA FUNERÁRIA

Constituem-se em objeto da presente contratação a aquisição de plano de assistência funeral junto ao Grupo Zêlo com objetivo de prestar assessoria e intermediação de benefícios para realização de homenagens póstumas pela prestação de serviço funerário, nos termos autorizados pela Lei Federal n.º 13.261 de 22 de março de 2016.

Serviços disponibilizados:
a) Urna mortuária de madeira envernizada sextavada com alça varão e visor ou similar;
b) Enfeite floral na urna;
c) Higienização ou Tanatopraxia, se necessário;
d) Véu;
e) 01 (uma) coroa de flores em nome da CONTRATANTE;
f) Paramentação conforme o credo religioso;
g) Guia de sepultamento;
h) Providências administrativas;
i) Veículo para remoção dentro do município de moradia habitual da pessoa falecida;
j) Veículo fúnebre para cortejo dentro do município de moradia habitual da pessoa falecida;
k) Veículo para traslado estadual ou interestadual, até o município de moradia habitual da pessoa falecida, sem limite de quilometragem;
l) Traslado aéreo de corpo, em território nacional, até o município de moradia habitual da pessoa falecida;
m) Aluguel de velório dentro das instalações da CONTRATADA, suas filiais, empresas controladas, controladoras, coligadas ou sob controle comum (Grupo Zelo) ou em cemitério municipal;
n) Kit lanche dentro das instalações do Grupo Zelo;
o) Taxa de sepultamento em cemitério municipal no município de moradia habitual da pessoa falecida;
p) Cremação de corpo em local a ser definido pela CONTRATADA.

A disponibilização e/ou assistência funerária terá abrangência geográfica em todo o território nacional.

O descumprimento de quaisquer obrigações previstas neste termo, em especial o inadimplemento das parcelas acordadas, implicará na suspensão imediata da obrigação da CONTRATADA em disponibilizar, fornecer ou realizar os serviços até regularização.

Caso a inadimplência não ultrapasse 15 (quinze) dias, poderá o(a) Titular/Responsável Financeiro regularizar a situação mediante pagamento integral das parcelas vencidas, acrescidas de multa contratual, juros e atualização monetária.

Caso a inadimplência não seja regularizada no prazo de 30 (trinta) dias, este Plano de Assistência Funeral poderá ser rescindido.

A partir da rescisão, os serviços contratados deixarão de ser disponibilizados ou prestados, independentemente de aviso ou notificação prévia.

O acesso e obtenção das disponibilizações e/ou entregas dos serviços ocorrerá sempre 90 (noventa) dias após a inclusão dos beneficiários classificados como titular e/ou dependente.

Fica estabelecido o reajuste dos valores da mensalidade todo mês de dezembro, de acordo com a IGPM ou a sinistralidade.

Para dirimir quaisquer discussões decorrentes dos serviços, será competente o Foro das Varas Cíveis da Comarca da cidade sede da CONTRATANTE.

CLÁUSULA DE FIDELIZAÇÃO E CANCELAMENTO ANTECIPADO

1. Fica estabelecido o prazo mínimo de fidelidade de 12 (doze) meses para a manutenção dos serviços contratados, contados a partir da data de adesão a este termo.

2. O presente contrato poderá ser rescindido imotivadamente pelo(a) CONTRATANTE/PACIENTE durante o período de fidelidade estipulado, mediante solicitação formal com aviso prévio de 30 (trinta) dias.

3. Na hipótese de rescisão antecipada solicitada pelo(a) CONTRATANTE/PACIENTE antes de completado o prazo de 12 (doze) meses, incidirá multa rescisória equivalente a 10% (dez por cento) do valor correspondente à soma das mensalidades vincendas (restantes) para o cumprimento total do período de fidelidade.

4. Após o término do período inicial de 12 (doze) meses, o presente termo passará a vigorar por prazo indeterminado, podendo ser cancelado a qualquer momento pelo(a) CONTRATANTE/PACIENTE sem a incidência de qualquer multa rescisória, desde que respeitado o aviso prévio de 30 (trinta) dias e não haja pendências financeiras.`

function sanitizeTemplate(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .trim()
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

async function getCustomTemplateFromBlob() {
  if (!hasBlobToken()) return null

  const result = await get(TEMPLATE_BLOB_PATH, {
    access: 'private',
    useCache: false,
  })

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null
  }

  return new Response(result.stream).text()
}

export async function getTermoBodyText() {
  try {
    const blobTemplate = await getCustomTemplateFromBlob()
    if (blobTemplate) {
      const sanitizedBlobTemplate = sanitizeTemplate(blobTemplate)
      if (sanitizedBlobTemplate) {
        return sanitizedBlobTemplate
      }
    }

    const customTemplate = await fs.readFile(TEMPLATE_FILE, 'utf8')
    const sanitized = sanitizeTemplate(customTemplate)
    return sanitized || DEFAULT_TERMO_BODY
  } catch {
    return DEFAULT_TERMO_BODY
  }
}

export async function saveTermoBodyText(content: string) {
  const sanitized = sanitizeTemplate(content)

  if (!sanitized) {
    throw new Error('O template está vazio')
  }

  const size = Buffer.byteLength(sanitized, 'utf8')
  if (size > MAX_TEMPLATE_SIZE_BYTES) {
    throw new Error('O template excede 200KB')
  }

  if (hasBlobToken()) {
    await put(TEMPLATE_BLOB_PATH, sanitized, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'text/plain; charset=utf-8',
    })
    return
  }

  await fs.mkdir(TEMPLATE_DIR, { recursive: true })
  await fs.writeFile(TEMPLATE_FILE, sanitized, 'utf8')
}

export async function removeCustomTermoBodyText() {
  if (hasBlobToken()) {
    try {
      await del(TEMPLATE_BLOB_PATH)
    } catch {
      // ignore
    }
    return
  }

  try {
    await fs.unlink(TEMPLATE_FILE)
  } catch {
    // ignore
  }
}

export async function getTermoTemplateInfo() {
  if (hasBlobToken()) {
    try {
      const blobInfo = await head(TEMPLATE_BLOB_PATH)
      return {
        hasCustomTemplate: true,
        sizeBytes: blobInfo.size,
        updatedAt: blobInfo.uploadedAt.toISOString(),
        fileName: TEMPLATE_FILE_NAME,
      }
    } catch {
      // fallback to local
    }
  }

  try {
    const stat = await fs.stat(TEMPLATE_FILE)
    return {
      hasCustomTemplate: true,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      fileName: TEMPLATE_FILE_NAME,
    }
  } catch {
    return {
      hasCustomTemplate: false,
      sizeBytes: 0,
      updatedAt: null as string | null,
      fileName: TEMPLATE_FILE_NAME,
    }
  }
}
