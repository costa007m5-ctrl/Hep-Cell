# 💳 Relp Cell - Sistema de Pagamentos

Sistema completo de gerenciamento de faturas e pagamentos com integração Mercado Pago, desenvolvido com React, TypeScript, Supabase e Vercel.

## ✨ Funcionalidades

### Métodos de Pagamento
- **PIX** - Pagamento instantâneo com QR Code
- **Boleto Bancário** - Geração automática de boleto
- **Cartão de Crédito** - Parcelamento em até 3x via Mercado Pago Brick

### Recursos
- 🔐 Autenticação segura com Supabase
- 📱 Interface responsiva e moderna
- 🎨 Dark mode
- 📊 Histórico de pagamentos
- 🤖 Mensagens personalizadas com Gemini AI
- 🔔 Notificações via webhook
- 📈 Análise de crédito automática

## 🚀 Tecnologias

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Backend:** Vercel Serverless Functions
- **Database:** Supabase (PostgreSQL)
- **Pagamentos:** Mercado Pago SDK
- **IA:** Google Gemini AI
- **Build:** Vite

## 📋 Pré-requisitos

- Node.js 18+ 
- Conta no [Supabase](https://supabase.com)
- Conta no [Mercado Pago](https://www.mercadopago.com.br)
- Chave API do [Google Gemini](https://ai.google.dev)
- Conta no [Vercel](https://vercel.com) (para deploy)

## 🛠️ Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/costa007m5-ctrl/Hep-Cell.git
cd Hep-Cell
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:
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

### 4. Configure o banco de dados

Execute os scripts SQL no Supabase (veja [API_SETUP.md](API_SETUP.md) para detalhes):

```sql
-- Criar tabelas necessárias
CREATE TABLE profiles (...);
CREATE TABLE invoices (...);
CREATE TABLE action_logs (...);
```

### 5. Execute o projeto

**Desenvolvimento (apenas frontend):**
```bash
npm run dev
```

**Desenvolvimento com APIs (recomendado):**
```bash
vercel dev
```

O aplicativo estará disponível em `http://localhost:3000`

## 📦 Deploy

### Deploy no Vercel

1. Instale a CLI do Vercel:
```bash
npm install -g vercel
```

2. Faça login:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Configure as variáveis de ambiente no painel do Vercel:
   - Vá em **Settings** → **Environment Variables**
   - Adicione todas as variáveis do arquivo `.env.example`

5. Configure o webhook do Mercado Pago:
   - URL: `https://seu-dominio.vercel.app/api/mercadopago/webhook`
   - Eventos: Pagamentos e Merchant Orders

## 📚 Documentação

- [API_SETUP.md](API_SETUP.md) - Configuração completa das APIs
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Guia de testes
- [.env.example](.env.example) - Exemplo de variáveis de ambiente

## 🏗️ Estrutura do Projeto

```
Hep-Cell/
├── api/                      # Serverless Functions
│   ├── config.ts            # Endpoint de configuração
│   ├── mercadopago.ts       # APIs de pagamento
│   └── admin.ts             # APIs administrativas
├── components/              # Componentes React
│   ├── PaymentForm.tsx     # Formulário de pagamento
│   ├── PageFaturas.tsx     # Página de faturas
│   └── ...
├── services/               # Serviços e clientes
│   ├── clients.ts         # Clientes Supabase e Gemini
│   └── geminiService.ts   # Serviço Gemini AI
├── types.ts               # Definições TypeScript
├── App.tsx               # Componente principal
└── index.tsx            # Entry point

```

## 🔑 Endpoints da API

### Públicos
- `GET /api/config` - Configurações públicas

### Pagamentos
- `POST /api/mercadopago/create-pix-payment` - Gerar PIX
- `POST /api/mercadopago/create-boleto-payment` - Gerar Boleto
- `POST /api/mercadopago/create-preference` - Criar preferência (cartão)
- `POST /api/mercadopago/webhook` - Webhook de notificações

### Administrativos
- `POST /api/admin/setup-database` - Configurar banco de dados
- `POST /api/admin/create-invoice` - Criar fatura
- `POST /api/admin/analyze-credit` - Análise de crédito

Veja [API_SETUP.md](API_SETUP.md) para documentação completa.

## 🧪 Testes

### Teste local com Vercel Dev
```bash
vercel dev
```

### Teste de endpoint
```bash
curl http://localhost:3000/api/config
```

Veja [TESTING_GUIDE.md](TESTING_GUIDE.md) para guia completo de testes.

## 🔒 Segurança

- ✅ Chaves privadas apenas no servidor
- ✅ Row Level Security (RLS) no Supabase
- ✅ Validação de dados em todos os endpoints
- ✅ CORS configurado adequadamente
- ✅ Logs de auditoria
- ✅ Webhook com validação de origem

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

- 📧 Email: suporte@relpcell.com
- 🐛 Issues: [GitHub Issues](https://github.com/costa007m5-ctrl/Hep-Cell/issues)
- 📖 Docs: [API_SETUP.md](API_SETUP.md)

## 🙏 Agradecimentos

- [Mercado Pago](https://www.mercadopago.com.br) - Plataforma de pagamentos
- [Supabase](https://supabase.com) - Backend as a Service
- [Vercel](https://vercel.com) - Hospedagem e Serverless
- [Google Gemini](https://ai.google.dev) - IA Generativa

---

Desenvolvido com ❤️ por [Costa007m5](https://github.com/costa007m5-ctrl)
