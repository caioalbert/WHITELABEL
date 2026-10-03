begin;

-- Password material is private; account data and existing customers are not rewritten.
create table public.customer_password_credentials (
  identity_kind text not null check (identity_kind in ('titular','dependente','empresa')),
  identity_id uuid not null,
  cadastro_id uuid references public.cadastros(id) on delete cascade,
  dependente_id uuid references public.dependentes(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete cascade,
  document_key text not null check (document_key ~ '^[0-9a-f]{64}$'),
  email_key text not null check (email_key ~ '^[0-9a-f]{64}$'),
  password_hash text not null check (password_hash ~ '^nas-scrypt-v1\$[0-9a-f]{32}\$[0-9a-f]{64}$'),
  changed_at timestamptz not null default clock_timestamp(),
  primary key(identity_kind,identity_id),
  check ((identity_kind='titular' and cadastro_id is not null and cadastro_id=identity_id and dependente_id is null and empresa_id is null)
    or (identity_kind='dependente' and cadastro_id is not null and dependente_id is not null and dependente_id=identity_id and empresa_id is null)
    or (identity_kind='empresa' and cadastro_id is null and dependente_id is null and empresa_id is not null and empresa_id=identity_id))
);
alter table public.customer_password_credentials enable row level security;
revoke all on public.customer_password_credentials from public,anon,authenticated;
grant select,insert,update,delete on public.customer_password_credentials to service_role;

alter table public.customer_login_sessions add column challenge_id uuid references public.customer_login_challenges(id) on delete cascade;
create index customer_login_sessions_challenge_idx on public.customer_login_sessions(challenge_id) where challenge_id is not null;
alter table public.customer_login_sessions add constraint customer_login_sessions_setup_challenge_check check (purpose<>'password-setup' or challenge_id is not null);
alter table public.customer_login_sessions drop constraint customer_login_sessions_purpose_check;
alter table public.customer_login_sessions drop constraint customer_login_sessions_check;
alter table public.customer_login_sessions add constraint customer_login_sessions_purpose_check
  check (purpose in ('cliente','cadastro-flow','empresa-app','empresa-flow','password-setup'));
alter table public.customer_login_sessions add constraint customer_login_sessions_check
  check ((identity_kind='empresa' and cadastro_id is null and purpose in ('empresa-app','empresa-flow','password-setup'))
    or (identity_kind='titular' and cadastro_id is not null and cadastro_id=identity_id and purpose in ('cliente','cadastro-flow','password-setup'))
    or (identity_kind='dependente' and cadastro_id is not null and purpose in ('cliente','password-setup')));

create function public.customer_password_attempt(p_document_key text,p_ip_key text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if not public.customer_login_take_limit('password-document:'||p_document_key,15,900,0) then return false;end if;
  if not public.customer_login_take_limit('password-ip:'||p_ip_key,100,900,0) then return false;end if;
  return public.customer_login_take_limit('password-global',2000,900,0);
end $$;

create function public.customer_password_reserve(p_id uuid,p_kind text,p_identity_id uuid,p_cadastro_id uuid,
  p_document_key text,p_email_key text,p_ip_key text,p_code_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('customer-password:'||p_kind||':'||coalesce(p_identity_id::text,p_document_key),0));
  if not public.customer_login_reserve(p_id,p_kind,p_identity_id,p_cadastro_id,p_document_key,p_email_key,p_ip_key,p_code_hash) then return false;end if;
  update public.customer_login_challenges set expires_at='infinity'::timestamptz where id=p_id and p_identity_id is not null;
  update public.customer_login_challenges set consumed_at=clock_timestamp()
    where identity_kind=p_kind and identity_id=p_identity_id and id<>p_id and consumed_at is null;
  update public.customer_login_sessions set revoked_at=clock_timestamp()
    where identity_kind=p_kind and identity_id=p_identity_id and purpose='password-setup' and revoked_at is null;
  delete from public.customer_login_challenges where id in
    (select id from public.customer_login_challenges where consumed_at<clock_timestamp()-interval '1 day' order by consumed_at limit 100);
  return true;
end $$;

-- A correct initial credential creates only a short session for setting the personal password.
create or replace function public.customer_login_consume(p_id uuid,p_code_hash text,p_document_key text,p_email_key text,
  p_identity_kind text,p_identity_id uuid,p_cadastro_id uuid,p_purpose text,p_session_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_row public.customer_login_challenges%rowtype;v_expires timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('customer-password:'||coalesce(p_identity_kind,'unknown')||':'||coalesce(p_identity_id::text,p_document_key),0));
  select * into v_row from public.customer_login_challenges where id=p_id for update;
  if not found or v_row.consumed_at is not null or v_row.expires_at<=clock_timestamp()
    or not v_row.delivered or (v_row.attempts>=5 and v_row.expires_at<>'infinity'::timestamptz) then return null;end if;
  -- Long-lived random initial passwords are throttled by customer_password_attempt.
  -- Wrong guesses must not permanently expire a still-unused initial password.
  update public.customer_login_challenges set attempts=least(attempts+1,5) where id=p_id;
  if v_row.document_key<>p_document_key or v_row.email_key<>p_email_key or v_row.code_hash<>p_code_hash
    or v_row.identity_id is null or v_row.identity_kind is distinct from p_identity_kind
    or v_row.identity_id is distinct from p_identity_id or v_row.cadastro_id is distinct from p_cadastro_id then return null;end if;
  update public.customer_login_challenges set consumed_at=clock_timestamp() where id=p_id;
  v_expires:=clock_timestamp()+case when p_purpose='password-setup' then interval '20 minutes' else interval '24 hours' end;
  insert into public.customer_login_sessions(id,identity_kind,identity_id,cadastro_id,document_key,email_key,purpose,expires_at,challenge_id)
    values(p_session_id,v_row.identity_kind,v_row.identity_id,v_row.cadastro_id,v_row.document_key,v_row.email_key,p_purpose,v_expires,case when p_purpose='password-setup' then p_id else null end);
  return jsonb_build_object('id',p_session_id,'expiresAt',v_expires);
end $$;

create function public.customer_password_create_session(p_kind text,p_identity_id uuid,p_cadastro_id uuid,
  p_document text,p_email text,p_document_key text,p_email_key text,p_expected_hash text,p_purpose text,p_session_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_credentials public.customer_password_credentials%rowtype;v_identity jsonb;v_expires timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('customer-password:'||p_kind||':'||p_identity_id::text,0));
  select * into v_credentials from public.customer_password_credentials where identity_kind=p_kind and identity_id=p_identity_id for update;
  if not found or v_credentials.password_hash<>p_expected_hash or v_credentials.document_key<>p_document_key
    or v_credentials.email_key<>p_email_key or v_credentials.cadastro_id is distinct from p_cadastro_id
    or p_purpose='password-setup' then return null;end if;
  v_identity:=public.customer_login_identity(case when p_kind='empresa' then 'empresa' else 'cliente' end,p_document,p_email);
  if v_identity->>'tipo' is distinct from p_kind or v_identity->>'identityId' is distinct from p_identity_id::text
    or v_identity->>'clienteId' is distinct from p_cadastro_id::text then return null;end if;
  v_expires:=clock_timestamp()+interval '24 hours';
  insert into public.customer_login_sessions(id,identity_kind,identity_id,cadastro_id,document_key,email_key,purpose,expires_at)
    values(p_session_id,p_kind,p_identity_id,p_cadastro_id,p_document_key,p_email_key,p_purpose,v_expires);
  return jsonb_build_object('id',p_session_id,'expiresAt',v_expires);
end $$;

create function public.customer_password_set(p_setup_id uuid,p_kind text,p_identity_id uuid,p_cadastro_id uuid,
  p_document text,p_email text,p_document_key text,p_email_key text,p_password_hash text,
  p_challenge_id uuid,p_new_initial_hash text,p_purpose text,p_session_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_setup public.customer_login_sessions%rowtype;v_challenge public.customer_login_challenges%rowtype;
  v_identity jsonb;v_expires timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('customer-password:'||p_kind||':'||p_identity_id::text,0));
  select * into v_setup from public.customer_login_sessions where id=p_setup_id for update;
  if not found or v_setup.purpose<>'password-setup' or v_setup.revoked_at is not null or v_setup.expires_at<=clock_timestamp()
    or v_setup.identity_kind<>p_kind or v_setup.identity_id<>p_identity_id
    or v_setup.cadastro_id is distinct from p_cadastro_id or v_setup.document_key<>p_document_key
    or v_setup.email_key<>p_email_key or v_setup.challenge_id is distinct from p_challenge_id or p_purpose='password-setup' then return null;end if;
  select * into v_challenge from public.customer_login_challenges where id=p_challenge_id;
  if not found or v_challenge.consumed_at is null or v_challenge.identity_kind<>p_kind
    or v_challenge.identity_id is distinct from p_identity_id or v_challenge.cadastro_id is distinct from p_cadastro_id
    or v_challenge.document_key<>p_document_key or v_challenge.email_key<>p_email_key
    or v_challenge.code_hash=p_new_initial_hash then return null;end if;
  v_identity:=public.customer_login_identity(case when p_kind='empresa' then 'empresa' else 'cliente' end,p_document,p_email);
  if v_identity->>'tipo' is distinct from p_kind or v_identity->>'identityId' is distinct from p_identity_id::text
    or v_identity->>'clienteId' is distinct from p_cadastro_id::text then return null;end if;
  insert into public.customer_password_credentials(identity_kind,identity_id,cadastro_id,dependente_id,empresa_id,document_key,email_key,password_hash)
    values(p_kind,p_identity_id,p_cadastro_id,case when p_kind='dependente' then p_identity_id else null end,
      case when p_kind='empresa' then p_identity_id else null end,p_document_key,p_email_key,p_password_hash)
    on conflict(identity_kind,identity_id) do update set password_hash=excluded.password_hash,cadastro_id=excluded.cadastro_id,
      document_key=excluded.document_key,email_key=excluded.email_key,changed_at=clock_timestamp();
  update public.customer_login_sessions set revoked_at=clock_timestamp()
    where identity_kind=p_kind and identity_id=p_identity_id and revoked_at is null;
  v_expires:=clock_timestamp()+interval '24 hours';
  insert into public.customer_login_sessions(id,identity_kind,identity_id,cadastro_id,document_key,email_key,purpose,expires_at)
    values(p_session_id,p_kind,p_identity_id,p_cadastro_id,p_document_key,p_email_key,p_purpose,v_expires);
  return jsonb_build_object('id',p_session_id,'expiresAt',v_expires);
end $$;

revoke all on function public.customer_password_attempt(text,text) from public,anon,authenticated;
revoke all on function public.customer_password_reserve(uuid,text,uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.customer_password_create_session(text,uuid,uuid,text,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.customer_password_set(uuid,text,uuid,uuid,text,text,text,text,text,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.customer_password_attempt(text,text) to service_role;
grant execute on function public.customer_password_reserve(uuid,text,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.customer_password_create_session(text,uuid,uuid,text,text,text,text,text,text,uuid) to service_role;
grant execute on function public.customer_password_set(uuid,text,uuid,uuid,text,text,text,text,text,uuid,text,text,uuid) to service_role;
commit;
