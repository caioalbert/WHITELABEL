import { requireAdminAuth } from "@/lib/supabase/admin-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidCNPJ, isValidEmail, normalizeCNPJ } from "@/lib/utils"
import { NextRequest, NextResponse } from "next/server"

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
function num(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const EMPRESA_LIST_FIELDS =
  "id, razao_social, nome_fantasia, cnpj, email, telefone, responsavel_nome, status, tipo_plano, quantidade_funcionarios, valor_por_funcionario, mensalidade_valor, sem_adesao, created_at, updated_at"
const EMPRESA_LEGACY_LIST_FIELDS =
  "id, razao_social, nome_fantasia, cnpj, email, telefone, responsavel_nome, status, tipo_plano, quantidade_funcionarios, valor_por_funcionario, mensalidade_valor, created_at, updated_at"

function isMissingEmpresaCommercialTerms(error: unknown) {
  const candidate = error as { code?: string; message?: string; details?: string } | null
  const details = `${candidate?.code || ""} ${candidate?.message || ""} ${candidate?.details || ""}`
  return /42703|empresas\.(sem_adesao|valor_adesao).*does not exist/i.test(details)
}

// ─── GET: lista todas as empresas ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const supabase = createAdminClient()
    let { data, error } = await supabase
      .from("empresas")
      .select(EMPRESA_LIST_FIELDS)
      .order("created_at", { ascending: false })

    if (error && isMissingEmpresaCommercialTerms(error)) {
      const legacyResult = await supabase
        .from("empresas")
        .select(EMPRESA_LEGACY_LIST_FIELDS)
        .order("created_at", { ascending: false })
      data = legacyResult.data?.map((empresa) => ({ ...empresa, sem_adesao: true })) ?? null
      error = legacyResult.error
    }

    if (error) throw error
    return NextResponse.json({ success: true, empresas: data || [] })
  } catch (error) {
    console.error("Erro ao listar empresas:", error)
    return NextResponse.json({ error: "Erro ao listar empresas." }, { status: 500 })
  }
}

