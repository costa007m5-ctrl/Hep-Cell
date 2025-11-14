# 🔑 SOLUÇÃO: Adicionar Public Key do Mercado Pago

## ❌ Problema Identificado

**Sintoma:**
- ✅ PIX funciona
- ❌ Boleto não funciona
- ❌ Cartão provavelmente não funciona

**Causa:**
Você tem o **Access Token** configurado, mas está faltando a **Public Key**.

## 🔍 Por Que Isso Acontece?

### Access Token (Backend) ✅
```
Você tem: MERCADO_PAGO_ACCESS_TOKEN
Usado em: /api/mercadopago/* (backend)
Serve para: Criar pagamentos, processar transações
```

**PIX funciona porque:**
- Usa apenas o backend
- Não precisa de Public Key
- Access Token é suficiente

### Public Key (Frontend) ❌
```
Você NÃO tem: NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
Usado em: Frontend (React)
Serve para: Inicializar SDK, Mercado Pago Brick
```

**Boleto/Cartão não funcionam porque:**
- Precisam inicializar o SDK no frontend
- SDK precisa da Public Key
- Sem ela, o SDK não funciona

## ✅ SOLUÇÃO EM 3 PASSOS

### 📍 PASSO 1: Obter a Public Key

1. Acesse [developers.mercadopago.com](https://developers.mercadopago.com)
2. Faça login na sua conta
3. Vá em **Suas integrações** → **Credenciais**
4. Escolha o ambiente:
   - **Teste** (para desenvolvimento)
   - **Produção** (para uso real)

5. Você verá duas chaves:
   ```
   Access Token:  APP_USR-1234567890123456-123456-abcdef...
   Public Key:    APP_USR-abcd1234-1234-1234-1234-abcdef123456
   ```

6. **Copie a Public Key** (a segunda)

### 📍 PASSO 2: Adicionar no Vercel

#### Opção A: Via Dashboard (Recomendado)

1. Acesse [vercel.com](https://vercel.com)
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Clique em **Add New**
5. Preencha:
   ```
   Name:  NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
   Value: APP_USR-abcd1234-1234-1234-1234-abcdef123456
   ```
6. Selecione todos os ambientes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
7. Clique em **Save**

#### Opção B: Via CLI

```bash
# Adicionar variável
vercel env add NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY

# Quando perguntar, cole a Public Key
# Selecione todos os ambientes (Production, Preview, Development)
```

### 📍 PASSO 3: Fazer Redeploy

Após adicionar a variável, você precisa fazer um novo deploy:

```bash
# Via CLI
vercel --prod

# Ou via Dashboard
# Vá em Deployments → Redeploy
```

## 🧪 Verificar se Funcionou

### Teste 1: Ver Variáveis Configuradas

```bash
vercel env ls
```

**Resultado esperado:**
```
MERCADO_PAGO_ACCESS_TOKEN                    Production, Preview, Development
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY          Production, Preview, Development
NEXT_PUBLIC_SUPABASE_URL                     Production, Preview, Development
NEXT_PUBLIC_SUPABASE_ANON_KEY                Production, Preview, Development
SUPABASE_SERVICE_ROLE_KEY                    Production, Preview, Development
API_KEY                                      Production, Preview, Development
```

### Teste 2: Verificar no Frontend

1. Acesse seu aplicativo
2. Abra DevTools (F12)
3. Vá na aba **Console**
4. Digite:
   ```javascript
   console.log(window.location.origin);
   ```
5. Depois acesse: `https://seu-dominio.vercel.app/api/config`
6. Deve retornar:
   ```json
   {
     "supabaseUrl": "https://...",
     "supabaseAnonKey": "...",
     "mercadoPagoPublicKey": "APP_USR-abcd1234...",
     "geminiApiKey": "..."
   }
   ```

### Teste 3: Gerar Boleto

1. Acesse o aplicativo
2. Vá em **Faturas**
3. Clique em **Pagar**
4. Escolha **Boleto**
5. Preencha os dados
6. Clique em **Continuar**

**Resultado esperado:**
- ✅ Boleto gerado com sucesso
- ✅ Código de barras exibido
- ✅ Link para visualizar

### Teste 4: Testar Cartão

1. Escolha **Cartão de Crédito**
2. O formulário do Mercado Pago Brick deve aparecer
3. Preencha os dados do cartão
4. Deve processar normalmente

## 🔍 Entendendo as Chaves

### Access Token (Privada) 🔒

```
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-1234567890123456-123456-abcdef...
```

**Características:**
- 🔒 **PRIVADA** - Nunca expor no frontend
- 🖥️ Usada apenas no **backend**
- 💳 Permite criar e processar pagamentos
- 🔐 Tem acesso total à conta

**Onde é usada:**
```typescript
// Backend: api/mercadopago.ts
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN 
});
```

### Public Key (Pública) 🌐

```
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=APP_USR-abcd1234-1234-1234-1234-abcdef123456
```

**Características:**
- 🌐 **PÚBLICA** - Pode ser exposta no frontend
- 📱 Usada no **frontend**
- 🎨 Inicializa SDK e componentes visuais
- 🔓 Acesso limitado (apenas leitura)

**Onde é usada:**
```typescript
// Frontend: components/PaymentForm.tsx
const mp = new window.MercadoPago(mpPublicKey, {
  locale: 'pt-BR',
});
```

## 📊 Fluxo Completo

### Antes (Sem Public Key) ❌

```
Frontend → Tenta inicializar SDK → ❌ Sem Public Key → Falha
Backend  → Cria pagamento         → ✅ Com Access Token → Sucesso
```

**Resultado:**
- ✅ PIX funciona (só usa backend)
- ❌ Boleto falha (precisa SDK no frontend)
- ❌ Cartão falha (precisa Brick no frontend)

### Depois (Com Public Key) ✅

```
Frontend → Inicializa SDK → ✅ Com Public Key → Sucesso
Backend  → Cria pagamento → ✅ Com Access Token → Sucesso
```

**Resultado:**
- ✅ PIX funciona
- ✅ Boleto funciona
- ✅ Cartão funciona

## 🔐 Segurança

### ✅ Boas Práticas

**Access Token:**
- ✅ Apenas no backend
- ✅ Nunca no código frontend
- ✅ Nunca no Git
- ✅ Apenas em variáveis de ambiente

**Public Key:**
- ✅ Pode estar no frontend
- ✅ Prefixo `NEXT_PUBLIC_` permite exposição
- ✅ Acesso limitado (seguro)

### ❌ Nunca Faça Isso

```typescript
// ❌ ERRADO - Nunca exponha Access Token
const accessToken = "APP_USR-1234567890123456...";

// ✅ CERTO - Public Key pode ser exposta
const publicKey = "APP_USR-abcd1234-1234-1234...";
```

## 🆘 Problemas Comuns

### Erro: "Invalid public key"

**Causa:** Public Key incorreta ou de ambiente errado

**Solução:**
1. Verifique se copiou a chave correta
2. Confirme que está usando o mesmo ambiente (Teste ou Produção)
3. Access Token e Public Key devem ser do mesmo ambiente

### Erro: "Public key not found"

**Causa:** Variável não configurada ou nome errado

**Solução:**
1. Verifique o nome: `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
2. Confirme que fez redeploy após adicionar
3. Verifique com `vercel env ls`

### Boleto ainda não funciona

**Causa:** Cache ou deploy antigo

**Solução:**
1. Limpe cache do navegador (Ctrl + Shift + Delete)
2. Faça hard refresh (Ctrl + F5)
3. Faça novo deploy: `vercel --prod`
4. Aguarde alguns minutos

### Cartão não aparece

**Causa:** Brick não consegue inicializar

**Solução:**
1. Verifique console do navegador (F12)
2. Procure por erros do Mercado Pago
3. Confirme que Public Key está correta
4. Teste em modo anônimo

## 📋 Checklist Final

Após adicionar a Public Key:

- [ ] Public Key obtida do Mercado Pago
- [ ] Variável adicionada no Vercel
- [ ] Nome correto: `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
- [ ] Todos os ambientes selecionados
- [ ] Redeploy realizado
- [ ] Cache do navegador limpo
- [ ] Teste de boleto realizado
- [ ] Teste de cartão realizado
- [ ] Ambos funcionando

## 🎯 Resumo

### O Problema
```
❌ Faltando: NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
✅ Tem:      MERCADO_PAGO_ACCESS_TOKEN
```

### A Solução
```
1. Obter Public Key no Mercado Pago
2. Adicionar no Vercel como NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
3. Fazer redeploy
4. Testar boleto e cartão
```

### O Resultado
```
✅ PIX funciona
✅ Boleto funciona
✅ Cartão funciona
```

## 📞 Precisa de Ajuda?

Se após seguir todos os passos ainda não funcionar:

1. **Verifique os logs:**
   ```bash
   vercel logs --follow
   ```

2. **Teste a API de config:**
   ```bash
   curl https://seu-dominio.vercel.app/api/config
   ```

3. **Veja o console do navegador:**
   - F12 → Console
   - Procure por erros do Mercado Pago

4. **Confirme as credenciais:**
   - Access Token e Public Key do mesmo ambiente
   - Ambas de Produção ou ambas de Teste

---

**Tempo estimado:** 5 minutos  
**Dificuldade:** Fácil  
**Resultado:** Boleto e Cartão funcionando! 🎉
