# 📚 Guia de Uso das APIs - Relp Cell

## 🌐 URL Base
Todas as APIs estão rodando em: `http://localhost:3000`

---

## 🔑 Configurações Necessárias

Antes de usar as APIs, você precisa configurar estas variáveis de ambiente:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_publica_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_admin_supabase

# Gemini AI
API_KEY=sua_chave_gemini

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=seu_token_mercadopago
MERCADO_PAGO_PUBLIC_KEY=sua_chave_publica_mercadopago

# Mercado Livre
ML_CLIENT_ID=seu_client_id_mercadolivre
ML_CLIENT_SECRET=seu_client_secret_mercadolivre
```

---

## 📦 APIs Públicas (Sem autenticação)

### 1. **Obter Configurações Públicas**
```http
GET /api/config
```

**Resposta:**
```json
{
  "supabaseUrl": "https://seu-projeto.supabase.co",
  "supabaseAnonKey": "eyJhbGc...",
  "mercadoPagoPublicKey": "APP_USR-..."
}
```

---

### 2. **Listar Produtos**
```http
GET /api/products
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "name": "iPhone 15 Pro",
    "description": "Smartphone Apple",
    "price": 5999.00,
    "stock": 10,
    "image_url": "https://...",
    "created_at": "2025-11-13T..."
  }
]
```

---

### 3. **Buscar Produto do Mercado Livre**
```http
GET /api/ml-item?id=MLB1234567890
```

**Resposta:**
```json
{
  "title": "Samsung Galaxy S24",
  "description": "Smartphone Samsung...",
  "price": 3499.00,
  "available_quantity": 50,
  "pictures": [...],
  "category": "Celulares e Smartphones",
  "brand": "Samsung",
  "model": "Galaxy S24",
  "color": "Preto"
}
```

---

### 4. **Buscar Produto da Shopee**
```http
GET /api/shopee?url=https://shopee.com.br/produto-i.123456.789012
```

**Resposta:**
```json
{
  "nome": "Fone Bluetooth",
  "preco": 89.90,
  "descricao": "Fone sem fio...",
  "imagens": ["https://..."],
  "estoque": 100,
  "link_original": "https://shopee.com.br/..."
}
```

---

## 🔧 APIs Administrativas

### 5. **Configurar Banco de Dados**
```http
POST /api/admin/setup-database
```

Cria todas as tabelas e políticas de segurança necessárias.

**Resposta:**
```json
{
  "message": "Banco de dados configurado com sucesso!"
}
```

---

### 6. **Testar Conexões**

#### Testar Supabase
```http
POST /api/admin/test-supabase
```

#### Testar Gemini
```http
POST /api/admin/test-gemini
```

#### Testar Mercado Pago
```http
POST /api/admin/test-mercadopago
```

#### Testar Mercado Livre
```http
POST /api/admin/test-mercadolivre
```

---

### 7. **Criar Cliente e Analisar Crédito**
```http
POST /api/admin/create-and-analyze-customer
Content-Type: application/json

{
  "email": "cliente@exemplo.com",
  "password": "senha123",
  "first_name": "João",
  "last_name": "Silva"
}
```

**Resposta:**
```json
{
  "message": "Cliente criado e analisado com sucesso!",
  "profile": {
    "id": "uuid",
    "email": "cliente@exemplo.com",
    "first_name": "João",
    "credit_score": 750,
    "credit_limit": 500.00,
    "credit_status": "Bom"
  }
}
```

---

### 8. **Criar Venda Parcelada**
```http
POST /api/admin/create-sale
Content-Type: application/json

{
  "userId": "uuid-do-cliente",
  "totalAmount": 1200.00,
  "installments": 12,
  "productName": "iPhone 15"
}
```

Cria 12 faturas mensais de R$ 100,00 cada.

---

### 9. **Listar Perfis de Usuários**
```http
GET /api/admin/profiles
```

---

### 10. **Criar Produto**
```http
POST /api/admin/products
Content-Type: application/json

{
  "name": "Galaxy S24",
  "description": "Smartphone Samsung",
  "price": 3499.00,
  "stock": 10,
  "image_base64": "data:image/png;base64,iVBORw0KGgo..."
}
```

---

### 11. **Ver Logs de Ações**
```http
GET /api/admin/get-logs
```

Retorna os últimos 50 logs do sistema.

---

## 💳 APIs de Pagamento (Mercado Pago)

### 12. **Criar Pagamento PIX**
```http
POST /api/mercadopago/create-pix-payment
Content-Type: application/json

