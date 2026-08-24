"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, Building2, Check, DollarSign,
  FileSpreadsheet, Loader2, Users, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { parseFuncionariosExcel, FUNCIONARIOS_EXCEL_HEADERS } from "@/lib/funcionarios-excel"
import type { DependenteFormData } from "@/lib/types"
import { downloadXlsx, readSpreadsheetMatrix } from "@/lib/spreadsheet"

type Step = "empresa" | "comercial" | "funcionarios" | "revisao"

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: "empresa",       label: "Dados da Empresa",    icon: Building2 },
  { id: "comercial",    label: "Condições Comerciais", icon: DollarSign },
  { id: "funcionarios", label: "Funcionários",          icon: Users },
  { id: "revisao",      label: "Revisão",              icon: Check },
]

type EmpresaForm = {
  razao_social: string; nome_fantasia: string; cnpj: string; email: string
  telefone: string; responsavel_nome: string; endereco: string; numero: string
  complemento: string; bairro: string; cidade: string; estado: string; cep: string
}
type ComercialForm = { cobrar_adesao: boolean; valor_adesao: string; valor_mensal: string }

const EMPTY_EMPRESA: EmpresaForm = {
  razao_social: "", nome_fantasia: "", cnpj: "", email: "", telefone: "",
  responsavel_nome: "", endereco: "", numero: "", complemento: "",
  bairro: "", cidade: "", estado: "", cep: "",
}

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return d.slice(0,2)+"."+d.slice(2)
  if (d.length <= 8) return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5)
  if (d.length <= 12) return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5,8)+"/"+d.slice(8)
  return d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5,8)+"/"+d.slice(8,12)+"-"+d.slice(12)
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0,8)
  return d.length <= 5 ? d : d.slice(0,5)+"-"+d.slice(5)
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0,11)
  if (d.length <= 2) return d
  if (d.length <= 7) return "("+d.slice(0,2)+") "+d.slice(2)
  return "("+d.slice(0,2)+") "+d.slice(2,7)+"-"+d.slice(7)
}
function currencyFmt(v: string) {
  const digits = v.replace(/\D/g, "")
  if (!digits) return ""
  return (parseInt(digits,10)/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})
}
function parseCurrency(v: string) {
  return parseFloat(v.replace(/\./g,"").replace(",",".")) || 0
}
async function genModeloExcel() {
  await downloadXlsx("modelo-funcionarios.xlsx", [{
    name: "Funcionários",
    rows: [
      Array.from(FUNCIONARIOS_EXCEL_HEADERS),
      ["Maria Silva","1234567","123.456.789-09","01/01/1990","maria@email.com","(85) 99999-1234","Feminino"],
      ["João Santos","7654321","987.654.321-00","15/06/1985","joao@email.com","(85) 98888-5678","Masculino"],
    ],
    columnWidths: [32, 18, 16, 22, 32, 22, 16],
  }])
}

function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"

