# 🚀 PASSO A PASSO: Adicionar Public Key

## 🎯 Problema

- ✅ PIX funciona
- ❌ Boleto não funciona  
- ❌ Cartão não funciona

**Causa:** Falta a Public Key do Mercado Pago no Vercel

---

## ✅ SOLUÇÃO RÁPIDA (5 minutos)

### 1️⃣ Obter a Public Key

1. Abra: [developers.mercadopago.com](https://developers.mercadopago.com)
2. Faça login
3. Clique em **Suas integrações**
4. Clique em **Credenciais**
5. Escolha o ambiente:
   - **Teste** (para testar)
   - **Produção** (para usar de verdade)

6. Você verá duas chaves:

```
┌─────────────────────────────────────────────────────────┐
│ Access Token (Privada)                                  │
│ APP_USR-1234567890123456-123456-abcdef1234567890...     │
│ ✅ Você já tem essa configurada                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Public Key (Pública)                                    │
│ APP_USR-abcd1234-1234-1234-1234-abcdef123456           │
│ ❌ Essa está faltando - COPIE ESSA!                     │
└─────────────────────────────────────────────────────────┘
```

7. **Copie a Public Key** (a segunda)

---

### 2️⃣ Adicionar no Vercel

1. Abra: [vercel.com](https://vercel.com)
2. Selecione seu projeto
3. Clique em **Settings** (no topo)
4. No menu lateral, clique em **Environment Variables**
5. Clique no botão **Add New**

6. Preencha:

```
┌─────────────────────────────────────────────────────────┐
│ Name (Nome da variável)                                 │
│ NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY                     │
│                                                         │
│ Value (Cole a Public Key aqui)                          │
│ APP_USR-abcd1234-1234-1234-1234-abcdef123456           │
│                                                         │
│ Environments (Selecione TODOS)                          │
│ ✅ Production                                           │
│ ✅ Preview                                              │
│ ✅ Development                                          │
└─────────────────────────────────────────────────────────┘
```

7. Clique em **Save**

---

### 3️⃣ Fazer Redeploy

**Opção A: Via Dashboard**
1. Vá em **Deployments** (no topo)
2. Clique nos 3 pontinhos do último deployment
3. Clique em **Redeploy**
4. Aguarde o deploy terminar (1-2 minutos)

**Opção B: Via Terminal**
```bash
vercel --prod
```

---

### 4️⃣ Testar

1. Acesse seu aplicativo
2. Vá em **Faturas**
3. Clique em **Pagar**
4. Escolha **Boleto**
5. Preencha os dados
6. Clique em **Continuar**

**Resultado esperado:**
```
✅ Boleto Gerado com Sucesso!
ID do Pagamento: 123456789

Código de barras: 34191.79001...
[Copiar]

[📄 Visualizar Boleto]
[🏦 Abrir Mercado Pago]
```

---

## 🔍 Verificar se Está Configurado

### Método 1: Via CLI

```bash
vercel env ls
```

**Deve aparecer:**
```
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY    Production, Preview, Development
MERCADO_PAGO_ACCESS_TOKEN              Production, Preview, Development
```

### Método 2: Via API

Acesse no navegador:
```
https://seu-dominio.vercel.app/api/config
```

**Deve retornar:**
```json
{
  "supabaseUrl": "https://...",
  "supabaseAnonKey": "...",
  "mercadoPagoPublicKey": "APP_USR-abcd1234...",
  "geminiApiKey": "..."
}
```

Se `mercadoPagoPublicKey` estiver vazio ou null, a variável não foi configurada.

---

## ❓ Perguntas Frequentes

### Qual ambiente devo usar?

**Teste:**
- Use para desenvolvimento
- Pagamentos não são reais
- Não cobra de verdade

**Produção:**
- Use para aplicativo real
- Pagamentos são reais
- Cobra de verdade

⚠️ **IMPORTANTE:** Access Token e Public Key devem ser do **MESMO AMBIENTE**!

### Posso usar Public Key de Teste e Access Token de Produção?

❌ **NÃO!** Ambas devem ser do mesmo ambiente:
- Teste + Teste ✅
- Produção + Produção ✅
- Teste + Produção ❌

### Como sei qual ambiente estou usando?

Veja o início da chave:
- `TEST-...` = Ambiente de Teste
- `APP_USR-...` = Pode ser qualquer um (veja no painel)

### Preciso reiniciar algo?

Não! Apenas fazer o redeploy no Vercel.

### Quanto tempo demora?

- Adicionar variável: 30 segundos
- Redeploy: 1-2 minutos
- **Total: ~3 minutos**

---

## 🆘 Problemas?

### Erro: "mercadoPagoPublicKey is null"

**Causa:** Variável não configurada ou nome errado

**Solução:**
1. Verifique o nome: `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
2. Confirme que salvou
3. Faça redeploy
4. Aguarde 2 minutos

### Boleto ainda não funciona

**Causa:** Cache ou deploy antigo

**Solução:**
1. Limpe cache: Ctrl + Shift + Delete
2. Hard refresh: Ctrl + F5
3. Teste em aba anônima
4. Aguarde mais alguns minutos

### Erro: "Invalid public key"

**Causa:** Chave incorreta ou de ambiente diferente

**Solução:**
1. Verifique se copiou a chave certa
2. Confirme que Access Token e Public Key são do mesmo ambiente
3. Tente gerar novas credenciais

---

## ✅ Checklist

- [ ] Public Key copiada do Mercado Pago
- [ ] Variável adicionada no Vercel
- [ ] Nome correto: `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
- [ ] Todos os ambientes selecionados
- [ ] Redeploy realizado
- [ ] Aguardado 2 minutos
- [ ] Cache limpo
- [ ] Boleto testado
- [ ] Funcionando!

---

## 📊 Resumo Visual

```
ANTES:
┌──────────────┐
│   Vercel     │
├──────────────┤
│ ✅ Access    │
│    Token     │
│              │
│ ❌ Public    │
│    Key       │
└──────────────┘
     ↓
❌ Boleto não funciona


DEPOIS:
┌──────────────┐
│   Vercel     │
├──────────────┤
│ ✅ Access    │
│    Token     │
│              │
│ ✅ Public    │
│    Key       │
└──────────────┘
     ↓
✅ Tudo funciona!
```

---

**Tempo total:** 5 minutos  
**Dificuldade:** Muito fácil  
**Resultado:** Boleto e Cartão funcionando! 🎉
