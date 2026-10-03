begin;

-- Contact data remains unchanged. These indexes also find document formatting aliases.
create index if not exists cadastros_login_document_idx on public.cadastros ((regexp_replace(cpf, '\D', '', 'g')));
create index if not exists dependentes_login_document_idx on public.dependentes ((regexp_replace(cpf, '\D', '', 'g')));
create index if not exists cadastros_login_email_idx on public.cadastros ((lower(btrim(email))));
create index if not exists dependentes_login_email_idx on public.dependentes ((lower(btrim(email))));
create index if not exists empresas_login_email_idx on public.empresas ((lower(btrim(email))));
create index if not exists empresas_login_document_idx on public.empresas ((regexp_replace(cnpj, '\D', '', 'g')));
create index if not exists empresa_funcionarios_login_email_idx on public.empresa_funcionarios ((lower(btrim(email))));

create table public.customer_login_challenges (
  id uuid primary key,
  identity_kind text not null check (identity_kind in ('titular', 'dependente', 'empresa')),
  identity_id uuid,
  cadastro_id uuid references public.cadastros(id) on delete cascade,
  document_key text not null check (document_key ~ '^[0-9a-f]{64}$'),
  email_key text not null check (email_key ~ '^[0-9a-f]{64}$'),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '10 minutes'),
  delivered boolean not null default false,
  attempts integer not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz
);
create index customer_login_challenges_expiry_idx on public.customer_login_challenges(expires_at);
create index customer_login_challenges_contact_idx on public.customer_login_challenges(document_key, email_key) where consumed_at is null;

create table public.customer_login_limits (
  bucket_key text primary key,
  window_start timestamptz not null,
  last_request_at timestamptz not null,
  requests integer not null check (requests > 0)
);
create index customer_login_limits_expiry_idx on public.customer_login_limits(last_request_at);

create table public.customer_login_sessions (
  id uuid primary key,
  identity_kind text not null check (identity_kind in ('titular', 'dependente', 'empresa')),
  identity_id uuid not null,
  cadastro_id uuid references public.cadastros(id) on delete cascade,
  document_key text not null check (document_key ~ '^[0-9a-f]{64}$'),
  email_key text not null check (email_key ~ '^[0-9a-f]{64}$'),
  purpose text not null check (purpose in ('cliente', 'cadastro-flow', 'empresa-app', 'empresa-flow')),
  verified_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '24 hours'),
  revoked_at timestamptz,
  check ((identity_kind = 'empresa' and cadastro_id is null and purpose in ('empresa-app', 'empresa-flow'))
    or (identity_kind = 'titular' and cadastro_id is not null and cadastro_id = identity_id and purpose in ('cliente', 'cadastro-flow'))
    or (identity_kind = 'dependente' and cadastro_id is not null and purpose = 'cliente'))
);
create index customer_login_sessions_expiry_idx on public.customer_login_sessions(expires_at);

alter table public.customer_login_challenges enable row level security;
alter table public.customer_login_limits enable row level security;
alter table public.customer_login_sessions enable row level security;
revoke all on public.customer_login_challenges, public.customer_login_limits, public.customer_login_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.customer_login_challenges, public.customer_login_limits, public.customer_login_sessions to service_role;