{
  "amount": 150.00,
  "description": "Fatura Janeiro 2025",
  "payerEmail": "cliente@exemplo.com",
  "invoiceId": "uuid-da-fatura",
  "userId": "uuid-do-usuario",
  "firstName": "João",
  "lastName": "Silva",
  "identificationNumber": "12345678900"
}
```

**Resposta:**
```json
{
  "paymentId": 123456789,
  "qrCode": "00020126...",
  "qrCodeBase64": "iVBORw0KGgoAAAANS...",
  "expires": "2025-11-13T23:30:00Z"
}
```

---

### 13. **Criar Boleto Bancário**
```http
POST /api/mercadopago/create-boleto-payment
Content-Type: application/json

{
  "amount": 150.00,
  "description": "Fatura Janeiro 2025",
  "invoiceId": "uuid-da-fatura",
  "payer": {
    "email": "cliente@exemplo.com",
    "firstName": "João",
    "lastName": "Silva",
    "identificationType": "CPF",
    "identificationNumber": "12345678900",
    "zipCode": "12345-678",
    "streetName": "Rua Exemplo",
    "streetNumber": "123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "federalUnit": "SP"
  }
}
```

**Resposta:**
```json
{
  "message": "Boleto gerado e salvo com sucesso!",
  "paymentId": 123456789,
  "boletoUrl": "https://www.mercadopago.com.br/...",
  "boletoBarcode": "34191.79001 01043..."
}
```

---

### 14. **Webhook de Pagamento**
```http
POST /api/mercadopago/webhook
```

Esta API recebe notificações automáticas do Mercado Pago quando um pagamento é aprovado, cancelado ou expira.

---

### 15. **Gerar Mensagem de Confirmação com IA**
```http
POST /api/mercadopago/generate-message
Content-Type: application/json

{
  "customerName": "João Silva",
  "amount": 150.00
}
```

**Resposta:**
```json
{
  "message": "Olá João Silva! Recebemos seu pagamento de R$ 150,00. Agradecemos pela sua pontualidade e por escolher a Relp Cell!"
}
```

---

## 🔐 Webhook de Autenticação

### 16. **Criar Perfil Automaticamente ao Registrar**
```http
POST /api/mercadopago/auth-hook
```

Este webhook é chamado automaticamente pelo Supabase Auth quando um novo usuário se registra.

---

## 📝 Exemplos de Uso com JavaScript

### Exemplo 1: Buscar Produtos
```javascript
async function buscarProdutos() {
  const response = await fetch('http://localhost:3000/api/products');
  const produtos = await response.json();
  console.log(produtos);
}
```

### Exemplo 2: Criar Pagamento PIX
```javascript
async function criarPix(dadosFatura) {
  const response = await fetch('http://localhost:3000/api/mercadopago/create-pix-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: dadosFatura.valor,
      description: dadosFatura.descricao,
      payerEmail: dadosFatura.email,
      invoiceId: dadosFatura.id,
      userId: dadosFatura.userId,
      firstName: dadosFatura.nome,
      lastName: dadosFatura.sobrenome,
      identificationNumber: dadosFatura.cpf
    })
  });
  
  const resultado = await response.json();
  console.log('QR Code PIX:', resultado.qrCode);
}
```

### Exemplo 3: Buscar Produto do ML
```javascript
async function buscarProdutoML(mlId) {
  const response = await fetch(`http://localhost:3000/api/ml-item?id=${mlId}`);
  const produto = await response.json();
  console.log(produto);
}
```

---

## ⚠️ Observações Importantes

1. **Servidor deve estar rodando**: Execute `npm run dev` para iniciar o servidor
2. **Variáveis de ambiente**: Configure todas as chaves de API necessárias
3. **Banco de dados**: Execute `/api/admin/setup-database` antes de usar
4. **Webhooks**: Configure as URLs de webhook no painel do Mercado Pago
5. **CORS**: O servidor está configurado para aceitar requisições de qualquer origem

---

## 🚀 Como Começar

1. Configure as variáveis de ambiente
2. Execute `npm install` e `npm run dev`
3. Acesse `http://localhost:3000/api/config` para verificar se está funcionando
4. Execute `/api/admin/setup-database` para criar as tabelas
5. Teste as APIs com os exemplos acima

---

## 📞 Suporte

Se encontrar problemas, use a API de diagnóstico:

```http
POST /api/admin/diagnose-error
Content-Type: application/json

{
  "errorMessage": "Sua mensagem de erro aqui"
}
```

A IA do Gemini analisará o erro e fornecerá uma solução em português.
