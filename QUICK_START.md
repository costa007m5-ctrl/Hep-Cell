# 🚀 Quick Start - Deploy em 5 Minutos

## Passo 1: Obter Credenciais (5 min)

### Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá em **Settings** → **API**
4. Copie:
   - Project URL
   - anon public key
   - service_role key

### Mercado Pago
1. Acesse [developers.mercadopago.com](https://developers.mercadopago.com)
2. Vá em **Suas integrações** → **Credenciais**
3. Escolha **Teste** (para desenvolvimento) ou **Produção**
4. Copie:
   - Access Token
   - Public Key

### Gemini AI
1. Acesse [ai.google.dev](https://ai.google.dev)
2. Clique em **Get API Key**
3. Copie a chave gerada

## Passo 2: Configurar Banco de Dados (2 min)

No Supabase SQL Editor, execute:

```sql
-- Criar tabela de perfis
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  identification_number TEXT,
  credit_score INTEGER,
  credit_limit DECIMAL(10,2),
  credit_status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de faturas
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'Em aberto',
  payment_id TEXT,
  payment_method TEXT,
  payment_date TIMESTAMP,
  boleto_url TEXT,
  boleto_barcode TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de logs
CREATE TABLE action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);
```

## Passo 3: Deploy no Vercel (3 min)

### Via CLI (Recomendado)

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Configurar variáveis de ambiente
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add MERCADO_PAGO_ACCESS_TOKEN
vercel env add NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
vercel env add API_KEY

# Deploy em produção
vercel --prod
```

### Via Dashboard

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **Add New** → **Project**
3. Importe o repositório do GitHub
4. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MERCADO_PAGO_ACCESS_TOKEN`
   - `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
   - `API_KEY`
5. Clique em **Deploy**

## Passo 4: Configurar Webhook (1 min)

1. Acesse [Painel Mercado Pago](https://www.mercadopago.com.br/developers/panel)
2. Vá em **Webhooks**
3. Adicione nova URL:
   ```
   https://seu-dominio.vercel.app/api/mercadopago/webhook
   ```
4. Selecione eventos:
   - ✅ Pagamentos
   - ✅ Merchant Orders

## Passo 5: Testar (2 min)

### Criar usuário de teste
1. Acesse seu app: `https://seu-dominio.vercel.app`
2. Clique em **Criar conta**
3. Preencha os dados e confirme o email

### Criar fatura de teste

No Supabase SQL Editor:

```sql
INSERT INTO invoices (user_id, month, due_date, amount, status)
VALUES (
  'uuid-do-usuario',  -- Substitua pelo ID do usuário criado
  'Janeiro/2024',
  '2024-01-31',
  100.00,
  'Em aberto'
);
```

### Testar pagamento
1. Faça login no app
2. Vá para **Faturas**
3. Clique em **Pagar**
4. Escolha um método de pagamento
5. Complete o pagamento

## ✅ Pronto!

Seu sistema de pagamentos está funcionando!

## 🔍 Verificações

### Teste de API
```bash
curl https://seu-dominio.vercel.app/api/config
```

### Teste de PIX
```bash
curl -X POST https://seu-dominio.vercel.app/api/mercadopago/create-pix-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "description": "Teste",
    "payerEmail": "teste@email.com",
    "userId": "seu-user-id",
    "firstName": "João",
    "lastName": "Silva",
    "identificationNumber": "12345678900",
    "invoiceId": "invoice-id"
  }'
```

## 🐛 Problemas Comuns

### "Server configuration is incomplete"
- Verifique se todas as variáveis de ambiente estão configuradas no Vercel
- Use `vercel env ls` para listar

### "Failed to connect to Supabase"
- Verifique se a URL e as chaves estão corretas
- Confirme que o projeto Supabase está ativo

### "Mercado Pago error"
- Verifique se está usando credenciais de produção (não teste)
- Confirme que a conta está ativa e verificada

### Webhook não funciona
- Verifique se a URL está acessível publicamente
- Confirme que está usando HTTPS
- Teste manualmente com cURL

## 📚 Próximos Passos

- [ ] Configurar domínio customizado
- [ ] Adicionar mais métodos de pagamento
- [ ] Implementar notificações por email
- [ ] Adicionar dashboard administrativo
- [ ] Configurar monitoramento de erros

## 🆘 Precisa de Ajuda?

- 📖 [Documentação Completa](API_SETUP.md)
- 🧪 [Guia de Testes](TESTING_GUIDE.md)
- 🐛 [Reportar Bug](https://github.com/costa007m5-ctrl/Hep-Cell/issues)