create function public.customer_login_identity(p_kind text, p_document text, p_email text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row record; v_kind text; v_count integer; v_email text;
begin
  if p_kind = 'empresa' then
    select count(*) into v_count from public.empresas where regexp_replace(cnpj, '\D', '', 'g') = p_document;
    if v_count <> 1 then return null; end if;
    select id, cnpj, email, razao_social, nome_fantasia, status into v_row
      from public.empresas where regexp_replace(cnpj, '\D', '', 'g') = p_document;
    v_email := lower(btrim(v_row.email));
    if v_row.status = 'INATIVO' or v_email is null or v_email = ''
      or (p_email is not null and lower(btrim(p_email)) is distinct from v_email)
    then return null; end if;
    return jsonb_build_object('tipo', 'empresa', 'identityId', v_row.id, 'cnpj', p_document,
      'nome', coalesce(v_row.nome_fantasia, v_row.razao_social), 'razaoSocial', v_row.razao_social,
      'email', v_email, 'status', v_row.status);
  end if;
  if p_kind <> 'cliente' then return null; end if;
  select count(*) into v_count from (
    select id from public.cadastros where regexp_replace(cpf, '\D', '', 'g') = p_document
    union all select id from public.dependentes where regexp_replace(cpf, '\D', '', 'g') = p_document
  ) identities;
  if v_count <> 1 then return null; end if;
  select c.id identity_id, c.id cadastro_id, c.nome, c.email, c.status, c.empresa_id, e.status company_status
    into v_row from public.cadastros c left join public.empresas e on e.id = c.empresa_id
    where regexp_replace(c.cpf, '\D', '', 'g') = p_document;
  if found then v_kind := 'titular';
  else
    select d.id identity_id, c.id cadastro_id, d.nome, coalesce(nullif(btrim(d.email), ''), c.email) as email, c.status, c.empresa_id, e.status company_status
      into v_row from public.dependentes d join public.cadastros c on c.id = d.cadastro_id
      left join public.empresas e on e.id = c.empresa_id where regexp_replace(d.cpf, '\D', '', 'g') = p_document;
    if not found then return null; end if;
    v_kind := 'dependente';
  end if;
  v_email := lower(btrim(v_row.email));
  if v_email is null or v_email = '' or (p_email is not null and lower(btrim(p_email)) is distinct from v_email)
    or v_row.company_status = 'INATIVO' or (v_row.empresa_id is not null and v_row.company_status is null)
  then return null; end if;
  -- Shared registered contacts are explicitly allowed. The recipient is never supplied by the caller.
  return jsonb_build_object('tipo', v_kind, 'identityId', v_row.identity_id, 'clienteId', v_row.cadastro_id,
    'nome', v_row.nome, 'email', v_email, 'cpf', p_document, 'status', v_row.status,
    'empresaId', v_row.empresa_id, 'companyStatus', v_row.company_status);
end $$;

create function public.customer_login_take_limit(p_key text, p_limit integer, p_window integer, p_cooldown integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_rows integer;
begin
  if p_limit < 1 or p_window < 1 or p_cooldown < 0 then return false; end if;
  insert into public.customer_login_limits as current (bucket_key, window_start, last_request_at, requests)
    values (p_key, v_now, v_now, 1)
    on conflict (bucket_key) do update set
      window_start = case when current.window_start <= v_now - make_interval(secs => p_window) then v_now else current.window_start end,
      requests = case when current.window_start <= v_now - make_interval(secs => p_window) then 1 else current.requests + 1 end,
      last_request_at = v_now
    where current.window_start <= v_now - make_interval(secs => p_window)
      or (current.requests < p_limit and current.last_request_at <= v_now - make_interval(secs => p_cooldown));
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

create function public.customer_login_reserve(p_id uuid, p_kind text, p_identity_id uuid, p_cadastro_id uuid,
  p_document_key text, p_email_key text, p_ip_key text, p_code_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- Fixed acquisition order. Limits survive parallel requests and serverless instances.
  if not public.customer_login_take_limit('send-document:' || p_document_key, 6, 3600, 60) then return false; end if;
  if not public.customer_login_take_limit('send-email:' || p_email_key, 120, 3600, 0) then return false; end if;
  if p_identity_id is null then
    if not public.customer_login_take_limit('unknown-ip:' || p_ip_key, 600, 3600, 0) then return false; end if;
    if not public.customer_login_take_limit('unknown-global', 1000, 3600, 0) then return false; end if;
  else
    if not public.customer_login_take_limit('send-ip:' || p_ip_key, 600, 3600, 0) then return false; end if;
    if not public.customer_login_take_limit('send-global', 500, 3600, 0) then return false; end if;
  end if;
  update public.customer_login_challenges set consumed_at = clock_timestamp()
    where document_key = p_document_key and email_key = p_email_key and consumed_at is null;
  insert into public.customer_login_challenges(id, identity_kind, identity_id, cadastro_id, document_key, email_key, code_hash)
    values (p_id, p_kind, p_identity_id, p_cadastro_id, p_document_key, p_email_key, p_code_hash);
  -- Bounded cleanup; no personal record is deleted.
  delete from public.customer_login_challenges where id in
    (select id from public.customer_login_challenges where expires_at < clock_timestamp() - interval '1 day' order by expires_at limit 100);
  delete from public.customer_login_sessions where id in
    (select id from public.customer_login_sessions where expires_at < clock_timestamp() - interval '1 day' order by expires_at limit 100);
  delete from public.customer_login_limits where bucket_key in
    (select bucket_key from public.customer_login_limits where last_request_at < clock_timestamp() - interval '2 days' order by last_request_at limit 100);
  return true;
end $$;

create function public.customer_login_validate_session(p_id uuid, p_kind text, p_identity_id uuid, p_cadastro_id uuid,
  p_purpose text, p_document text, p_email text, p_document_key text, p_email_key text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_identity jsonb;
begin
  if not exists (select 1 from public.customer_login_sessions where id = p_id
    and identity_kind = p_kind and identity_id = p_identity_id and cadastro_id is not distinct from p_cadastro_id
    and purpose = p_purpose and document_key = p_document_key and email_key = p_email_key
    and revoked_at is null and expires_at > clock_timestamp()) then return null; end if;
  v_identity := public.customer_login_identity(case when p_kind = 'empresa' then 'empresa' else 'cliente' end, p_document, p_email);
  if v_identity ->> 'tipo' is distinct from p_kind or v_identity ->> 'identityId' is distinct from p_identity_id::text
    or (v_identity ->> 'clienteId') is distinct from p_cadastro_id::text then return null; end if;
  return v_identity;
end $$;

-- Prevent new aliases from shadowing an existing CPF, including concurrent registration/import.
create function public.customer_login_document_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_document text := regexp_replace(new.cpf, '\D', '', 'g');
begin
  if tg_op = 'UPDATE' and regexp_replace(old.cpf, '\D', '', 'g') is not distinct from v_document then return new; end if;
  if v_document is null or v_document = '' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('customer-cpf:' || v_document, 0));
  if exists (select 1 from public.cadastros where regexp_replace(cpf, '\D', '', 'g') = v_document
      and (tg_table_name <> 'cadastros' or id <> new.id))
    or exists (select 1 from public.dependentes where regexp_replace(cpf, '\D', '', 'g') = v_document
      and (tg_table_name <> 'dependentes' or id <> new.id))
  then raise exception 'Documento já cadastrado' using errcode = '23505'; end if;
  return new;
end $$;
create trigger customer_login_document_guard before insert or update of cpf on public.cadastros
  for each row execute function public.customer_login_document_guard();
create trigger customer_login_document_guard before insert or update of cpf on public.dependentes
  for each row execute function public.customer_login_document_guard();

create function public.customer_login_consume(p_id uuid, p_code_hash text, p_document_key text, p_email_key text,
  p_identity_kind text, p_identity_id uuid, p_cadastro_id uuid, p_purpose text, p_session_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.customer_login_challenges%rowtype; v_expires timestamptz;
begin
  select * into v_row from public.customer_login_challenges where id = p_id for update;
  if not found or v_row.consumed_at is not null or v_row.expires_at <= clock_timestamp()
    or not v_row.delivered or v_row.attempts >= 5 then return null; end if;
  update public.customer_login_challenges set attempts = attempts + 1 where id = p_id;
  if v_row.document_key <> p_document_key or v_row.email_key <> p_email_key
    or v_row.code_hash <> p_code_hash or v_row.identity_id is null
    or v_row.identity_kind is distinct from p_identity_kind or v_row.identity_id is distinct from p_identity_id
    or v_row.cadastro_id is distinct from p_cadastro_id
  then return null; end if;
  update public.customer_login_challenges set consumed_at = clock_timestamp() where id = p_id;
  insert into public.customer_login_sessions(id, identity_kind, identity_id, cadastro_id, document_key, email_key, purpose)
    values(p_session_id, v_row.identity_kind, v_row.identity_id, v_row.cadastro_id, v_row.document_key, v_row.email_key, p_purpose)
    returning expires_at into v_expires;
  return jsonb_build_object('id', p_session_id, 'expiresAt', v_expires);
end $$;

revoke all on function public.customer_login_identity(text, text, text) from public, anon, authenticated;
revoke all on function public.customer_login_take_limit(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.customer_login_reserve(uuid, text, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.customer_login_consume(uuid, text, text, text, text, uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.customer_login_identity(text, text, text) to service_role;
grant execute on function public.customer_login_take_limit(text, integer, integer, integer) to service_role;
grant execute on function public.customer_login_reserve(uuid, text, uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.customer_login_consume(uuid, text, text, text, text, uuid, uuid, text, uuid) to service_role;
revoke all on function public.customer_login_validate_session(uuid, text, uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.customer_login_validate_session(uuid, text, uuid, uuid, text, text, text, text, text) to service_role;
revoke all on function public.customer_login_document_guard() from public, anon, authenticated;
grant execute on function public.customer_login_document_guard() to service_role;

commit;
