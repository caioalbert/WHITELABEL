begin;
create table public.farmacia_popular_medicamentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (length(btrim(codigo)) between 1 and 30),
  dv text not null check (dv ~ '^[0-9]$'),
  nome text not null check (length(btrim(nome)) between 1 and 300),
  indicacao text not null check (length(btrim(indicacao)) between 1 and 300),
  substancia text not null check (length(btrim(substancia)) between 1 and 300),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(codigo, dv)
);
create table public.farmacia_popular_lojas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (length(btrim(codigo)) between 1 and 30),
  nome text not null check (length(btrim(nome)) between 1 and 300),
  endereco text not null check (length(btrim(endereco)) between 1 and 300),
  bairro text not null default '',
  cidade text not null check (length(btrim(cidade)) between 1 and 300),
  uf text not null check (uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  constraint farmacia_popular_lojas_coordinate_pair check ((latitude is null) = (longitude is null)),
  cep text not null check (cep ~ '^[0-9]{5}-?[0-9]{3}$'),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farmacia_popular_medicamentos_ativos_nome_idx on public.farmacia_popular_medicamentos(nome, id) where ativo;
create index farmacia_popular_lojas_ativas_nome_idx on public.farmacia_popular_lojas(nome, id) where ativo;
alter table public.farmacia_popular_medicamentos enable row level security;
alter table public.farmacia_popular_lojas enable row level security;
revoke all on public.farmacia_popular_medicamentos, public.farmacia_popular_lojas from public, anon, authenticated;
grant select, insert, update, delete on public.farmacia_popular_medicamentos, public.farmacia_popular_lojas to service_role;
comment on table public.farmacia_popular_medicamentos is 'Lista administrada no servidor; cliente recebe somente ativos mediante autenticação.';
comment on table public.farmacia_popular_lojas is 'Lojas Pague Menos participantes; lista administrada no servidor.';
commit;
