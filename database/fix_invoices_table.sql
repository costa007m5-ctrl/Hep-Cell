-- ============================================
-- Fix: Adicionar campo updated_at na tabela invoices
-- ============================================
-- Este script corrige o erro: record "new" has no field "updated_at"
-- Execute este script no Supabase SQL Editor

-- 1. Adicionar coluna updated_at se não existir
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Atualizar registros existentes
UPDATE invoices 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 3. Criar ou substituir a função de trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Remover trigger antigo se existir
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;

-- 5. Criar novo trigger
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Verificar a estrutura da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- ============================================
-- Resultado esperado:
-- ✅ Coluna updated_at adicionada
-- ✅ Trigger configurado corretamente
-- ✅ Registros existentes atualizados
-- ============================================
