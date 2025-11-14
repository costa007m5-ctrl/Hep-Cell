# Guia de Testes - APIs Mercado Pago

## ⚠️ Importante

As APIs serverless (`/api/*`) são projetadas para rodar no **Vercel** e **não funcionam** diretamente no servidor de desenvolvimento Vite local. 

Para testar as APIs, você tem duas opções:

## Opção 1: Deploy no Vercel (Recomendado)

### Passo 1: Instalar Vercel CLI
```bash
npm install -g vercel
```

### Passo 2: Fazer Login
```bash
vercel login
```

### Passo 3: Deploy
```bash
vercel
```

### Passo 4: Configurar Variáveis de Ambiente
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add MERCADO_PAGO_ACCESS_TOKEN
vercel env add NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
vercel env add API_KEY
```

### Passo 5: Testar
Após o deploy, você receberá uma URL como:
```
https://seu-projeto.vercel.app
```

Teste os endpoints:
```bash
# Teste de configuração
curl https://seu-projeto.vercel.app/api/config

# Teste de criação de PIX (substitua os valores)
curl -X POST https://seu-projeto.vercel.app/api/mercadopago/create-pix-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "description": "Teste PIX",
    "payerEmail": "teste@email.com",
    "userId": "seu-user-id",
    "firstName": "João",
    "lastName": "Silva",
    "identificationNumber": "12345678900",
    "invoiceId": "invoice-id-teste"
  }'
```

## Opção 2: Usar Vercel Dev (Desenvolvimento Local)

### Passo 1: Instalar Vercel CLI
```bash
npm install -g vercel
```

### Passo 2: Criar arquivo .env
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### Passo 3: Rodar Vercel Dev
```bash
vercel dev
```

Isso iniciará um servidor local que simula o ambiente Vercel, incluindo as APIs serverless.

### Passo 4: Testar
```bash
# Teste de configuração
curl http://localhost:3000/api/config

# Teste de criação de PIX
curl -X POST http://localhost:3000/api/mercadopago/create-pix-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "description": "Teste PIX",
    "payerEmail": "teste@email.com",
    "userId": "seu-user-id",
    "firstName": "João",
    "lastName": "Silva",
    "identificationNumber": "12345678900",
    "invoiceId": "invoice-id-teste"
  }'
```

## Testes de Integração

### 1. Teste de Configuração
```bash
curl http://localhost:3000/api/config
```

**Resposta esperada:**
```json
{
  "supabaseUrl": "https://...",
  "supabaseAnonKey": "...",
  "mercadoPagoPublicKey": "...",
  "geminiApiKey": "..."
}
```

### 2. Teste de PIX

**Pré-requisitos:**
- Ter um usuário criado no Supabase
- Ter uma fatura criada no banco de dados

```bash
curl -X POST http://localhost:3000/api/mercadopago/create-pix-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "description": "Fatura Teste - Janeiro/2024",
    "payerEmail": "cliente@email.com",
    "userId": "uuid-do-usuario-no-supabase",
    "firstName": "João",
    "lastName": "Silva",
    "identificationNumber": "12345678900",
    "invoiceId": "uuid-da-fatura-no-supabase"
  }'
```

**Resposta esperada (sucesso):**
```json
{
  "paymentId": 123456789,
  "qrCode": "00020126580014br.gov.bcb.pix...",
  "qrCodeBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "expires": "2024-01-01T12:30:00.000Z"
}
```

**Resposta esperada (perfil incompleto):**
```json
{
  "code": "INCOMPLETE_PROFILE",
  "message": "Para gerar um PIX, por favor, preencha seu nome completo e CPF."
}
```

### 3. Teste de Boleto

```bash
curl -X POST http://localhost:3000/api/mercadopago/create-boleto-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "description": "Fatura Teste - Janeiro/2024",
    "payer": {
      "email": "cliente@email.com",
      "firstName": "João",
      "lastName": "Silva",
      "identificationType": "CPF",
      "identificationNumber": "12345678900",
      "zipCode": "01310100",
      "streetName": "Avenida Paulista",
      "streetNumber": "1000",
      "neighborhood": "Bela Vista",
      "city": "São Paulo",
      "federalUnit": "SP"
    },
    "invoiceId": "uuid-da-fatura-no-supabase"
  }'
```

**Resposta esperada:**
```json
{
  "message": "Boleto gerado e salvo com sucesso!",
  "paymentId": 123456789,
  "boletoUrl": "https://www.mercadopago.com.br/payments/...",
  "boletoBarcode": "34191.79001 01043.510047 91020.150008 1 96610000010000"
}
```

### 4. Teste de Preferência (Cartão)

```bash
curl -X POST http://localhost:3000/api/mercadopago/create-preference \
  -H "Content-Type: application/json" \
  -d '{
    "id": "uuid-da-fatura",
    "description": "Fatura Teste - Janeiro/2024",
    "amount": 150.00,
    "payerEmail": "cliente@email.com",
    "redirect": true
  }'
```

**Resposta esperada:**
```json
{
  "id": "1234567890-abcd-1234-efgh-567890abcdef",
  "init_point": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=..."
}
```

## Testando o Webhook

### Simulação Manual

O webhook do Mercado Pago envia notificações quando um pagamento é processado. Para testar:

```bash
curl -X POST http://localhost:3000/api/mercadopago/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "data": {
      "id": "123456789"
    }
  }'
```

**Nota:** O webhook tentará buscar os detalhes do pagamento no Mercado Pago usando o ID fornecido.

### Teste Real

1. Configure o webhook no painel do Mercado Pago
2. Faça um pagamento de teste (PIX ou Boleto)
3. Aguarde a notificação
4. Verifique os logs no Supabase (tabela `action_logs`)

## Verificando Logs

### No Supabase

Acesse a tabela `action_logs` para ver o histórico de ações:

```sql
SELECT * FROM action_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### No Vercel

1. Acesse o painel do Vercel
2. Vá em **Deployments** → selecione o deployment
3. Clique em **Functions** para ver os logs das APIs

## Troubleshooting

### Erro 500: "Server configuration is incomplete"
- Verifique se todas as variáveis de ambiente estão configuradas
- Use `vercel env ls` para listar as variáveis configuradas

### Erro 401/403 do Mercado Pago
- Verifique se o Access Token está correto
- Confirme que está usando credenciais de produção (não teste)
- Verifique se a conta do Mercado Pago está ativa

### Erro de CORS
- Adicione o domínio do frontend nas configurações do Vercel
- Verifique se o header `Origin` está sendo enviado corretamente

### PIX/Boleto não é gerado
- Verifique se a fatura existe no banco de dados
- Confirme que o `invoiceId` está correto
- Verifique os logs no Supabase

## Checklist de Produção

Antes de colocar em produção:

- [ ] Todas as variáveis de ambiente configuradas no Vercel
- [ ] Webhook configurado no painel do Mercado Pago
- [ ] Credenciais de **produção** do Mercado Pago (não teste)
- [ ] Banco de dados Supabase configurado com as tabelas necessárias
- [ ] RLS (Row Level Security) configurado no Supabase
- [ ] Domínio customizado configurado (opcional)
- [ ] SSL/HTTPS ativo
- [ ] Testes de pagamento realizados com valores reais pequenos
- [ ] Monitoramento de logs ativo

## Recursos Úteis

- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Mercado Pago API Reference](https://www.mercadopago.com.br/developers/pt/reference)
- [Supabase Docs](https://supabase.com/docs)
- [Webhook Testing Tool](https://webhook.site)
