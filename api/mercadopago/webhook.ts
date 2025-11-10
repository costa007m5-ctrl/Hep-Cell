import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inicializa os clientes fora do handler para reutilização
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN!;
const mpClient = new MercadoPagoConfig({ accessToken });
const payment = new Payment(mpClient);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { body } = req;
        console.log('Webhook recebido:', JSON.stringify(body, null, 2));

        // Verifica se é uma notificação de pagamento
        if (body.type === 'payment' && body.data?.id) {
            const paymentId = body.data.id;

            // Busca os detalhes do pagamento no Mercado Pago para confirmar o status
            const paymentDetails = await payment.get({ id: paymentId });
            console.log('Detalhes do pagamento obtidos do MP:', JSON.stringify(paymentDetails, null, 2));

            if (!paymentDetails || !paymentDetails.id) {
                console.warn(`Payment ID ${paymentId} não encontrado no Mercado Pago.`);
                return res.status(200).send('OK. Pagamento não encontrado no MP.');
            }

            // Mapeia o status do Mercado Pago para o status da nossa fatura
            let newStatus: 'Paga' | 'Expirado' | 'Cancelado' | null = null;
            switch(paymentDetails.status) {
                case 'approved':
                    newStatus = 'Paga';
                    break;
                case 'cancelled':
                    newStatus = paymentDetails.status_detail === 'expired' ? 'Expirado' : 'Cancelado';
                    break;
                // Outros status como 'pending', 'in_process', 'rejected' não alteram o estado 'Boleto Gerado' por enquanto.
                // Poderíamos adicionar mais lógica aqui se necessário.
            }
            
            if (newStatus) {
                const { data, error } = await supabase
                    .from('invoices')
                    .update({ 
                        status: newStatus,
                        payment_date: newStatus === 'Paga' ? new Date().toISOString() : null
                    })
                    .eq('payment_id', String(paymentId))
                    .select();

                if (error) {
                    console.error(`Erro ao atualizar fatura para payment_id ${paymentId}:`, error);
                    // Retorna 500 para que o Mercado Pago tente reenviar o webhook
                    return res.status(500).json({ error: 'Falha ao atualizar o banco de dados.' });
                }
                
                console.log(`Fatura com payment_id ${paymentId} atualizada para ${newStatus}. Rows afetadas:`, data?.length);
            }
        }
        
        // Responde 200 OK para o Mercado Pago confirmar o recebimento
        res.status(200).send('OK');

    } catch (error: any) {
        console.error('Erro no processamento do webhook:', error);
        res.status(500).json({
            error: 'Erro interno no webhook.',
            message: error.message
        });
    }
}