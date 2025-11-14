# Configuração das APIs - Relp Cell Pagamentos

## Visão Geral

Este aplicativo possui APIs serverless implementadas para processar pagamentos via Mercado Pago com três métodos:
- **PIX** - Pagamento instantâneo
- **Boleto** - Boleto bancário
- **Cartão de Crédito** - Parcelamento em até 3x

## Estrutura das APIs

### Endpoints Disponíveis

#### 1. `/api/config` (GET)
Retorna as configurações públicas do aplicativo.

**Resposta:**
```json
{
  "supabaseUrl": "https://...",
  "supabaseAnonKey": "...",
  "mercadoPagoPublicKey": "...",
  "geminiApiKey": "..."
}
```

#### 2. `/api/mercadopago/create-pix-payment` (POST)
Gera um pagamento PIX com QR Code.

**Request Body:**
```json
{
  "amount": 100.00,
  "description": "Fatura Relp Cell - Janeiro/2024",
  "payerEmail": "cliente@email.com",
  "userId": "uuid-do-usuario",
  "firstName": "João",
  "lastName": "Silva",
  "identificationNumber": "12345678900",
  "invoiceId": "uuid-da-fatura"
}
```

**Resposta:**
```json
{
  "paymentId": 123456789,
  "qrCode": "00020126580014br.gov.bcb.pix...",
  "qrCodeBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "expires": "2024-01-01T12:30:00.000Z"
}
```

#### 3. `/api/mercadopago/create-boleto-payment` (POST)
Gera um boleto bancário.

**Request Body:**
```json
{
  "amount": 100.00,
  "description": "Fatura Relp Cell - Janeiro/2024",
  "payer": {
    "email": "cliente@email.com",
    "firstName": "João",
    "lastName": "Silva",
    "identificationType": "CPF",
    "identificationNumber": "12345678900",
    "zipCode": "12345678",
    "streetName": "Rua Exemplo",
    "streetNumber": "123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "federalUnit": "SP"
  },
  "invoiceId": "uuid-da-fatura"
}
```

**Resposta:**
```json
{
  "message": "Boleto gerado e salvo com sucesso!",
  "paymentId": 123456789,
  "boletoUrl": "https://www.mercadopago.com.br/payments/...",
  "boletoBarcode": "34191.79001 01043.510047 91020.150008 1 96610000010000"
}
```

#### 4. `/api/mercadopago/create-preference` (POST)
Cria uma preferência de pagamento para cartão de crédito.

**Request Body:**
```json
{
  "id": "uuid-da-fatura",
  "description": "Fatura Relp Cell - Janeiro/2024",
  "amount": 100.00,
  "payerEmail": "cliente@email.com",
  "redirect": true
}
```

**Resposta:**
```json
{
  "id": "1234567890-abcd-1234-efgh-567890abcdef",
  "init_point": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=..."
}
```

#### 5. `/api/mercadopago/webhook` (POST/GET)
Recebe notificações de pagamento do Mercado Pago.

**Request Body (do Mercado Pago):**
```json
{
  "type": "payment",
  "data": {
    "id": "123456789"
  }
}
```

#### 6. `/api/mercadopago/generate-message` (POST)
Gera mensagem de confirmação usando Gemini AI.

**Request Body:**
```json
{
  "customerName": "João Silva",
  "amount": "100.00"
}
```

**Resposta:**
```json
{
  "message": "Olá João Silva! Confirmamos o recebimento do seu pagamento..."
}
```

#### 7. `/api/admin/*`
Endpoints administrativos para gerenciamento de usuários, faturas e análise de crédito.

## Configuração de Variáveis de Ambiente

### Desenvolvimento Local

1. Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Preencha as variáveis:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=seu-access-token
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=sua-chave-publica

