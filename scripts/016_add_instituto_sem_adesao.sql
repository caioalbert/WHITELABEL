-- Script: 016_add_instituto_sem_adesao.sql
-- Adiciona coluna sem_adesao à tabela institutos para controlar se os
-- clientes captados por este instituto pagam adesão ou não.
-- Idempotente: pode ser executado múltiplas vezes sem efeito colateral.

ALTER TABLE institutos
  ADD COLUMN IF NOT EXISTS sem_adesao BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN institutos.sem_adesao IS
  'Se true, clientes captados por este instituto não pagam adesão. Padrão: true (institutos tipicamente não cobram adesão).';
