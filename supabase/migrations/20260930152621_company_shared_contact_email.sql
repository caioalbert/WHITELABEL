BEGIN;
SET LOCAL lock_timeout = '5s';

-- O e-mail é um contato compartilhável para colaboradores empresariais.
-- Cadastros individuais continuam com e-mail único; CPF continua único.
CREATE UNIQUE INDEX IF NOT EXISTS cadastros_email_individual_idx
  ON public.cadastros (email) WHERE empresa_id IS NULL;
CREATE INDEX IF NOT EXISTS cadastros_email_lookup_idx ON public.cadastros (email);
DROP INDEX IF EXISTS public.cadastros_email_idx;

CREATE INDEX IF NOT EXISTS empresa_funcionarios_email_lookup_idx
  ON public.empresa_funcionarios (LOWER(email));
DROP INDEX IF EXISTS public.empresa_funcionarios_email_idx;

COMMIT;
