# 🔧 Correção: Erro ao Gerar Boleto

## ❌ Erro Atual

```
Falha ao gerar o boleto.
```

## 🔍 Possíveis Causas

1. **Credenciais do Mercado Pago inválidas ou expiradas**
2. **Dados do pagador incompletos**
3. **Formato de dados incorreto**
4. **Conta do Mercado Pago não configurada para boleto**
5. **Ambiente de teste vs produção**

## ✅ Soluções

### 1️⃣ Verificar Credenciais do Mercado Pago

#### No Vercel (Produção)
1. Acesse [vercel.com](https://vercel.com)
2. Vá em **Settings** → **Environment Variables**
3. Verifique se existe:
   - `MERCADO_PAGO_ACCESS_TOKEN`
   - `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`

#### Obter Novas Credenciais
1. Acesse [developers.mercadopago.com](https://developers.mercadopago.com)
2. Vá em **Suas integrações** → **Credenciais**
3. Escolha **Produção** (não Teste)
4. Copie:
   - **Access Token** → `MERCADO_PAGO_ACCESS_TOKEN`
   - **Public Key** → `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`

### 2️⃣ Verificar Configuração da Conta Mercado Pago

#### Requisitos para Boleto
- ✅ Conta verificada
- ✅ Dados bancários cadastrados
- ✅ Boleto habilitado nas configurações
- ✅ Usar credenciais de **PRODUÇÃO** (não teste)

#### Como Verificar
1. Acesse [mercadopago.com.br](https://www.mercadopago.com.br)
2. Vá em **Seu negócio** → **Configurações**
3. Verifique se **Boleto** está habilitado
4. Confirme que sua conta está verificada

### 3️⃣ Verificar Dados do Formulário

O boleto requer **TODOS** estes campos:

```javascript
{
  email: "cliente@email.com",
  firstName: "João",
  lastName: "Silva",
  identificationType: "CPF",
  identificationNumber: "12345678900",
  zipCode: "01310100",        // CEP
  streetName: "Avenida Paulista",
  streetNumber: "1000",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  federalUnit: "SP"           // Estado (2 letras)
}
```

### 4️⃣ Testar com Dados Válidos

Use estes dados de teste:

```
Nome: João
Sobrenome: Silva
CPF: 123.456.789-00
CEP: 01310-100
Rua: Avenida Paulista
Número: 1000
Bairro: Bela Vista
Cidade: São Paulo
Estado: SP
```

### 5️⃣ Verificar Logs de Erro

#### No Navegador
1. Abra o **DevTools** (F12)
2. Vá na aba **Console**
3. Tente gerar o boleto
4. Veja a mensagem de erro detalhada

#### No Vercel
1. Acesse [vercel.com](https://vercel.com)
2. Vá em **Deployments** → selecione o deployment
3. Clique em **Functions**
4. Procure por `api/mercadopago`
5. Veja os logs de erro

#### No Supabase
```sql
SELECT * FROM action_logs 
WHERE action_type = 'BOLETO_GENERATED' 
  AND status = 'FAILURE'
ORDER BY created_at DESC 
LIMIT 5;
```

## 🧪 Teste Passo a Passo

### 1. Teste de Credenciais

```bash
curl -X POST https://seu-dominio.vercel.app/api/mercadopago/create-boleto-payment \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
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
    "invoiceId": "uuid-da-fatura"
  }'
```

### 2. Verificar Resposta

**Sucesso:**
```json
{
  "message": "Boleto gerado e salvo com sucesso!",
  "paymentId": 123456789,
  "boletoUrl": "https://www.mercadopago.com.br/payments/...",
  "boletoBarcode": "34191.79001..."
}
```

**Erro:**
```json
{
  "error": "Falha ao gerar o boleto.",
  "message": "Descrição do erro",
  "details": {...}
}
```

## 🔄 Erros Comuns e Soluções

### Erro: "Dados incompletos"
**Causa:** Algum campo obrigatório está faltando  
**Solução:** Preencha todos os campos do formulário

### Erro: "Invalid credentials"
**Causa:** Access Token inválido ou expirado  
**Solução:** Gere novas credenciais no Mercado Pago

### Erro: "Payment method not available"
**Causa:** Boleto não habilitado na conta  
**Solução:** Habilite boleto nas configurações do Mercado Pago

### Erro: "Invalid address"
**Causa:** CEP ou endereço inválido  
**Solução:** Use um CEP válido (ex: 01310-100)

### Erro: "Invalid identification"
**Causa:** CPF inválido  
**Solução:** Use um CPF válido (apenas números)

## 📋 Checklist de Verificação

- [ ] Credenciais do Mercado Pago configuradas no Vercel
- [ ] Usando credenciais de **PRODUÇÃO** (não teste)
- [ ] Conta do Mercado Pago verificada
- [ ] Boleto habilitado nas configurações
- [ ] Todos os campos do formulário preenchidos
- [ ] CEP válido (8 dígitos)
- [ ] CPF válido (11 dígitos)
- [ ] Estado com 2 letras (ex: SP, RJ)
- [ ] Logs verificados (navegador e Vercel)

## 🆘 Se o Erro Persistir

### 1. Verificar Status da API do Mercado Pago
- Acesse [status.mercadopago.com](https://status.mercadopago.com)
- Verifique se há problemas reportados

### 2. Testar com Credenciais de Teste
```env
# Use credenciais de teste primeiro
MERCADO_PAGO_ACCESS_TOKEN=TEST-123456...
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=TEST-abcdef...
```

### 3. Contatar Suporte do Mercado Pago
- Email: developers@mercadopago.com
- Fórum: [forum.mercadopago.com](https://forum.mercadopago.com)

### 4. Verificar Documentação
- [Docs Boleto](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/card-payment-processing)
- [API Reference](https://www.mercadopago.com.br/developers/pt/reference)

## 💡 Dicas

1. **Sempre use credenciais de produção** para gerar boletos reais
2. **Teste com valores pequenos** primeiro (ex: R$ 1,00)
3. **Verifique os logs** antes de tentar novamente
4. **Use CEPs válidos** de endereços reais
5. **Mantenha as credenciais atualizadas**

## 🎯 Próximos Passos

Após corrigir:
1. Teste com um valor pequeno (R$ 1,00)
2. Verifique se o boleto foi gerado
3. Confirme que o link do boleto funciona
4. Teste o código de barras
5. Verifique se o webhook está funcionando

---

**Tempo estimado de correção:** 5-10 minutos  
**Dificuldade:** Média  
**Requer:** Acesso ao Mercado Pago e Vercel
