import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'

const mocks=vi.hoisted(()=>({auth:vi.fn(),client:vi.fn(),createPayment:vi.fn()}))
vi.mock('../lib/supabase/admin-auth',()=>({requireAdminAuth:mocks.auth}))
vi.mock('../lib/supabase/admin',()=>({createAdminClient:mocks.client}))
vi.mock('../lib/asaas',()=>({AsaasIntegrationError:class extends Error{},createAsaasCustomer:vi.fn().mockResolvedValue({id:'cus-test'}),createAsaasPayment:mocks.createPayment,cancelAsaasPayment:vi.fn(),deleteAsaasCustomer:vi.fn()}))
import {POST} from '../app/api/admin/empresas/route'

const payload=()=>({razao_social:'Empresa Teste',cnpj:'11222333000181',email:'empresa@example.com',telefone:'85999999999',responsavel_nome:'Responsável Teste',valor_mensal:100,primeira_parcela_vencimento:'2026-10-15',parcelas_mesmo_dia:true,contrato_meses:12,funcionarios:[{nome:'Pessoa 1',cpf:'52998224725',email:'contato@example.com',telefone_celular:'85999999999'},{nome:'Pessoa 2',cpf:'11144477735',email:'contato@example.com',telefone_celular:'85999999999'}]})
function database({duplicate=false,staffError=null}:{duplicate?:boolean;staffError?:unknown}={}){
  const inserts:Array<{table:string;data:unknown}>=[];const deletes:string[]=[]
  return {inserts,deletes,from:(table:string)=>({
    select:()=>({eq:()=>({limit:async()=>({data:duplicate?[{id:'existente'}]:[],error:null})})}),
    insert:(data:unknown)=>{inserts.push({table,data});return table==='empresas'?{select:()=>({single:async()=>({data:{id:'empresa-teste',status:'PENDENTE_PAGAMENTO'},error:null})})}:Promise.resolve({error:staffError})},
    update:()=>({eq:async()=>({error:null})}),
    delete:()=>{deletes.push(table);const query={eq:()=>query,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)};return query},
  })}
}
const request=(body:unknown)=>new NextRequest('http://localhost/api/admin/empresas',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));mocks.auth.mockResolvedValue({ok:true});mocks.createPayment.mockResolvedValue({id:'pay-test',invoiceUrl:'https://example.com/invoice'})})
afterEach(()=>vi.useRealTimers())
describe('API administrativa de importação com dependências simuladas',()=>{
  it('aceita contato compartilhado e salva todos os colaboradores no payload',async()=>{
    const db=database();mocks.client.mockReturnValue(db)
    const response=await POST(request(payload()))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({success:true,totalFuncionarios:2,empresa:{status:'PENDENTE_PAGAMENTO'}})
    expect(mocks.createPayment).toHaveBeenCalledWith(expect.objectContaining({value:100,dueDate:'2026-10-15'}))
    const staff=db.inserts.find(i=>i.table==='empresa_funcionarios')!.data as Array<Record<string,unknown>>
    expect(staff.map(f=>f.email)).toEqual(['contato@example.com','contato@example.com'])
    expect(staff.map(f=>f.cpf)).toEqual(['52998224725','11144477735'])
    expect(staff.every(f=>f.empresa_id==='empresa-teste')).toBe(true)
  })
  it('rejeita acesso não autenticado sem abrir conexão de banco',async()=>{
    mocks.auth.mockResolvedValue({ok:false,status:401,error:'Não autorizado'})
    expect((await POST(request(payload()))).status).toBe(401)
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('rejeita e-mail ausente antes de gravar',async()=>{
    const body=payload();body.funcionarios[0].email=''
    expect((await POST(request(body))).status).toBe(400)
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('não cria empresa duplicada',async()=>{
    const db=database({duplicate:true});mocks.client.mockReturnValue(db)
    expect((await POST(request(payload()))).status).toBe(409)
    expect(db.inserts).toEqual([])
  })
  it('remove a empresa recém-criada se a inserção de colaboradores falhar',async()=>{
    const db=database({staffError:{code:'23505',message:'duplicate CPF'}});mocks.client.mockReturnValue(db)
    const log=vi.spyOn(console,'error').mockImplementation(()=>{})
    try{expect((await POST(request(payload()))).status).toBe(500);expect(db.deletes).toEqual(['empresas'])}finally{log.mockRestore()}
  })
})
