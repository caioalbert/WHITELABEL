BEGIN;

CREATE TABLE IF NOT EXISTS public.empresa_acesso_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  escopo text NOT NULL DEFAULT 'FUNCIONARIOS' CHECK (escopo IN ('FUNCIONARIOS')),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 10 AND 1000),
  concedido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  concedido_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  revogado_em timestamptz,
  revogado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observacao text,
  CONSTRAINT empresa_acesso_excecoes_expiracao_check CHECK (expira_em > concedido_em),
  CONSTRAINT empresa_acesso_excecoes_revogacao_check CHECK (revogado_em IS NULL OR revogado_em >= concedido_em)
);

CREATE INDEX IF NOT EXISTS empresa_acesso_excecoes_empresa_expiracao_idx
  ON public.empresa_acesso_excecoes (empresa_id, expira_em DESC)
  WHERE revogado_em IS NULL;

ALTER TABLE public.empresa_acesso_excecoes ENABLE ROW LEVEL SECURITY;

COMMIT;