function StepIndicator({current}:{current:Step}) {
  const idx = STEPS.findIndex((s)=>s.id===current)
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step,i)=>{
        const done=i<idx; const active=i===idx; const Icon=step.icon
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={"flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all "+(done?"border-teal-600 bg-teal-600 text-white":active?"border-teal-600 bg-white text-teal-700":"border-gray-300 bg-white text-gray-400")}>
                {done?<Check className="h-5 w-5"/>:<Icon className="h-4 w-4"/>}
              </div>
              <span className={"hidden text-xs font-medium sm:block "+(active?"text-teal-700":done?"text-teal-600":"text-gray-400")}>{step.label}</span>
            </div>
            {i<STEPS.length-1&&<div className={"mx-2 h-0.5 w-12 sm:w-20 "+(i<idx?"bg-teal-600":"bg-gray-200")}/>}
          </div>
        )
      })}
    </div>
  )
}
﻿export default function AdminNovaEmpresaPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("empresa")
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string|null>(null)
  const [success, setSuccess] = useState(false)
  const [empresa, setEmpresa] = useState<EmpresaForm>(EMPTY_EMPRESA)
  const [comercial, setComercial] = useState<ComercialForm>({cobrar_adesao:false,valor_adesao:"",valor_mensal:""})
  const [funcionarios, setFuncionarios] = useState<DependenteFormData[]>([])
  const [funcErrors, setFuncErrors] = useState<{linha:number;mensagens:string[]}[]>([])
  const [funcGenericErrors, setFuncGenericErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState<string|null>(null)

  const setE = (field: keyof EmpresaForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
    let v = e.target.value
    if (field==="cnpj") v=maskCnpj(v)
    if (field==="cep") v=maskCep(v)
    if (field==="telefone") v=maskPhone(v)
    setEmpresa((prev)=>({...prev,[field]:v}))
  }

  const setC = (field: keyof ComercialForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (field==="cobrar_adesao") {
      setComercial((prev)=>({...prev,cobrar_adesao:e.target.checked}))
    } else {
      const digits = e.target.value.replace(/\D/g,"")
      setComercial((prev)=>({...prev,[field]:digits?currencyFmt(digits):""}))
    }
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setFuncErrors([]); setFuncGenericErrors([]); setFuncionarios([])
    try {
      const matrix = await readSpreadsheetMatrix(file)
      const result = parseFuncionariosExcel(matrix, {})
      setFuncionarios(result.funcionarios)
      setFuncErrors(result.erros)
      setFuncGenericErrors(result.errosGerais)
    } catch {
      setFuncGenericErrors(["Erro ao ler o arquivo. Verifique se é um arquivo XLSX ou CSV válido."])
    }
    if (fileRef.current) fileRef.current.value=""
  }, [])

  const validateEmpresa = () => {
    if (!empresa.razao_social.trim()) return "Razão social obrigatória."
    if (!empresa.cnpj.trim()||empresa.cnpj.replace(/\D/g,"").length!==14) return "CNPJ inválido (14 dígitos)."
    if (!empresa.email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empresa.email)) return "Email inválido."
    if (!empresa.telefone.trim()) return "Telefone obrigatório."
    if (!empresa.responsavel_nome.trim()) return "Nome do responsável obrigatório."
    return null
  }
  const validateComercial = () => {
    if (!parseCurrency(comercial.valor_mensal)) return "Informe o valor mensal acordado."
    if (comercial.cobrar_adesao && !parseCurrency(comercial.valor_adesao)) return "Informe o valor da adesão."
    return null
  }
  const validateFuncionarios = () => {
    if (funcGenericErrors.length>0) return funcGenericErrors[0]
    if (funcionarios.length===0) return "Importe a planilha de funcionários."
    if (funcErrors.length>0) return "Corrija os erros na planilha antes de continuar."
    return null
  }

  const advance = () => {
    setGlobalError(null)
    if (step==="empresa") { const e=validateEmpresa(); if(e){setGlobalError(e);return} setStep("comercial") }
    else if (step==="comercial") { const e=validateComercial(); if(e){setGlobalError(e);return} setStep("funcionarios") }
    else if (step==="funcionarios") { const e=validateFuncionarios(); if(e){setGlobalError(e);return} setStep("revisao") }
  }
  const back = () => {
    setGlobalError(null)
    if (step==="comercial") setStep("empresa")
    if (step==="funcionarios") setStep("comercial")
    if (step==="revisao") setStep("funcionarios")
  }

  const handleSubmit = async () => {
    setGlobalError(null); setSubmitting(true)
    try {
      const res = await fetch("/api/admin/empresas",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          ...empresa,
          cnpj:empresa.cnpj.replace(/\D/g,""),
          cep:empresa.cep.replace(/\D/g,""),
          cobrar_adesao:comercial.cobrar_adesao,
          valor_adesao:parseCurrency(comercial.valor_adesao),
          valor_mensal:parseCurrency(comercial.valor_mensal),
          tipo_plano:"EMPRESARIAL",
          funcionarios,
        }),
      })
      const data = await res.json()
      if (!res.ok) { if(res.status===401){router.push("/admin/login");return} setGlobalError(data.error||"Erro ao cadastrar empresa."); return }
      setSuccess(true)
    } catch { setGlobalError("Erro de conexão. Tente novamente.") }
    finally { setSubmitting(false) }
  }

  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-8 w-8 text-emerald-600"/>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Empresa cadastrada!</h1>
          <p className="mt-2 text-gray-600"><strong>{empresa.razao_social}</strong> foi cadastrada com <strong>{funcionarios.length}</strong> funcionário(s) e status <strong>Ativo</strong>.</p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/admin/empresas"><Button className="w-full bg-teal-700 hover:bg-teal-800">Ver lista de empresas</Button></Link>
            <Button variant="outline" className="w-full" onClick={()=>{setSuccess(false);setStep("empresa");setEmpresa(EMPTY_EMPRESA);setComercial({cobrar_adesao:false,valor_adesao:"",valor_mensal:""});setFuncionarios([]);setFuncErrors([]);setFuncGenericErrors([]);setFileName(null)}}>
              Cadastrar outra empresa
            </Button>
          </div>
        </div>
      </main>
    )
  }

  const UF_LIST = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ")

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/admin/empresas" className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4"/> Empresas
          </Link>
          <h1 className="font-bold text-gray-900">Nova Empresa</h1>
          <div className="w-24"/>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <StepIndicator current={step}/>

        {step==="empresa" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-xl font-bold text-gray-900">Dados da Empresa</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Razão Social" required><input className={inputCls} value={empresa.razao_social} onChange={setE("razao_social")} placeholder="Razão Social Ltda"/></Field></div>
              <Field label="Nome Fantasia"><input className={inputCls} value={empresa.nome_fantasia} onChange={setE("nome_fantasia")} placeholder="Nome Fantasia (opcional)"/></Field>
              <Field label="CNPJ" required><input className={inputCls} value={empresa.cnpj} onChange={setE("cnpj")} placeholder="00.000.000/0000-00" inputMode="numeric"/></Field>
              <Field label="Email" required><input className={inputCls} type="email" value={empresa.email} onChange={setE("email")} placeholder="contato@empresa.com"/></Field>
              <Field label="Telefone" required><input className={inputCls} value={empresa.telefone} onChange={setE("telefone")} placeholder="(85) 99999-0000" inputMode="tel"/></Field>
              <div className="sm:col-span-2"><Field label="Nome do Responsável" required><input className={inputCls} value={empresa.responsavel_nome} onChange={setE("responsavel_nome")} placeholder="Nome completo do responsável"/></Field></div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 sm:col-span-2">Endereço (opcional)</p>
              <div className="sm:col-span-2"><Field label="Logradouro"><input className={inputCls} value={empresa.endereco} onChange={setE("endereco")} placeholder="Rua, Av., etc."/></Field></div>
              <Field label="Número"><input className={inputCls} value={empresa.numero} onChange={setE("numero")} placeholder="123"/></Field>
              <Field label="Complemento"><input className={inputCls} value={empresa.complemento} onChange={setE("complemento")} placeholder="Sala, Andar..."/></Field>
              <Field label="Bairro"><input className={inputCls} value={empresa.bairro} onChange={setE("bairro")} placeholder="Bairro"/></Field>
              <Field label="Cidade"><input className={inputCls} value={empresa.cidade} onChange={setE("cidade")} placeholder="Cidade"/></Field>
              <Field label="Estado (UF)"><select className={inputCls} value={empresa.estado} onChange={setE("estado")}><option value="">Selecione</option>{UF_LIST.map((uf)=><option key={uf} value={uf}>{uf}</option>)}</select></Field>
              <Field label="CEP"><input className={inputCls} value={empresa.cep} onChange={setE("cep")} placeholder="00000-000" inputMode="numeric"/></Field>
            </div>
          </div>
        )}

        {step==="comercial" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-xl font-bold text-gray-900">Condições Comerciais</h2>
            <div className="space-y-6">
              <div className="rounded-xl border border-teal-100 bg-teal-50 p-5">
                <Field label="Valor mensal acordado (R$)" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">R$</span>
                    <input className={inputCls+" pl-10"} value={comercial.valor_mensal} onChange={setC("valor_mensal")} placeholder="0,00" inputMode="numeric"/>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">Valor total mensal acordado com a empresa.</p>
                </Field>
              </div>
              <div className="rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div><p className="font-semibold text-gray-900">Cobrar taxa de adesão?</p><p className="mt-0.5 text-sm text-gray-500">Taxa única de entrada no convênio</p></div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" checked={comercial.cobrar_adesao} onChange={setC("cobrar_adesao")}/>
                    <div className="peer h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all after:content-[''] peer-checked:bg-teal-600 peer-checked:after:translate-x-full"/>
                  </label>
                </div>
                {comercial.cobrar_adesao && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <Field label="Valor da adesão (R$)" required>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">R$</span>
                        <input className={inputCls+" pl-10"} value={comercial.valor_adesao} onChange={setC("valor_adesao")} placeholder="0,00" inputMode="numeric"/>
                      </div>
                    </Field>
                  </div>
                )}
                {!comercial.cobrar_adesao && <p className="mt-3 text-sm font-medium text-emerald-700">✓ Sem cobrança de adesão</p>}
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                <p className="font-semibold text-gray-900 mb-2">Resumo financeiro</p>
                <div className="flex justify-between"><span className="text-gray-600">Mensalidade</span><span className="font-semibold text-teal-700">{comercial.valor_mensal?"R$ "+comercial.valor_mensal:"—"}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-600">Adesão</span><span className={"font-semibold "+(comercial.cobrar_adesao?"text-amber-700":"text-emerald-700")}>{comercial.cobrar_adesao?(comercial.valor_adesao?"R$ "+comercial.valor_adesao:"—"):"Isenta"}</span></div>
              </div>
            </div>
          </div>
        )}

        {step==="funcionarios" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h2 className="text-xl font-bold text-gray-900">Importar Funcionários</h2><p className="mt-1 text-sm text-gray-500">Faça upload de uma planilha Excel (.xlsx, .xls) ou CSV</p></div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void genModeloExcel().catch(() =>
                    setGlobalError("Não foi possível gerar o modelo de funcionários.")
                  )
                }}
                className="gap-2 shrink-0"
              >
                <FileSpreadsheet className="h-4 w-4"/>Baixar modelo
              </Button>
            </div>
            <div className="mb-5 rounded-lg bg-sky-50 border border-sky-100 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-700">Colunas esperadas</p>
              <div className="flex flex-wrap gap-2">{FUNCIONARIOS_EXCEL_HEADERS.map((h)=><span key={h} className="rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">{h}</span>)}</div>
            </div>
            <label htmlFor="excel-upload" className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center transition-all hover:border-teal-500 hover:bg-teal-50">
              <FileSpreadsheet className="mb-3 h-10 w-10 text-gray-400 group-hover:text-teal-500"/>
              <p className="font-semibold text-gray-700">Clique para selecionar o arquivo</p>
              <p className="mt-1 text-sm text-gray-500">.xlsx, .xls ou .csv — até 1.000 funcionários</p>
              {fileName && <p className="mt-3 rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700">{fileName}</p>}
              <input id="excel-upload" ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="sr-only"/>
            </label>
            {funcGenericErrors.length>0 && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">{funcGenericErrors.map((e,i)=><p key={i} className="text-sm text-red-700">{e}</p>)}</div>}
            {funcErrors.length>0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 font-semibold text-amber-800">{funcErrors.length} linha(s) com erro — serão ignoradas:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">{funcErrors.map((e)=><p key={e.linha} className="text-sm text-amber-700"><span className="font-medium">Linha {e.linha}:</span> {e.mensagens.join(", ")}</p>)}</div>
              </div>
            )}
            {funcionarios.length>0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold text-gray-900"><span className="text-emerald-700">{funcionarios.length}</span> funcionário(s) válido(s)</p>
                  {funcErrors.length>0 && <span className="text-sm text-amber-700">{funcErrors.length} ignorado(s)</span>}
                </div>
                <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
                      <tr>
                        {["#","Nome","Email","CPF","Telefone","Sexo"].map((h)=><th key={h} className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {funcionarios.map((f,i)=>(
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400">{i+1}</td>
                          <td className="px-4 py-2 font-medium text-gray-900">{f.nome}</td>
                          <td className="px-4 py-2 text-gray-600">{f.email}</td>
                          <td className="px-4 py-2 font-mono text-gray-600">{f.cpf||"—"}</td>
                          <td className="px-4 py-2 text-gray-600">{f.telefone_celular}</td>
                          <td className="px-4 py-2 text-gray-600">{f.sexo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {step==="revisao" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900"><Building2 className="h-5 w-5 text-teal-600"/>Dados da Empresa</h3>
              <div className="grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-3">
                <div><p className="text-gray-500">Razão Social</p><p className="font-medium">{empresa.razao_social}</p></div>
                {empresa.nome_fantasia&&<div><p className="text-gray-500">Nome Fantasia</p><p className="font-medium">{empresa.nome_fantasia}</p></div>}
                <div><p className="text-gray-500">CNPJ</p><p className="font-medium font-mono">{empresa.cnpj}</p></div>
                <div><p className="text-gray-500">Email</p><p className="font-medium">{empresa.email}</p></div>
                <div><p className="text-gray-500">Telefone</p><p className="font-medium">{empresa.telefone}</p></div>
                <div><p className="text-gray-500">Responsável</p><p className="font-medium">{empresa.responsavel_nome}</p></div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900"><DollarSign className="h-5 w-5 text-teal-600"/>Condições Comerciais</h3>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div><p className="text-gray-500">Mensalidade</p><p className="text-2xl font-bold text-teal-700">R$ {comercial.valor_mensal}</p></div>
                <div><p className="text-gray-500">Adesão</p><p className={"text-2xl font-bold "+(comercial.cobrar_adesao?"text-amber-700":"text-emerald-700")}>{comercial.cobrar_adesao?"R$ "+comercial.valor_adesao:"Isenta"}</p></div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900"><Users className="h-5 w-5 text-teal-600"/>Funcionários</h3>
              <div className="flex items-center gap-6 text-sm">
                <div><p className="text-gray-500">Total</p><p className="text-3xl font-bold text-gray-900">{funcionarios.length}</p></div>
                {funcErrors.length>0&&<div><p className="text-gray-500">Ignorados</p><p className="text-2xl font-bold text-amber-600">{funcErrors.length}</p></div>}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">A empresa será criada com status <strong>ATIVO</strong>.</p>
              <p className="mt-0.5 text-emerald-700">Os funcionários serão inseridos diretamente sem nenhuma etapa adicional.</p>
            </div>
          </div>
        )}

        {globalError && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <X className="mt-0.5 h-5 w-5 shrink-0 text-red-600"/>
            <p className="text-sm font-medium text-red-700">{globalError}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" onClick={step==="empresa"?()=>router.push("/admin/empresas"):back} disabled={submitting} className="gap-2">
            <ArrowLeft className="h-4 w-4"/>{step==="empresa"?"Cancelar":"Voltar"}
          </Button>
          {step!=="revisao"?(
            <Button onClick={advance} className="gap-2 bg-teal-700 hover:bg-teal-800">
              Próximo <ArrowRight className="h-4 w-4"/>
            </Button>
          ):(
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
              {submitting?<><Loader2 className="h-4 w-4 animate-spin"/>Cadastrando...</>:<><Check className="h-4 w-4"/>Cadastrar Empresa</>}
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