# Gemini AI
API_KEY=sua-chave-gemini
```

### Produção (Vercel)

Configure as variáveis de ambiente no painel do Vercel:

1. Acesse seu projeto no Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione todas as variáveis listadas acima

## Como Obter as Chaves

### Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie/acesse seu projeto
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

### Mercado Pago

1. Acesse [developers.mercadopago.com](https://developers.mercadopago.com)
2. Faça login na sua conta
3. Vá em **Suas integrações** → **Credenciais**
4. Escolha **Produção** ou **Teste**
5. Copie:
   - **Access Token** → `MERCADO_PAGO_ACCESS_TOKEN`
   - **Public Key** → `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`

### Gemini AI

1. Acesse [ai.google.dev](https://ai.google.dev)
2. Clique em **Get API Key**
3. Crie/selecione um projeto
4. Copie a chave → `API_KEY`

## Configuração do Webhook do Mercado Pago

1. Acesse o [painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
2. Vá em **Suas integrações** → **Webhooks**
3. Configure a URL do webhook:
   ```
   https://seu-dominio.com/api/mercadopago/webhook
   ```
4. Selecione os eventos:
   - ✅ Pagamentos
   - ✅ Merchant Orders

## Testando as APIs Localmente

### Usando cURL

**Teste de configuração:**
```bash
curl http://localhost:5173/api/config
```

**Teste de criação de PIX:**
```bash
curl -X POST http://localhost:5173/api/mercadopago/create-pix-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "description": "Teste PIX",
    "payerEmail": "teste@email.com",
    "userId": "uuid-teste",
    "firstName": "João",
    "lastName": "Silva",
    "identificationNumber": "12345678900",
    "invoiceId": "uuid-fatura-teste"
  }'
```

## Estrutura do Banco de Dados (Supabase)

### Tabela: `invoices`
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
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
```

### Tabela: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
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
```

### Tabela: `action_logs`
```sql
CREATE TABLE action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Fluxo de Pagamento

### PIX
1. Cliente seleciona método PIX
2. Frontend chama `/api/mercadopago/create-pix-payment`
3. Backend gera QR Code e retorna
4. Cliente escaneia QR Code e paga
5. Mercado Pago notifica via webhook
6. Webhook atualiza status da fatura para "Paga"

### Boleto
1. Cliente seleciona método Boleto
2. Frontend chama `/api/mercadopago/create-boleto-payment`
3. Backend gera boleto e retorna URL + código de barras
4. Cliente paga o boleto
5. Mercado Pago notifica via webhook (1-3 dias úteis)
6. Webhook atualiza status da fatura para "Paga"

### Cartão
1. Cliente seleciona método Cartão
2. Frontend chama `/api/mercadopago/create-preference`
3. Backend retorna preference ID
4. Frontend renderiza Mercado Pago Brick
5. Cliente preenche dados do cartão
6. Pagamento é processado instantaneamente
7. Frontend atualiza status localmente

## Segurança

- ✅ Todas as chaves privadas ficam no servidor (variáveis de ambiente)
- ✅ Apenas chaves públicas são expostas ao frontend
- ✅ Validação de dados em todos os endpoints
- ✅ Logs de ações para auditoria
- ✅ CORS configurado adequadamente
- ✅ Webhook valida origem das requisições

## Troubleshooting

### Erro: "As variáveis de ambiente não estão configuradas"
- Verifique se todas as variáveis estão definidas no `.env` ou no Vercel
- Reinicie o servidor após adicionar variáveis

### Erro: "Falha ao gerar PIX/Boleto"
- Verifique se o Access Token do Mercado Pago está correto
- Confirme que está usando credenciais de produção (não teste)
- Verifique se a conta do Mercado Pago está ativa

### Webhook não está funcionando
- Confirme que a URL do webhook está acessível publicamente
- Verifique os logs no painel do Mercado Pago
- Teste manualmente com cURL

### Erro: "INCOMPLETE_PROFILE"
- O usuário precisa preencher nome completo e CPF
- Frontend deve mostrar formulário de dados do pagador

## Suporte

Para mais informações:
- [Documentação Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs)
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Gemini AI](https://ai.google.dev/docs)
