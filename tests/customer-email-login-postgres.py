import concurrent.futures, json, pathlib, subprocess, tempfile, shutil, sys
base = pathlib.Path(tempfile.mkdtemp(prefix='nova-email-login-fixture-'))
pg = '/usr/lib/postgresql/14/bin/'
def run(args, text=None):
    result = subprocess.run(args, input=text, text=True, capture_output=True)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout.strip()
psql = ['psql', '-h', str(base), '-p', '55448', '-U', 'caioferreira', '-d', 'postgres', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
def sql(s): return run(psql, s)
started=False
try:
    run([pg+'initdb', '-D',str(base/'data'),'-A','trust','--locale=C','--encoding=UTF8'])
    run([pg+'pg_ctl','-D',str(base/'data'),'-l',str(base/'runtime.log'),'-o',f'-h "" -k {base} -p 55448','-w','start']); started=True
    sql('''create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create table empresas(id uuid primary key, cnpj text, email text, razao_social text, nome_fantasia text, status text);
    create table cadastros(id uuid primary key, cpf text, nome text, email text, status text, empresa_id uuid);
    create table dependentes(id uuid primary key, cadastro_id uuid references cadastros(id), cpf text, nome text, email text);
    create table empresa_funcionarios(id uuid primary key, cpf text, email text);
    grant all on all tables in schema public to service_role;''')
    migration = pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1]/'supabase/migrations/20261003151322_customer_email_login.sql'
    sql(migration.read_text())
    holder='00000000-0000-4000-8000-000000000001'; child='00000000-0000-4000-8000-000000000002'
    sql(f"insert into cadastros values('{holder}','529.982.247-25','Titular fictício','holder@example.test','ATIVO',null); insert into dependentes values('{child}','{holder}','11144477735','Dependente fictício','holder@example.test');")
    assert json.loads(sql("select customer_login_identity('cliente','52998224725','holder@example.test');"))['tipo']=='titular'
    assert json.loads(sql("select customer_login_identity('cliente','11144477735',null);"))['email']=='holder@example.test'
    sql(f"update dependentes set email=null where id='{child}';")
    assert json.loads(sql("select customer_login_identity('cliente','11144477735',null);"))['email']=='holder@example.test'
    sql(f"update dependentes set email='child@example.test' where id='{child}';")
    assert json.loads(sql("select customer_login_identity('cliente','11144477735','CHILD@example.test');"))['tipo']=='dependente'
    assert sql("select customer_login_identity('cliente','52998224725','wrong@example.test') is null;")=='t'
    assert sql("select has_table_privilege('anon','customer_login_challenges','select') or has_table_privilege('authenticated','customer_login_sessions','insert');")=='f'
    assert sql("select has_function_privilege('anon','customer_login_identity(text,text,text)','execute') or has_function_privilege('authenticated','customer_login_consume(uuid,text,text,text,text,uuid,uuid,text,uuid)','execute');")=='f'
    assert sql("select count(*) from pg_class where relname in ('customer_login_challenges','customer_login_sessions','customer_login_limits') and relrowsecurity;")=='3'
    # Unknown documents do not consume the actual delivery quota.
    for i in range(505):
        sql(f"select customer_login_reserve('{str(__import__('uuid').uuid4())}','titular',null,null,'{i:064x}','{i+1000:064x}','{'f'*64}','{'e'*64}');")
    assert sql("select count(*) from customer_login_limits where bucket_key='send-global';")=='0'
    # Multiple PostgreSQL connections, not a serialized in-memory driver.
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        attempts=list(pool.map(lambda _: sql("select customer_login_take_limit('race',5,3600,0);"), range(30)))
    assert attempts.count('t')==5, attempts
    challenge='00000000-0000-4000-8000-000000000003'; session='00000000-0000-4000-8000-000000000004'
    d='a'*64; e='b'*64; c='c'*64; bad='d'*64
    sql(f"select customer_login_reserve('{challenge}','titular','{holder}','{holder}','{d}','{e}','{bad}','{c}'); update customer_login_challenges set delivered=true where id='{challenge}';")
    consume=f"select customer_login_consume('{challenge}','{c}','{d}','{e}','titular','{holder}','{holder}','cliente','{session}') is not null;"
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: replies=list(pool.map(lambda _:sql(consume),range(12)))
    assert replies.count('t')==1, replies
    assert sql(f"select count(*) from customer_login_sessions where expires_at-verified_at between interval '23 hours 59 minutes' and interval '24 hours 1 minute';")=='1'
    validation=f"select customer_login_validate_session('{session}','titular','{holder}','{holder}','cliente','52998224725','holder@example.test','{d}','{e}') is not null;"
    assert sql(validation)=='t'
    sql(f"update cadastros set email='changed@example.test' where id='{holder}';")
    assert sql(validation)=='f'
    sql(f"update cadastros set email='holder@example.test' where id='{holder}'; update customer_login_sessions set revoked_at=now() where id='{session}';")
    assert sql(validation)=='f'
    # Wrong codes exhaust attempts, expiration/delivery gates remain closed.
    ch2='00000000-0000-4000-8000-000000000005'
    sql(f"insert into customer_login_challenges(id,identity_kind,identity_id,cadastro_id,document_key,email_key,code_hash,delivered) values('{ch2}','titular','{holder}','{holder}','{d}','{e}','{c}',true);")
    wrong=f"select customer_login_consume('{ch2}','{bad}','{d}','{e}','titular','{holder}','{holder}','cliente','{session}') is null;"
    for _ in range(5): assert sql(wrong)=='t'
    assert sql(consume.replace(challenge,ch2))=='f'
    assert sql(f"select attempts from customer_login_challenges where id='{ch2}';")=='5'
    # A formatting alias cannot shadow a titular in the dependents table.
    try: sql("insert into dependentes values('00000000-0000-4000-8000-000000000006','"+holder+"','52998224725','Alias','alias@example.test');")
    except RuntimeError as error: assert 'Documento já cadastrado' in str(error)
    else: raise AssertionError('CPF alias inserted')
    print('PASS: SQL migration, private privileges/RLS, stored contact ownership, guardian/dependent/shared contact, PostgreSQL concurrent limits and single-use consumption, session expiry/revocation/email change, five attempts, CPF alias guard')
finally:
    if started: run([pg+'pg_ctl','-D',str(base/'data'),'-m','fast','-w','stop'])
    shutil.rmtree(base)
