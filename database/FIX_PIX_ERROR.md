# 🔧 Correção: Erro ao Gerar PIX

## ❌ Erro

```
Falha ao vincular o pagamento PIX à fatura no banco de dados. 
Detalhes: record "new" has no field "updated_at"
```

## 🔍 Causa

A tabela `invoices` não possui o campo `updated_at`, mas existe um trigger no banco de dados tentando atualizá-lo automaticamente.

## ✅ Solução Rápida (2 minutos)

### Passo 1: Acessar Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Abra seu projeto
3. Vá em **SQL Editor**

### Passo 2: Executar Script de Correção

Copie e cole o seguinte SQL no editor:

```sql
-- Adicionar coluna updated_at
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Atualizar registros existentes
UPDATE invoices 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Criar função de trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;

-- Criar novo trigger
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Passo 3: Executar

Clique em **Run** ou pressione `Ctrl + Enter`

### Passo 4: Verificar

Execute este comando para confirmar:

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'invoices' AND column_name = 'updated_at';
```

**Resultado esperado:**
```
column_name | data_type
------------|---------------------------
updated_at  | timestamp with time zone
```

## 🧪 Testar

Agora tente gerar um PIX novamente no aplicativo. O erro deve estar resolvido!

## 📝 O Que Foi Corrigido

1. ✅ Adicionada coluna `updated_at` na tabela `invoices`
2. ✅ Configurado valor padrão como `NOW()`
3. ✅ Criada função de trigger para atualização automática
4. ✅ Configurado trigger para executar antes de UPDATE
5. ✅ Atualizados registros existentes

## 🔄 Estrutura Completa da Tabela Invoices

Após a correção, a tabela `invoices` terá:

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'Em aberto',
  payment_id TEXT,
  payment_method TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  boleto_url TEXT,
  boleto_barcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- ✅ NOVO
);
```

## 🚨 Se o Erro Persistir

### Verificar se há outros triggers

```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'invoices';
```

### Verificar logs de erro

```sql
SELECT * FROM action_logs 
WHERE status = 'FAILURE' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Recriar a tabela (ÚLTIMA OPÇÃO)

⚠️ **CUIDADO:** Isso apagará todos os dados!

```sql
-- Backup dos dados
CREATE TABLE invoices_backup AS SELECT * FROM invoices;

-- Recriar tabela
DROP TABLE invoices CASCADE;

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'Em aberto',
  payment_id TEXT,
  payment_method TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  boleto_url TEXT,
  boleto_barcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restaurar dados
INSERT INTO invoices SELECT * FROM invoices_backup;

-- Recriar políticas RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);
```

## 📞 Suporte

Se o problema persistir:
1. Verifique os logs no Supabase
2. Confirme que o script foi executado com sucesso
3. Tente limpar o cache do navegador
4. Verifique se há outros triggers conflitantes

## ✅ Checklist

- [ ] Script SQL executado no Supabase
- [ ] Coluna `updated_at` criada
- [ ] Trigger configurado
- [ ] Teste de geração de PIX realizado
- [ ] Erro resolvido

---

**Tempo estimado:** 2 minutos  
**Dificuldade:** Fácil  
**Requer:** Acesso ao Supabase SQL Editor
