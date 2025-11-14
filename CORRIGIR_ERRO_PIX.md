# 🔧 CORREÇÃO RÁPIDA - Erro ao Gerar PIX

## ❌ Erro Atual

```
Falha ao vincular o pagamento PIX à fatura no banco de dados. 
Detalhes: record "new" has no field "updated_at"
```

---

## ✅ SOLUÇÃO EM 3 PASSOS (2 minutos)

### 📍 PASSO 1: Acessar Supabase

1. Abra [supabase.com](https://supabase.com) no navegador
2. Faça login na sua conta
3. Selecione seu projeto **Hep-Cell**
4. No menu lateral, clique em **SQL Editor**

---

### 📍 PASSO 2: Executar Correção

**Copie e cole este código no SQL Editor:**

```sql
-- Adicionar coluna updated_at na tabela invoices
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

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;

-- Criar novo trigger
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Clique no botão "Run" ou pressione `Ctrl + Enter`**

---

### 📍 PASSO 3: Verificar

**Execute este comando para confirmar:**

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

✅ Se você ver isso, a correção foi bem-sucedida!

---

## 🧪 TESTAR

1. Volte para o aplicativo
2. Tente gerar um PIX novamente
3. O erro deve estar resolvido! 🎉

---

## 📋 O QUE FOI CORRIGIDO

- ✅ Adicionada coluna `updated_at` na tabela `invoices`
- ✅ Configurado valor padrão como data/hora atual
- ✅ Criado trigger para atualização automática
- ✅ Atualizados registros existentes

---

## 🆘 SE O ERRO PERSISTIR

### Opção 1: Verificar se o script foi executado

```sql
-- Ver estrutura da tabela invoices
\d invoices
```

### Opção 2: Verificar triggers

```sql
SELECT trigger_name 
FROM information_schema.triggers
WHERE event_object_table = 'invoices';
```

### Opção 3: Recriar a coluna

```sql
-- Remover coluna (se existir)
ALTER TABLE invoices DROP COLUMN IF EXISTS updated_at;

-- Adicionar novamente
ALTER TABLE invoices 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

---

## 📞 PRECISA DE AJUDA?

1. Verifique se você está no projeto correto no Supabase
2. Confirme que tem permissões de administrador
3. Tente executar os comandos um por vez
4. Verifique os logs de erro no Supabase

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- [database/FIX_PIX_ERROR.md](database/FIX_PIX_ERROR.md) - Guia detalhado
- [database/fix_invoices_table.sql](database/fix_invoices_table.sql) - Script completo
- [database/README.md](database/README.md) - Documentação do banco

---

## ⏱️ TEMPO ESTIMADO

- **Execução:** 30 segundos
- **Verificação:** 30 segundos
- **Teste:** 1 minuto
- **Total:** ~2 minutos

---

## ✨ APÓS A CORREÇÃO

Você poderá:
- ✅ Gerar pagamentos PIX
- ✅ Gerar boletos
- ✅ Processar pagamentos com cartão
- ✅ Receber notificações via webhook

---

**🎯 Execute o PASSO 2 agora e teste!**
