# 🗄️ Scripts de Banco de Dados

## 📋 Índice

1. [Correção de Erro PIX](#correção-de-erro-pix)
2. [Setup Inicial](#setup-inicial)
3. [Manutenção](#manutenção)

## 🔧 Correção de Erro PIX

### Problema
```
❌ Falha ao vincular o pagamento PIX à fatura no banco de dados. 
   Detalhes: record "new" has no field "updated_at"
```

### Solução Rápida

**Execute este comando no Supabase SQL Editor:**

```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

**Documentação completa:** [FIX_PIX_ERROR.md](FIX_PIX_ERROR.md)

**Script completo:** [fix_invoices_table.sql](fix_invoices_table.sql)

---

## 🚀 Setup Inicial

### 1. Criar Tabelas

```sql
-- Tabela de Perfis
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  identification_number TEXT,
  credit_score INTEGER,
  credit_limit DECIMAL(10,2),
  credit_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Faturas
CREATE TABLE IF NOT EXISTS invoices (
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

-- Tabela de Logs
CREATE TABLE IF NOT EXISTS action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Configurar RLS (Row Level Security)

```sql
-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Políticas para invoices
CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);
```

### 3. Criar Triggers

```sql
-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para invoices
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 4. Criar Função RPC para Novos Usuários

```sql
CREATE OR REPLACE FUNCTION handle_new_user_creation(user_id UUID, user_email TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, email, created_at, updated_at)
  VALUES (user_id, user_email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🧪 Testes

### Verificar Estrutura das Tabelas

```sql
-- Ver colunas da tabela invoices
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Ver colunas da tabela profiles
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

### Verificar Triggers

```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

### Verificar Políticas RLS

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 🔄 Manutenção

### Criar Fatura de Teste

```sql
INSERT INTO invoices (user_id, month, due_date, amount, status)
VALUES (
  'uuid-do-usuario',  -- Substitua pelo ID real
  'Janeiro/2024',
  '2024-01-31',
  100.00,
  'Em aberto'
);
```

### Ver Faturas Recentes

```sql
SELECT 
  i.id,
  i.month,
  i.amount,
  i.status,
  i.payment_method,
  i.created_at,
  p.email as user_email
FROM invoices i
LEFT JOIN profiles p ON i.user_id = p.id
ORDER BY i.created_at DESC
LIMIT 10;
```

### Ver Logs de Ações

```sql
SELECT 
  action_type,
  status,
  description,
  created_at
FROM action_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Limpar Dados de Teste

```sql
-- CUIDADO: Isso apaga dados!
DELETE FROM invoices WHERE status = 'Em aberto' AND amount < 10;
DELETE FROM action_logs WHERE created_at < NOW() - INTERVAL '7 days';
```

---

## 📊 Relatórios

### Resumo de Pagamentos

```sql
SELECT 
  payment_method,
  status,
  COUNT(*) as total,
  SUM(amount) as total_amount
FROM invoices
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY payment_method, status
ORDER BY payment_method, status;
```

### Usuários com Faturas Pendentes

```sql
SELECT 
  p.email,
  COUNT(i.id) as pending_invoices,
  SUM(i.amount) as total_due
FROM profiles p
JOIN invoices i ON p.id = i.user_id
WHERE i.status = 'Em aberto'
GROUP BY p.email
ORDER BY total_due DESC;
```

---

## 🆘 Troubleshooting

### Erro: "permission denied for table"
```sql
-- Verificar permissões
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'invoices';
```

### Erro: "relation does not exist"
```sql
-- Listar todas as tabelas
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Erro: "trigger does not exist"
```sql
-- Listar todos os triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

---

## 📚 Recursos

- [Documentação Supabase](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ Checklist de Setup

- [ ] Tabelas criadas (profiles, invoices, action_logs)
- [ ] RLS habilitado
- [ ] Políticas de segurança configuradas
- [ ] Triggers de updated_at criados
- [ ] Função RPC para novos usuários criada
- [ ] Testes de inserção realizados
- [ ] Verificação de estrutura concluída

---

**Última atualização:** 14 de Novembro de 2025
