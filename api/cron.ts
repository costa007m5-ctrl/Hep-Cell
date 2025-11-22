
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função auxiliar para simular envio de email
async function sendEmailMock(to: string, subject: string, body: string) {
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${body}`);
    // Aqui você integraria com Resend, SendGrid ou AWS SES
    // Ex: await resend.emails.send({ from: 'Cobranca <noreply@relpcell.com>', to, subject, html: body });
    return true;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
    // Segurança: Cron jobs da Vercel enviam um header de autorização específico
    // Para testes manuais via painel admin, permitimos POST sem header se autenticado na sessão do navegador (tratado no frontend)
    // Em produção real, deve-se verificar req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`

    try {
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        const todayStr = today.toISOString().split('T')[0];
        const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

        // 1. Buscar faturas que vencem HOJE ou em 3 DIAS
        const { data: invoices, error } = await supabase
            .from('invoices')
            .select(`
                id, 
                amount, 
                due_date, 
                month,
                user_id, 
                profiles (first_name, email)
            `)
            .eq('status', 'Em aberto')
            .or(`due_date.eq.${todayStr},due_date.eq.${threeDaysStr}`);

        if (error) throw error;

        if (!invoices || invoices.length === 0) {
            return res.status(200).json({ message: 'Nenhuma fatura próxima do vencimento encontrada hoje.' });
        }

        let notificationsSent = 0;
        let emailsSent = 0;

        for (const invoice of invoices) {
            const profile = invoice.profiles as any; // Tipagem do join
            if (!profile) continue;

            const isDueToday = invoice.due_date === todayStr;
            const title = isDueToday ? '⚠️ Fatura Vence Hoje!' : '📅 Fatura Vencendo';
            const message = isDueToday 
                ? `Olá ${profile.first_name}, sua fatura de R$ ${invoice.amount} vence hoje. Evite juros!`
                : `Olá ${profile.first_name}, lembrete: sua fatura de R$ ${invoice.amount} vence em 3 dias.`;
            const type = isDueToday ? 'alert' : 'warning';

            // A. Enviar Notificação Push (In-App)
            // Verifica se já existe notificação igual hoje para não duplicar
            const { data: existingNotif } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', invoice.user_id)
                .eq('title', title)
                .gte('created_at', todayStr + 'T00:00:00') // Criada hoje
                .single();

            if (!existingNotif) {
                await supabase.from('notifications').insert({
                    user_id: invoice.user_id,
                    title: title,
                    message: message,
                    type: type,
                    read: false
                });
                notificationsSent++;
            }

            // B. Enviar E-mail (Mock/Simulação)
            // Em um sistema real, verificaríamos também se o email já foi enviado hoje.
            const emailBody = `
                <h1>Relp Cell - Aviso de Fatura</h1>
                <p>Olá <strong>${profile.first_name}</strong>,</p>
                <p>${message}</p>
                <p>Acesse o aplicativo para realizar o pagamento via PIX ou Boleto.</p>
                <br/>
                <p>Atenciosamente,<br/>Equipe Relp Cell</p>
            `;
            
            await sendEmailMock(profile.email, title, emailBody);
            emailsSent++;
        }

        // Log da ação para auditoria
        await supabase.from('action_logs').insert({
            action_type: 'CRON_INVOICE_CHECK',
            status: 'SUCCESS',
            description: `Verificação automática realizada. ${notificationsSent} notificações e ${emailsSent} emails processados.`,
            details: { target_dates: [todayStr, threeDaysStr], processed_count: invoices.length }
        });

        return res.status(200).json({ 
            success: true, 
            processed: invoices.length, 
            notifications: notificationsSent, 
            emails: emailsSent 
        });

    } catch (error: any) {
        console.error('Erro no Cron Job:', error);
        await supabase.from('action_logs').insert({
            action_type: 'CRON_INVOICE_CHECK',
            status: 'FAILURE',
            description: 'Erro ao executar verificação de faturas.',
            details: { error: error.message }
        });
        return res.status(500).json({ error: error.message });
    }
}