// ─── POST: cria empresa + funcionários (admin, status ATIVO direto) ───────────
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: "Payload inválido." }, { status: 400 })

    // Dados da empresa
    const empresa = {
      razao_social: text(body.razao_social),
      nome_fantasia: text(body.nome_fantasia) || null,
      cnpj: normalizeCNPJ(text(body.cnpj)),
      email: text(body.email).toLowerCase(),
      telefone: text(body.telefone),
      responsavel_nome: text(body.responsavel_nome),
      endereco: text(body.endereco) || null,
      numero: text(body.numero) || null,
      complemento: text(body.complemento) || null,
      bairro: text(body.bairro) || null,
      cidade: text(body.cidade) || null,
      estado: text(body.estado).toUpperCase() || null,
      cep: text(body.cep).replace(/\D/g, "") || null,
    }

    if (!empresa.razao_social || !empresa.email || !empresa.telefone || !empresa.responsavel_nome) {
      return NextResponse.json({ error: "Preencha razão social, email, telefone e nome do responsável." }, { status: 400 })
    }
    if (!isValidCNPJ(empresa.cnpj)) return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 })
    if (!isValidEmail(empresa.email)) return NextResponse.json({ error: "Email inválido." }, { status: 400 })

    // Condições comerciais
    const cobrarAdesao = body.cobrar_adesao === true
    const valorAdesao  = cobrarAdesao ? (num(body.valor_adesao) ?? 0) : 0
    const valorMensal  = num(body.valor_mensal)
    const tipoPlano    = text(body.tipo_plano) || "EMPRESARIAL"

    if (!valorMensal || valorMensal <= 0) {
      return NextResponse.json({ error: "Informe o valor mensal acordado (maior que zero)." }, { status: 400 })
    }
    if (cobrarAdesao && valorAdesao <= 0) {
      return NextResponse.json({ error: "Informe o valor da adesão (maior que zero)." }, { status: 400 })
    }

    // Funcionários
    const rawFuncionarios = Array.isArray(body.funcionarios) ? body.funcionarios : []
    if (rawFuncionarios.length === 0) {
      return NextResponse.json({ error: "A lista de funcionários não pode estar vazia." }, { status: 400 })
    }

    const funcionarios = rawFuncionarios.map((raw) => {
      const item = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {}
      const tel = item.telefone_celular ?? item.telefone
      return {
        nome: text(item.nome),
        cpf:  text(item.cpf).replace(/\D/g, ""),
        rg:   text(item.rg) || null,
        email: text(item.email).toLowerCase(),
        telefone: typeof tel === "string" ? tel.trim() : "",
        data_nascimento: text(item.data_nascimento) || null,
        sexo:  text(item.sexo) || null,
        cargo: text(item.cargo) || null,
      }
    })

    const invalidFunc = funcionarios.find((f) => !f.nome || !f.email || !isValidEmail(f.email))
    if (invalidFunc) {
      return NextResponse.json(
        { error: "Dados inválidos para o funcionário " + (invalidFunc.nome || "sem nome") + ". Verifique nome e email." },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Verificar duplicidade
    const [existingCnpj, existingEmail] = await Promise.all([
      supabase.from("empresas").select("id").eq("cnpj", empresa.cnpj).limit(1),
      supabase.from("empresas").select("id").eq("email", empresa.email).limit(1),
    ])
    if (existingCnpj.error || existingEmail.error) throw existingCnpj.error || existingEmail.error
    if (existingCnpj.data?.length || existingEmail.data?.length) {
      return NextResponse.json({ error: "CNPJ ou email já cadastrado para outra empresa." }, { status: 409 })
    }

    const valorPorFunc = Math.round((valorMensal / Math.max(1, rawFuncionarios.length) + Number.EPSILON) * 100) / 100

    // Inserir empresa
    const { data: novaEmpresa, error: insertEmpresaError } = await supabase
      .from("empresas")
      .insert({
        ...empresa,
        tipo_plano: tipoPlano,
        status: "ATIVO",
        sem_adesao: !cobrarAdesao,
        valor_adesao: cobrarAdesao ? valorAdesao : null,
        valor_por_funcionario: valorPorFunc,
        mensalidade_valor: valorMensal,
        quantidade_funcionarios: rawFuncionarios.length,
        minimo_funcionarios: rawFuncionarios.length,
        lista_funcionarios_enviada_em: new Date().toISOString(),
        pagamento_confirmado_em: new Date().toISOString(),
      })
      .select("id, razao_social, cnpj, status")
      .single()

    if (insertEmpresaError || !novaEmpresa) {
      const details = String(insertEmpresaError?.message ?? "") + " " + String(insertEmpresaError?.details ?? "")
      if (/duplicate|empresas_cnpj|empresas_email/i.test(details)) {
        return NextResponse.json({ error: "CNPJ ou email já cadastrado para outra empresa." }, { status: 409 })
      }
      throw insertEmpresaError ?? new Error("Não foi possível salvar a empresa.")
    }

    // Inserir funcionários
    const { error: insertFuncError } = await supabase
      .from("empresa_funcionarios")
      .insert(funcionarios.map((f) => ({ empresa_id: novaEmpresa.id, ...f })))

    if (insertFuncError) {
      await supabase.from("empresas").delete().eq("id", novaEmpresa.id)
      throw insertFuncError
    }

    return NextResponse.json({ success: true, empresa: novaEmpresa, totalFuncionarios: funcionarios.length })
  } catch (error) {
    console.error("Erro ao cadastrar empresa (admin):", error)
    if (isMissingEmpresaCommercialTerms(error)) {
      return NextResponse.json(
        { error: "Banco desatualizado. Execute scripts/023_add_empresa_commercial_terms.sql." },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Erro ao cadastrar empresa." }, { status: 500 })
  }
}
