#!/bin/bash

# Script de teste para geração de boleto
# Execute: bash test-boleto.sh

echo "🧪 Testando geração de boleto..."
echo ""

# Configuração
API_URL="${1:-http://localhost:3000}"
INVOICE_ID="${2:-test-invoice-$(date +%s)}"

echo "📍 URL da API: $API_URL"
echo "📄 Invoice ID: $INVOICE_ID"
echo ""

# Dados de teste
REQUEST_BODY='{
  "amount": 10.00,
  "description": "Teste Boleto - Script Automático",
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
  "invoiceId": "'$INVOICE_ID'"
}'

echo "📤 Enviando requisição..."
echo ""

# Fazer requisição
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/mercadopago/create-boleto-payment" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

# Separar corpo e status code
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo "📥 Status HTTP: $HTTP_CODE"
echo ""

# Verificar resultado
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCESSO! Boleto gerado com sucesso!"
  echo ""
  echo "📋 Resposta:"
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  echo ""
  
  # Extrair dados
  BOLETO_URL=$(echo "$HTTP_BODY" | jq -r '.boletoUrl' 2>/dev/null)
  BARCODE=$(echo "$HTTP_BODY" | jq -r '.boletoBarcode' 2>/dev/null)
  
  if [ "$BOLETO_URL" != "null" ] && [ "$BOLETO_URL" != "" ]; then
    echo "🔗 URL do Boleto: $BOLETO_URL"
  fi
  
  if [ "$BARCODE" != "null" ] && [ "$BARCODE" != "" ]; then
    echo "📊 Código de Barras: $BARCODE"
  fi
else
  echo "❌ ERRO! Falha ao gerar boleto"
  echo ""
  echo "📋 Resposta de erro:"
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  echo ""
  
  # Tentar extrair mensagem de erro
  ERROR_MSG=$(echo "$HTTP_BODY" | jq -r '.message' 2>/dev/null)
  if [ "$ERROR_MSG" != "null" ] && [ "$ERROR_MSG" != "" ]; then
    echo "💬 Mensagem: $ERROR_MSG"
  fi
  
  # Verificar campos faltando
  MISSING=$(echo "$HTTP_BODY" | jq -r '.missingFields[]' 2>/dev/null)
  if [ "$MISSING" != "" ]; then
    echo "⚠️  Campos faltando:"
    echo "$MISSING" | while read field; do
      echo "   - $field"
    done
  fi
fi

echo ""
echo "🏁 Teste concluído!"
