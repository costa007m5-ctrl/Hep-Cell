# 🛠️ Comandos Úteis

## 📦 Instalação e Setup

```bash
# Instalar dependências
npm install

# Copiar arquivo de exemplo de variáveis
cp .env.example .env

# Instalar Vercel CLI globalmente
npm install -g vercel
```

## 🚀 Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento (apenas frontend)
npm run dev

# Iniciar com Vercel Dev (frontend + APIs)
vercel dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

## 🌐 Deploy

```bash
# Login no Vercel
vercel login

# Deploy em ambiente de preview
vercel

# Deploy em produção
vercel --prod

# Ver logs do último deploy
vercel logs

# Listar deployments
vercel ls
```

## 🔐 Variáveis de Ambiente

```bash
# Adicionar variável de ambiente
vercel env add NOME_DA_VARIAVEL

# Listar variáveis configuradas
vercel env ls

# Remover variável
vercel env rm NOME_DA_VARIAVEL

# Baixar variáveis para .env.local
vercel env pull
```

## 🧪 Testes de API

### Teste de Configuração
```bash
curl http://localhost:3000/api/config
```

### Teste de PIX
```bash
curl -X POST http://localhost:3000/api/mercadopago/create-pix-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "description": "Teste PIX",
    "payerEmail": "teste@email.com",
    "userId": "user-id",
    "firstName": "João",
    "lastName": "Silva",
    "identificationNumber": "12345678900",
    "invoiceId": "invoice-id"
  }'
```

### Teste de Boleto
```bash
curl -X POST http://localhost:3000/api/mercadopago/create-boleto-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "description": "Teste Boleto",
    "payer": {
      "email": "teste@email.com",
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
    "invoiceId": "invoice-id"
  }'
```

### Teste de Preferência (Cartão)
```bash
curl -X POST http://localhost:3000/api/mercadopago/create-preference \
  -H "Content-Type: application/json" \
  -d '{
    "id": "invoice-id",
    "description": "Teste Cartão",
    "amount": 150.00,
    "payerEmail": "teste@email.com",
    "redirect": true
  }'
```

### Teste de Webhook
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

## 🗄️ Banco de Dados (Supabase)

### Criar Usuário de Teste
```sql
-- No Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password)
VALUES ('teste@email.com', crypt('senha123', gen_salt('bf')));
```

### Criar Fatura de Teste
```sql
INSERT INTO invoices (user_id, month, due_date, amount, status)
VALUES (
  'uuid-do-usuario',
  'Janeiro/2024',
  '2024-01-31',
  100.00,
  'Em aberto'
);
```

### Ver Faturas
```sql
SELECT * FROM invoices ORDER BY created_at DESC LIMIT 10;
```

### Ver Logs
```sql
SELECT * FROM action_logs ORDER BY created_at DESC LIMIT 20;
```

### Limpar Dados de Teste
```sql
-- CUIDADO: Isso apaga todos os dados!
DELETE FROM invoices WHERE status = 'Em aberto';
DELETE FROM action_logs;
```

## 🔍 Debug

```bash
# Ver logs do Vercel em tempo real
vercel logs --follow

# Ver logs de uma função específica
vercel logs api/mercadopago.ts

# Inspecionar build
vercel inspect

# Ver informações do projeto
vercel project ls
```

## 🧹 Limpeza

```bash
# Limpar cache do npm
npm cache clean --force

# Remover node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install

# Limpar build do Vite
rm -rf dist

# Limpar cache do Vercel
vercel rm --yes
```

## 📊 Monitoramento

```bash
# Ver status do projeto
vercel status

# Ver uso de recursos
vercel usage

# Ver domínios configurados
vercel domains ls

# Ver certificados SSL
vercel certs ls
```

## 🔄 Git

```bash
# Status
git status

# Adicionar arquivos
git add .

# Commit
git commit -m "feat: implementar pagamento via PIX"

# Push
git push origin main

# Ver histórico
git log --oneline -10

# Criar branch
git checkout -b feature/nova-funcionalidade

# Voltar para main
git checkout main
```

## 🎨 Formatação e Lint

```bash
# Verificar tipos TypeScript
npx tsc --noEmit

# Formatar código (se configurado)
npm run format

# Lint (se configurado)
npm run lint
```

## 📱 PWA

```bash
# Testar service worker
# Abra DevTools > Application > Service Workers

# Limpar cache do service worker
# DevTools > Application > Clear storage
```

## 🔐 Segurança

```bash
# Verificar vulnerabilidades
npm audit

# Corrigir vulnerabilidades automáticas
npm audit fix

# Atualizar dependências
npm update

# Ver dependências desatualizadas
npm outdated
```

## 📦 Build e Otimização

```bash
# Build com análise de bundle
npm run build -- --mode production

# Analisar tamanho do bundle
npx vite-bundle-visualizer

# Otimizar imagens (se tiver)
npx imagemin src/assets/* --out-dir=dist/assets
```

## 🌍 Domínio Customizado

```bash
# Adicionar domínio
vercel domains add seudominio.com

# Verificar DNS
vercel domains inspect seudominio.com

# Remover domínio
vercel domains rm seudominio.com
```

## 🔔 Webhooks

```bash
# Testar webhook localmente com ngrok
ngrok http 3000

# Usar URL do ngrok no Mercado Pago:
# https://abc123.ngrok.io/api/mercadopago/webhook
```

## 📈 Performance

```bash
# Lighthouse CI
npm install -g @lhci/cli
lhci autorun --upload.target=temporary-public-storage

# Análise de performance
npx lighthouse https://seu-dominio.vercel.app --view
```

## 🎯 Atalhos Úteis

```bash
# Alias úteis (adicione ao ~/.bashrc ou ~/.zshrc)
alias vd="vercel dev"
alias vp="vercel --prod"
alias vl="vercel logs --follow"
alias nd="npm run dev"
alias nb="npm run build"

# Recarregar aliases
source ~/.bashrc  # ou source ~/.zshrc
```

## 🆘 Troubleshooting

```bash
# Porta em uso
lsof -ti:3000 | xargs kill -9

# Limpar tudo e recomeçar
rm -rf node_modules .vercel dist
npm install
vercel dev

# Verificar versão do Node
node --version  # Deve ser 18+

# Verificar versão do npm
npm --version

# Reinstalar Vercel CLI
npm uninstall -g vercel
npm install -g vercel
```

## 📚 Documentação Rápida

```bash
# Abrir docs do Vercel
vercel help

# Ajuda de comando específico
vercel env --help

# Abrir dashboard do Vercel
vercel open

# Abrir projeto no GitHub
git remote -v
```

## 🎓 Recursos

```bash
# Gerar documentação de API (se configurado)
npm run docs

# Executar testes (se configurado)
npm test

# Coverage de testes
npm run test:coverage
```

---

**Dica:** Salve este arquivo como referência rápida! 📌
