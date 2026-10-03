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
    sql((migration.parent/"20261003174425_customer_password_onboarding.sql").read_text())
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
    # Password onboarding keeps real initial passwords indefinitely until first use.
    import uuid
    d='1'*64;e='2'*64;c='3'*64;bad='4'*64
    ch=str(uuid.uuid4());setup=str(uuid.uuid4())
    assert sql(f"select customer_password_reserve('{ch}','titular','{holder}','{holder}','{d}','{e}','{bad}','{c}');")=='t'
    sql(f"update customer_login_challenges set delivered=true,created_at=now()-interval '45 days' where id='{ch}';")
    assert sql(f"select expires_at='infinity'::timestamptz from customer_login_challenges where id='{ch}';")=='t'
    consume=f"select customer_login_consume('{ch}','{c}','{d}','{e}','titular','{holder}','{holder}','password-setup','{setup}') is not null;"
    # Incorrect guesses are rate-limited, not a permanent expiry of the unused initial password.
    for _ in range(6): assert sql(consume.replace(c,bad))=='f'
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: replies=list(pool.map(lambda _:sql(consume),range(12)))
    assert replies.count('t')==1,replies
    assert sql(f"select purpose='password-setup' and challenge_id='{ch}' and expires_at-verified_at between interval '19 minutes 59 seconds' and interval '20 minutes 1 second' from customer_login_sessions where id='{setup}';")=='t'
    assert sql(f"select customer_login_validate_session('{setup}','titular','{holder}','{holder}','cliente','52998224725','holder@example.test','{d}','{e}') is null;")=='t'
    encoding='nas-scrypt-v1$'+'a'*32+'$'+'b'*64
    def setter(setup_id,challenge,hash_value,session_id,new_initial_hash=bad):
        return f"select customer_password_set('{setup_id}','titular','{holder}','{holder}','52998224725','holder@example.test','{d}','{e}','{hash_value}','{challenge}','{new_initial_hash}','cliente','{session_id}') is not null;"
    assert sql(setter(setup,ch,encoding,str(uuid.uuid4()),c))=='f' # Cannot keep initial password.
    assert sql(setter(setup,str(uuid.uuid4()),encoding,str(uuid.uuid4())))=='f' # Bound challenge.
    sql(f"update customer_login_sessions set expires_at=now()-interval '1 second' where id='{setup}';")
    assert sql(setter(setup,ch,encoding,str(uuid.uuid4())))=='f'
    sql(f"update customer_login_sessions set expires_at=now()+interval '20 minutes' where id='{setup}';")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda _:sql(setter(setup,ch,encoding,str(uuid.uuid4()))),range(12)))
    assert results.count('t')==1,results
    assert sql(f"select count(*) from customer_password_credentials where identity_kind='titular' and identity_id='{holder}' and password_hash='{encoding}';")=='1'
    assert sql(f"select count(*) from customer_login_sessions where identity_kind='titular' and identity_id='{holder}' and revoked_at is null;")=='1'
    assert sql("select has_table_privilege('anon','customer_password_credentials','select') or has_table_privilege('authenticated','customer_password_credentials','insert');")=='f'
    assert sql("select relrowsecurity from pg_class where relname='customer_password_credentials';")=='t'
    for signature in ['customer_password_attempt(text,text)','customer_password_reserve(uuid,text,uuid,uuid,text,text,text,text)',
      'customer_password_create_session(text,uuid,uuid,text,text,text,text,text,text,uuid)',
      'customer_password_set(uuid,text,uuid,uuid,text,text,text,text,text,uuid,text,text,uuid)']:
        assert sql(f"select has_function_privilege('anon','{signature}','execute') or has_function_privilege('authenticated','{signature}','execute');")=='f'
    # Personal login must compare the exact current hash under the same identity lock.
    def login(hash_value):
        return f"select customer_password_create_session('titular','{holder}','{holder}','52998224725','holder@example.test','{d}','{e}','{hash_value}','cliente','{uuid.uuid4()}') is not null;"
    assert sql(login(encoding))=='t'
    assert sql(login(encoding.replace('b','c')))=='f'
    # A recovery request supersedes the old initial credential and revokes setup sessions.
    sql(f"update customer_login_limits set last_request_at=now()-interval '61 seconds' where bucket_key='send-document:{d}';")
    ch2=str(uuid.uuid4());setup2=str(uuid.uuid4())
    assert sql(f"select customer_password_reserve('{ch2}','titular','{holder}','{holder}','{d}','{e}','{bad}','{c}');")=='t'
    sql(f"update customer_login_challenges set delivered=true where id='{ch2}';")
    assert sql(f"select customer_login_consume('{ch2}','{c}','{d}','{e}','titular','{holder}','{holder}','password-setup','{setup2}') is not null;")=='t'
    encoding2=encoding.replace('b','d')
    assert sql(setter(setup2,ch2,encoding2,str(uuid.uuid4())))=='t'
    assert sql(login(encoding))=='f';assert sql(login(encoding2))=='t'
    assert sql(f"select count(*) from customer_login_sessions where identity_kind='titular' and identity_id='{holder}' and revoked_at is null;")=='2'
    # Unknown-user decoys must remain finite to avoid retaining attacker-generated rows indefinitely.
    unknown=str(uuid.uuid4())
    assert sql(f"select customer_password_reserve('{unknown}','titular',null,null,'{'5'*64}','{'6'*64}','{'7'*64}','{c}');")=='t'
    assert sql(f"select expires_at<>'infinity'::timestamptz from customer_login_challenges where id='{unknown}';")=='t'
    # Durable login attempts serialize across connections.
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        attempts=list(pool.map(lambda _:sql(f"select customer_password_attempt('{'8'*64}','{'9'*64}');"),range(30)))
    assert attempts.count('t')==15,attempts
    print('PASS: PostgreSQL private auth, legacy OTP regression, indefinite initial password (>45 days), single-use concurrency, mandatory setup scope/expiry, different password, private hashes, serialized setup/reset, revocation and stale-hash denial, durable limits, finite unknown-user decoys')
finally:
    if started: run([pg+'pg_ctl','-D',str(base/'data'),'-m','fast','-w','stop'])
    shutil.rmtree(base)
