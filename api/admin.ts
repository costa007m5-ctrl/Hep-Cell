import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, MerchantOrder } from 'mercadopago';
import { URL } from 'url';

// --- Helper Functions (Unchanged) ---
function getSupabaseAdminClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase environment variables are not set.');
    }
    return createClient(supabaseUrl, supabaseServiceKey);
}

function getGeminiClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return null; 
    }
    return new GoogleGenAI({ apiKey });
}

function getMercadoPagoClient() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('Mercado Pago Access Token is not set.');
    }
    return new MercadoPagoConfig({ accessToken });
}

async function logAction(supabase: SupabaseClient, action_type: string, status: 'SUCCESS' | 'FAILURE', description: string, details?: object) {
    const { error } = await supabase.from('action_logs').insert({ action_type, status, description, details });
    if (error) {
        console.error(`Failed to log action: ${action_type}`, error);
    }
}

async function generateContentWithRetry(genAI: GoogleGenAI, params: any, retries = 3, initialDelay = 2000) {
    let delay = initialDelay;
    for (let i = 0; i < retries; i++) {
        try {
            return await genAI.models.generateContent(params);
        } catch (error: any) {
            const errorMsg = error.message || JSON.stringify(error);
            const isRetryable = error.status === 429 || error.status === 503 || 
                                errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('overloaded') || errorMsg.includes('RESOURCE_EXHAUSTED');
            
            if (isRetryable && i < retries - 1) {
                console.warn(`AI Request failed (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms... Error: ${errorMsg}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error("Max retries exceeded");
}

async function runCreditAnalysis(supabase: SupabaseClient, genAI: GoogleGenAI | null, userId: string, useStrictRules: boolean = true) {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileError) throw profileError;
    
    const { data: invoices, error: invoicesError } = await supabase.from('invoices').select('status, amount, due_date, payment_date').eq('user_id', userId);
    if (invoicesError) throw invoicesError;

    const { data: docs } = await supabase.from('client_documents').select('document_type').eq('user_id', userId);
    const hasIncomeProof = docs?.some(d => d.document_type === 'Comprovante de Renda' || d.document_type === 'Holerite');

    let suggestedLimit = 0;
    let suggestedScore = 0;
    let riskReason = '';

    const paidInvoices = invoices?.filter(i => i.status === 'Paga').length || 0;
    
    if (paidInvoices < 3 && useStrictRules) {
        if (hasIncomeProof && profile.salary && profile.salary > 0) {
            suggestedLimit = Math.round(profile.salary * 0.20);
            suggestedScore = 600;
            riskReason = 'Limite inicial baseado em 20% da renda comprovada.';
        } else {
            suggestedLimit = 100.00;
            suggestedScore = 400;
            riskReason = 'Limite restrito (R$ 100) por falta de comprovante de renda.';
        }
    } else {
        if (!genAI) {
            suggestedLimit = (profile.credit_limit || 200) * 1.1;
            suggestedScore = Math.min(1000, (profile.credit_score || 500) + 50);
            riskReason = 'Aumento automático por bom histórico (IA Indisponível).';
        } else {
            const prompt = `
                Atue como um analista de crédito sênior.
                Dados do Cliente:
                - Salário Informado: R$ ${profile.salary || 0}
                - Possui Comprovante de Renda: ${hasIncomeProof ? 'SIM' : 'NÃO'}
                - Limite Atual: R$ ${profile.credit_limit}
                - Histórico de Pagamentos: ${JSON.stringify(invoices)}
                
                Regras de Negócio:
                1. Se não tiver comprovante de renda e histórico for fraco, teto é R$ 100.
                2. Se tiver comprovante, base inicial é 20% do salário.
                3. Se o histórico for EXCELENTE (pagamentos em dia), você pode sugerir um limite acima de 20% do salário, até no máximo 40%.
                4. Se houver atrasos recentes, reduza o limite ou mantenha.

                Retorne APENAS um JSON: {"credit_score": (0-1000), "credit_limit": (valor numérico), "credit_status": "Excelente"|"Bom"|"Regular"|"Risco", "reason": "Explicação curta"}
            `;

            const response = await generateContentWithRetry(genAI, { 
                model: 'gemini-2.5-flash', 
                contents: prompt, 
                config: { responseMimeType: 'application/json' } 
            });
            
            const analysis = JSON.parse(response.text || '{}');
            suggestedLimit = analysis.credit_limit;
            suggestedScore = analysis.credit_score;
            riskReason = analysis.reason;
        }
    }

    return {
        credit_limit: suggestedLimit,
        credit_score: suggestedScore,
        reason: riskReason,
        profile
    };
}

async function updateProfileCredit(supabase: SupabaseClient, userId: string, limit: number, score: number, status: string, reason: string) {
    const { data: profile } = await supabase.from('profiles').select('credit_score, credit_limit').eq('id', userId).single();
    
    const { error: updateError } = await supabase.from('profiles')
        .update({ 
            credit_score: score, 
            credit_limit: limit, 
            credit_status: status 
        })
        .eq('id', userId);

    if (updateError) throw updateError;
    
    if (profile && profile.credit_limit !== limit) {
        await supabase.from('score_history').insert({
            user_id: userId,
            change: score - (profile.credit_score || 0),
            new_score: score,
            reason: reason
        });
    }
}

// --- Handlers ---

async function handleLimitRequestActions(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const genAI = getGeminiClient();

    try {
        const { requestId, action, manualLimit, manualScore, responseReason } = req.body; 

        if (!requestId || !action) return res.status(400).json({ error: "ID da solicitação e ação obrigatórios." });

        const { data: request, error: reqError } = await supabase.from('limit_requests').select('*').eq('id', requestId).single();
        if (reqError || !request) return res.status(404).json({ error: "Solicitação não encontrada." });

        let newLimit = request.current_limit;
        let statusMsg = '';
        let reasonToSave = responseReason || '';

        if (action === 'reject') {
            await supabase.from('limit_requests').update({ 
                status: 'rejected',
                admin_response_reason: reasonToSave 
            }).eq('id', requestId);
            
            await supabase.from('notifications').insert({
                user_id: request.user_id,
                title: 'Solicitação de Limite',
                message: 'Sua solicitação de aumento de limite foi analisada. Confira o status no seu perfil.',
                type: 'info'
            });
            return res.status(200).json({ message: "Solicitação rejeitada." });
        }

        if (action === 'calculate_auto') {
             const analysis = await runCreditAnalysis(supabase, genAI, request.user_id, true);
             return res.status(200).json({ 
                 suggestedLimit: analysis.credit_limit, 
                 suggestedScore: analysis.credit_score,
                 reason: analysis.reason || "Sugestão baseada em renda e histórico."
             });
        }

        if (action === 'approve_manual') {
            if (!manualLimit) return res.status(400).json({ error: "Valor manual obrigatório." });
            newLimit = manualLimit;
            const newScore = manualScore || 600;
            
            await supabase.from('profiles').update({ credit_limit: newLimit, credit_score: newScore }).eq('id', request.user_id);
            statusMsg = 'Aprovado manualmente.';
        } 
        
        await supabase.from('limit_requests').update({ 
            status: 'approved',
            admin_response_reason: reasonToSave
        }).eq('id', requestId);

        await supabase.from('notifications').insert({
            user_id: request.user_id,
            title: 'Aumento de Limite Aprovado! 🎉',
            message: `Parabéns! Seu novo limite é de R$ ${newLimit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.`,
            type: 'success'
        });

        return res.status(200).json({ message: statusMsg, newLimit });

    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleGetLimitRequests(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        // REMOVIDO O FILTRO .eq('status', 'pending') para debug e visualização completa
        const { data, error } = await supabase
            .from('limit_requests')
            .select('*, profiles(first_name, last_name, email, salary, credit_limit, credit_score)') 
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}

// ... (Rest of the file: handleManageInvoice, handleUpdateLimit, etc. remains unchanged) ...
async function handleManageInvoice(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { invoiceId, invoiceIds, action } = req.body; 
        
        if ((!invoiceId && !invoiceIds) || !action) return res.status(400).json({ error: "ID(s) da fatura e ação são obrigatórios." });

        const ids = invoiceIds || [invoiceId];

        if (action === 'pay') {
            await supabase.from('invoices').update({ status: 'Paga', payment_date: new Date().toISOString() }).in('id', ids);
            await logAction(supabase, 'MANUAL_PAYMENT', 'SUCCESS', `${ids.length} fatura(s) marcada(s) como paga(s) manualmente.`);
            
            if(ids.length > 0) {
                 const { data: inv } = await supabase.from('invoices').select('user_id').eq('id', ids[0]).single();
                 if(inv) {
                     const genAI = getGeminiClient();
                     const analysis = await runCreditAnalysis(supabase, genAI, inv.user_id, false);
                     await updateProfileCredit(supabase, inv.user_id, analysis.credit_limit, analysis.credit_score, analysis.profile.credit_status === 'Bloqueado' ? 'Bloqueado' : 'Ativo', analysis.reason);
                 }
            }

        } else if (action === 'cancel') {
            await supabase.from('invoices').update({ status: 'Cancelado', notes: 'Cancelado manualmente pelo admin.' }).in('id', ids);
            await logAction(supabase, 'MANUAL_CANCEL', 'SUCCESS', `${ids.length} fatura(s) cancelada(s) manualmente.`);
        } else if (action === 'delete') {
            await supabase.from('invoices').delete().in('id', ids);
            await logAction(supabase, 'MANUAL_DELETE', 'SUCCESS', `${ids.length} fatura(s) excluída(s) permanentemente.`);
        } else {
            return res.status(400).json({ error: "Ação inválida." });
        }

        return res.status(200).json({ message: "Ação realizada com sucesso." });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleUpdateLimit(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, creditLimit, creditScore } = req.body;
        
        if (!userId) return res.status(400).json({ error: "User ID obrigatório." });

        const updates: any = {};
        if (creditLimit !== undefined) updates.credit_limit = creditLimit;
        if (creditScore !== undefined) updates.credit_score = creditScore;

        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (error) throw error;

        await supabase.from('score_history').insert({
            user_id: userId,
            change: 0,
            new_score: creditScore || 0,
            reason: 'Ajuste manual pelo administrador'
        });

        await logAction(supabase, 'MANUAL_LIMIT_UPDATE', 'SUCCESS', `Limite/Score atualizado manualmente para user ${userId}.`);
        return res.status(200).json({ message: "Perfil atualizado com sucesso." });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleRiskDetails(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    const genAI = getGeminiClient();
    if (!genAI) return res.status(500).json({ error: "IA não configurada." });

    try {
        const { userId } = req.body;
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        const { data: invoices } = await supabase.from('invoices').select('*').eq('user_id', userId);
        const { data: history } = await supabase.from('score_history').select('*').eq('user_id', userId).limit(10);

        const prompt = `
            Analise detalhadamente o risco deste cliente para um sistema de crediário de loja de celulares.
            Perfil: ${JSON.stringify(profile)}
            Faturas: ${JSON.stringify(invoices)}
            Histórico Score: ${JSON.stringify(history)}
            
            Retorne um relatório em formato JSON com:
            {
                "riskLevel": "Baixo" | "Médio" | "Alto",
                "reason": "Resumo curto do motivo principal",
                "detailedAnalysis": "Explicação detalhada de 3-4 linhas sobre o comportamento de pagamento e capacidade financeira.",
                "recommendation": "Sugestão para o lojista (ex: Aumentar limite, Bloquear compras, Pedir fiador).",
                "positivePoints": ["ponto 1", "ponto 2"],
                "negativePoints": ["ponto 1", "ponto 2"]
            }
        `;

        const response = await generateContentWithRetry(genAI, { 
            model: 'gemini-2.5-flash', 
            contents: prompt, 
            config: { responseMimeType: 'application/json' } 
        });

        res.status(200).json(JSON.parse(response.text || '{}'));

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}

async function handleClientDocuments(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    try {
        if (req.method === 'GET') {
            const { userId } = req.query;
            const { data: contracts } = await supabase.from('contracts').select('*').eq('user_id', userId);
            const { data: uploads } = await supabase.from('client_documents').select('*').eq('user_id', userId);
            
            res.status(200).json({ contracts: contracts || [], uploads: uploads || [] });
        } else if (req.method === 'POST') {
            const { userId, title, type, fileBase64 } = req.body;
            const { data, error } = await supabase.from('client_documents').insert({
                user_id: userId,
                title,
                document_type: type,
                file_url: fileBase64
            }).select();
            
            if (error) throw error;
            res.status(201).json(data[0]);
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}

async function handleManageInternalNotes(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, notes } = req.body;
        const { error } = await supabase.from('profiles').update({ internal_notes: notes }).eq('id', userId);
        if (error) throw error;
        res.status(200).json({ message: "Notas atualizadas." });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}

// ... (Other handlers remain unchanged) ...
async function handleCreateSale(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, totalAmount, installments, productName, signature, saleType, paymentMethod, downPayment, tradeInValue, sellerName, dueDay } = req.body;
        
        if (!userId || !totalAmount || !installments || !productName) {
            return res.status(400).json({ error: 'Missing required sale data.' });
        }

        const installmentAmount = Math.round((totalAmount / installments) * 100) / 100;
        const newInvoices = [];
        const today = new Date();
        const purchaseTimestamp = new Date().toISOString();
        const initialStatus = saleType === 'crediario' ? 'Aguardando Assinatura' : 'Em aberto';

        const selectedDay = dueDay || 10;
        
        let currentMonth = today.getMonth() + 1;
        let currentYear = today.getFullYear();

        for (let i = 1; i <= installments; i++) {
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            
            const maxDay = new Date(currentYear, currentMonth + 1, 0).getDate();
            const day = Math.min(selectedDay, maxDay);
            
            const dueDate = new Date(currentYear, currentMonth, day);
            const monthLabel = installments === 1 ? productName : `${productName} (${i}/${installments})`;
            
            let notes = saleType === 'direct' 
                ? `Compra direta via ${paymentMethod}.` 
                : `Referente a compra de ${productName} parcelada em ${installments}x.`;

            if (downPayment && Number(downPayment) > 0) {
                notes += ` (Entrada: R$ ${Number(downPayment).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
            }
            
            if (tradeInValue && Number(tradeInValue) > 0) {
                notes += ` (Trade-In: R$ ${Number(tradeInValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
            }
            
            if (sellerName) {
                notes += ` [Vendedor: ${sellerName}]`;
            }

            newInvoices.push({
                user_id: userId,
                month: monthLabel,
                due_date: dueDate.toISOString().split('T')[0],
                amount: installmentAmount,
                status: initialStatus,
                notes: notes,
                created_at: purchaseTimestamp, 
                payment_method: paymentMethod || null
            });
            
            currentMonth++;
        }

        const { error } = await supabase.from('invoices').insert(newInvoices);
        if (error) throw error;

        if (saleType === 'crediario') {
            await supabase.from('profiles').update({ preferred_due_day: selectedDay }).eq('id', userId);

            const { error: contractError } = await supabase.from('contracts').insert({
                user_id: userId,
                title: 'Contrato de Crediário (CDCI) - Relp Cell',
                items: productName,
                total_value: totalAmount,
                installments: installments,
                status: 'pending_signature', 
                signature_data: null, 
                terms_accepted: false,
                created_at: purchaseTimestamp
            });
            if (contractError) console.error("Erro ao salvar contrato:", contractError);
            
            await supabase.from('notifications').insert({
                user_id: userId,
                title: 'Aprovação Necessária',
                message: `Sua compra de ${productName} está aguardando sua assinatura digital no app. Você tem 24h.`,
                type: 'alert',
                read: false
            });
        }

        await logAction(supabase, 'SALE_CREATED', 'SUCCESS', `Venda criada para o usuário ${userId}. Tipo: ${saleType || 'Crediário'}. Total: ${totalAmount}. Status: ${initialStatus}`);
        
        res.status(201).json({ message: 'Venda registrada com sucesso.', status: initialStatus });

    } catch (error: any) {
        await logAction(supabase, 'SALE_CREATED', 'FAILURE', 'Falha ao criar venda.', { error: error.message, body: req.body });
        res.status(500).json({ error: error.message });
    }
}

async function handleNegotiateDebt(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    try {
        const { userId, invoiceIds, totalAmount, installments, firstDueDate, notes } = req.body;

        if (!userId || !invoiceIds || invoiceIds.length === 0 || !totalAmount || !installments) {
            return res.status(400).json({ error: "Dados incompletos para negociação." });
        }

        const { error: cancelError } = await supabase
            .from('invoices')
            .update({ 
                status: 'Cancelado', 
                notes: 'Renegociado em ' + new Date().toLocaleDateString('pt-BR') 
            })
            .in('id', invoiceIds)
            .eq('user_id', userId); 

        if (cancelError) throw cancelError;

        const { data: profile } = await supabase.from('profiles').select('first_name, last_name, identification_number').eq('id', userId).single();
        
        const contractTitle = 'Termo de Confissão e Renegociação de Dívida';
        const contractBody = `
            INSTRUMENTO PARTICULAR DE CONFISSÃO DE DÍVIDA\n\n
            DEVEDOR: ${profile?.first_name} ${profile?.last_name}, CPF ${profile?.identification_number}.\n
            CREDOR: RELP CELL ELETRONICOS LTDA, CNPJ 43.735.304/0001-00.\n\n
            1. O DEVEDOR reconhece a dívida no valor total renegociado de R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\n
            2. O pagamento será realizado em ${installments} parcelas mensais.\n
            3. O não pagamento de qualquer parcela acarretará vencimento antecipado da dívida e inclusão nos órgãos de proteção ao crédito.\n
            4. A assinatura digital deste termo valida legalmente o acordo.\n
            
            Detalhes: ${notes || 'Renegociação de saldo devedor.'}
        `;

        const creationTime = new Date().toISOString();

        const { error: contractError } = await supabase.from('contracts').insert({
            user_id: userId,
            title: contractTitle,
            items: contractBody, 
            total_value: totalAmount,
            installments: installments,
            status: 'pending_signature',
            created_at: creationTime
        });

        if (contractError) throw contractError;

        const newInvoices = [];
        let currentMonth = new Date(firstDueDate).getMonth();
        let currentYear = new Date(firstDueDate).getFullYear();
        const dueDay = new Date(firstDueDate).getDate();
        const installmentVal = totalAmount / installments;

        for (let i = 1; i <= installments; i++) {
            const dueDate = new Date(currentYear, currentMonth, dueDay);
            
            newInvoices.push({
                user_id: userId,
                month: `Acordo de Renegociação (${i}/${installments})`,
                due_date: dueDate.toISOString().split('T')[0],
                amount: installmentVal,
                status: 'Aguardando Assinatura',
                notes: `Refinanciamento de débitos anteriores. ${notes || ''}`,
                created_at: creationTime
            });

            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }

        const { error: insertError } = await supabase.from('invoices').insert(newInvoices);
        if (insertError) throw insertError;

        await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Proposta de Acordo',
            message: 'Sua renegociação foi gerada. Acesse o app para assinar o termo e regularizar sua situação.',
            type: 'alert'
        });

        await logAction(supabase, 'DEBT_NEGOTIATION', 'SUCCESS', `Negociação criada para user ${userId}. Contrato pendente gerado.`);

        return res.status(200).json({ message: "Proposta de negociação enviada para o cliente." });

    } catch (error: any) {
        await logAction(supabase, 'DEBT_NEGOTIATION', 'FAILURE', 'Erro na negociação.', { error: error.message });
        return res.status(500).json({ error: error.message });
    }
}

async function handleDueDateRequests(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdminClient();
    
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('due_date_requests')
                .select('*, profiles(first_name, last_name, email)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return res.status(200).json(data);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    if (req.method === 'PUT') {
        try {
            const { id, status, adminNotes } = req.body;
            if (!id || !status) return res.status(400).json({ error: "ID e Status são obrigatórios." });

            const { data: request, error: reqError } = await supabase
                .from('due_date_requests')
                .update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (reqError) throw reqError;

            if (status === 'approved' && request) {
                const newDay = request.requested_day;
                const userId = request.user_id;

                await supabase.from('profiles').update({ preferred_due_day: newDay }).eq('id', userId);

                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('user_id', userId)
                    .or('status.eq.Em aberto,status.eq.Boleto Gerado');

                if (invoices) {
                    for (const inv of invoices) {
                        const oldDate = new Date(inv.due_date);
                        const year = oldDate.getFullYear();
                        const month = oldDate.getMonth();
                        const maxDay = new Date(year, month + 1, 0).getDate();
                        const safeDay = Math.min(newDay, maxDay);
                        
                        const newDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`;

                        await supabase
                            .from('invoices')
                            .update({ due_date: newDateStr, notes: (inv.notes || '') + ` [Vencimento alterado de dia ${oldDate.getDate()} para ${safeDay}]` })
                            .eq('id', inv.id);
                    }
                }

                await supabase.from('notifications').insert({
                    user_id: userId,
                    title: 'Data de Vencimento Alterada',
                    message: `Sua solicitação foi aprovada. Suas faturas agora vencem no dia ${newDay}.`,
                    type: 'success'
                });
            } else if (status === 'rejected' && request) {
                 await supabase.from('notifications').insert({
                    user_id: request.user_id,
                    title: 'Solicitação Recusada',
                    message: `Sua solicitação de mudança de data foi recusada. Motivo: ${adminNotes || 'Política interna'}.`,
                    type: 'warning'
                });
            }

            return res.status(200).json({ message: "Solicitação processada com sucesso." });

        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }
}

// ... (Same condensed exports as before) ...
async function handleProducts(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if(req.method==='GET'){ const {data,error}=await supabase.from('products').select('*').order('created_at',{ascending:false}); if(error) throw error; res.status(200).json(data); } else if(req.method==='POST'){ const {name,description,price,stock,image_url,image_base64,brand,category}=req.body; const {data,error}=await supabase.from('products').insert([{name,description,price,stock,image_url:image_base64||image_url,brand,category}]).select(); if(error) throw error; res.status(201).json(data[0]); } else if(req.method==='PUT'){ const {id,name,description,price,stock,image_url,image_base64,brand,category}=req.body; const {data,error}=await supabase.from('products').update({name,description,price,stock,image_url:image_base64||image_url,brand,category}).eq('id',id).select(); if(error) throw error; res.status(200).json(data[0]); } else { res.status(405).json({error:'Method not allowed'}); } } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleCreateAndAnalyzeCustomer(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const genAI = getGeminiClient(); try { const { email, password, ...meta } = req.body; const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta }); if (error) throw error; const profile = await runCreditAnalysis(supabase, genAI, data.user.id); res.status(200).json({ message: 'Success', profile }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleGenerateMercadoPagoToken(req: VercelRequest, res: VercelResponse) { const { code, redirectUri, codeVerifier } = req.body; try { const response = await fetch('https://api.mercadopago.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.ML_CLIENT_ID, client_secret: process.env.ML_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier }) }); const data = await response.json(); if(!response.ok) throw new Error(data.message || 'Failed to generate token'); res.status(200).json({ accessToken: data.access_token, refreshToken: data.refresh_token }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSendNotification(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { userId, title, message, type } = req.body; if (!userId || !title || !message) return res.status(400).json({ error: 'Missing required fields' }); await supabase.from('notifications').insert({ user_id: userId, title, message, type: type || 'info' }); res.status(200).json({ message: 'Notificação enviada.' }); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleGenerateProductDetails(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if (!genAI) return res.status(500).json({ error: 'Gemini API key not configured.' }); const { prompt } = req.body; const instruction = `Extract product details from: "${prompt}". Return JSON: {name, description, price, stock, brand, category}.`; try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash', contents: instruction, config: { responseMimeType: 'application/json' } }); res.status(200).json(JSON.parse(response.text || '{}')); } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleEditImage(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:'API Key missing'}); const {prompt, imageBase64} = req.body; const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/); if(!match) return res.status(400).json({error:'Invalid image'}); try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash-image', contents: { parts: [{inlineData:{mimeType:match[1], data:match[2]}}, {text:prompt}] } }); const part = response.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData); if(part && part.inlineData) res.status(200).json({image:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}); else throw new Error("No image"); } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleGenerateBanner(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:'API Key missing'}); const {prompt, imageBase64} = req.body; const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/); if(!match) return res.status(400).json({error:'Invalid image'}); try { const response = await generateContentWithRetry(genAI, { model: 'gemini-2.5-flash-image', contents: { parts: [{text:`Banner e-commerce 16:9 based on this product description: ${prompt}`}] } }); const part = response.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData); if(part && part.inlineData) res.status(200).json({image:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}); else throw new Error("No image"); } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleBanners(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if(req.method==='GET'){ const {data}=await supabase.from('store_banners').select('*'); return res.status(200).json(data); } if(req.method==='POST'){ const {image_base64, prompt, link} = req.body; const {data}=await supabase.from('store_banners').insert({image_url:image_base64, prompt, link}).select(); return res.status(201).json({banner:data}); } if(req.method==='DELETE'){ const {id}=req.body; await supabase.from('store_banners').delete().eq('id',id); return res.status(200).json({message:'Deleted'}); } } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleSettings(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if(req.method==='GET'){ const {data}=await supabase.from('system_settings').select('*'); const s=data?.reduce((acc:any,i:any)=>{acc[i.key]=i.value; return acc;},{}); return res.status(200).json(s); } if(req.method==='POST'){ const {key,value}=req.body; await supabase.from('system_settings').upsert({key,value}); return res.status(200).json({message:'Saved'}); } } catch(e:any) { res.status(500).json({error:e.message}); } }
async function handleTestSupabase(_req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); await supabase.rpc('execute_admin_sql',{sql_query:'SELECT 1'}); res.status(200).json({message:'OK'}); }
async function handleTestGemini(_req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(genAI) await genAI.models.generateContent({model:'gemini-2.5-flash', contents:'test'}); res.status(200).json({message:'OK'}); }
async function handleTestMercadoPago(_req: VercelRequest, res: VercelResponse) { const client = getMercadoPagoClient(); new MerchantOrder(client); res.status(200).json({message:'OK'}); }
async function handleTestMercadoLivre(_req: VercelRequest, res: VercelResponse) { res.status(200).json({message:'OK'}); }
async function handleGetLogs(_req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const {data}=await supabase.from('action_logs').select('*').order('created_at',{ascending:false}); res.status(200).json(data); }
async function handleAnalyzeCredit(req: VercelRequest, res: VercelResponse) { const supabase=getSupabaseAdminClient(); const genAI=getGeminiClient(); const {userId}=req.body; const result=await runCreditAnalysis(supabase,genAI,userId, false); await updateProfileCredit(supabase, userId, result.credit_limit, result.credit_score, result.profile.credit_status === 'Bloqueado' ? 'Bloqueado' : 'Ativo', result.reason); res.status(200).json({profile:result}); }
async function handleGetProfiles(_req: VercelRequest, res: VercelResponse) { const supabase=getSupabaseAdminClient(); const {data}=await supabase.from('profiles').select('*'); res.status(200).json(data); }
async function handleDiagnoseError(_req: VercelRequest, res: VercelResponse) { res.status(200).json({ diagnosis: "Simulated Diagnosis" }); }
async function handleGetMpAuthUrl(req: VercelRequest, res: VercelResponse) { const { code_challenge } = req.body; const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${process.env.ML_CLIENT_ID}&response_type=code&platform_id=mp&state=random_state&redirect_uri=${req.headers.origin}/admin&code_challenge=${code_challenge}&code_challenge_method=S256`; res.status(200).json({ authUrl }); }
async function handleSetupDatabase(_req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); const FULL_SETUP_SQL = `CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions"; CREATE TABLE IF NOT EXISTS "public"."profiles" ( "id" "uuid" NOT NULL, "email" "text", "first_name" "text", "last_name" "text", "identification_number" "text", "phone" "text", "credit_score" integer DEFAULT 0, "credit_limit" numeric(10, 2) DEFAULT 0, "credit_status" "text" DEFAULT 'Em Análise', "last_limit_request_date" timestamp with time zone, "avatar_url" "text", "zip_code" "text", "street_name" "text", "street_number" "text", "neighborhood" "text", "city" "text", "federal_unit" "text", "preferred_due_day" integer DEFAULT 10, "internal_notes" "text", "salary" numeric(10, 2) DEFAULT 0, "created_at" timestamp with time zone DEFAULT "now"(), "updated_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"), CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE, CONSTRAINT "profiles_email_key" UNIQUE ("email") ); ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "internal_notes" "text"; ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "salary" numeric(10, 2) DEFAULT 0; CREATE TABLE IF NOT EXISTS "public"."client_documents" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "title" "text", "document_type" "text", "file_url" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id"), CONSTRAINT "client_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); ALTER TABLE "public"."client_documents" ENABLE ROW LEVEL SECURITY; CREATE POLICY "Users view own documents" ON "public"."client_documents" FOR SELECT USING (auth.uid() = user_id); CREATE TABLE IF NOT EXISTS "public"."limit_requests" ( "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(), "user_id" "uuid" NOT NULL, "requested_amount" numeric(10, 2), "current_limit" numeric(10, 2), "justification" "text", "status" "text" DEFAULT 'pending', "admin_response_reason" "text", "created_at" timestamp with time zone DEFAULT "now"(), CONSTRAINT "limit_requests_pkey" PRIMARY KEY ("id"), CONSTRAINT "limit_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ); ALTER TABLE "public"."limit_requests" ADD COLUMN IF NOT EXISTS "admin_response_reason" "text"; ALTER TABLE "public"."limit_requests" ENABLE ROW LEVEL SECURITY; CREATE POLICY "Users view own limit requests" ON "public"."limit_requests" FOR SELECT USING (auth.uid() = user_id); CREATE POLICY "Users create own limit requests" ON "public"."limit_requests" FOR INSERT WITH CHECK (auth.uid() = user_id);`; const { error } = await supabase.rpc('execute_admin_sql', { sql_query: FULL_SETUP_SQL }); if (error) throw error; await logAction(supabase, 'DATABASE_SETUP', 'SUCCESS', 'Database configured with new features.'); res.status(200).json({ message: "Banco de dados atualizado com sucesso!" }); }
async function handleSupportTickets(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if (req.method === 'POST') { const { userId, subject, message, category, priority } = req.body; const { data: ticket, error: ticketError } = await supabase.from('support_tickets').insert({ user_id: userId, subject: subject || 'Atendimento', category: category || 'Geral', priority: priority || 'normal', status: 'open' }).select().single(); if (ticketError) throw ticketError; if (message) { const { error: msgError } = await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_type: 'user', message }); if (msgError) throw msgError; } res.status(201).json(ticket); } else if (req.method === 'PUT') { const { id, status } = req.body; const { data, error } = await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select(); if (error) throw error; res.status(200).json(data[0]); } else if (req.method === 'GET') { const { userId } = req.query; let query = supabase.from('support_tickets').select('*, profiles(first_name, last_name, email, credit_score, credit_limit, credit_status)').order('updated_at', { ascending: false }); if (userId) { query = query.eq('user_id', userId); } const { data, error } = await query; if (error) throw error; res.status(200).json(data); } } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSupportMessages(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { if (req.method === 'POST') { const { ticketId, sender, message, isInternal } = req.body; const { data, error } = await supabase.from('support_messages').insert({ ticket_id: ticketId, sender_type: sender, message, is_internal: isInternal || false }).select().single(); if (error) throw error; await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId); res.status(201).json(data); } else if (req.method === 'GET') { const { ticketId } = req.query; const { data, error } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }); if (error) throw error; res.status(200).json(data); } } catch (e: any) { res.status(500).json({ error: e.message }); } }
async function handleSupportChat(req: VercelRequest, res: VercelResponse) { const genAI = getGeminiClient(); if(!genAI) return res.status(500).json({error:"AI unavailable"}); const {message, context} = req.body; const prompt = `${context} User Message: "${message}" You are a helpful support assistant for Relp Cell. Respond in Portuguese (Brazil). Be concise, polite, and professional.`; try { const response = await generateContentWithRetry(genAI, {model:'gemini-2.5-flash', contents: prompt}); res.status(200).json({reply: response.text}); } catch(e: any) { res.status(500).json({error: e.message}); } }
async function handleGetAllInvoices(req: VercelRequest, res: VercelResponse) { const supabase = getSupabaseAdminClient(); try { const { data, error } = await supabase.from('invoices').select('*').order('due_date', { ascending: false }); if (error) throw error; res.status(200).json(data); } catch (e: any) { res.status(500).json({ error: e.message }); } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (path === '/api/admin/products') return await handleProducts(req, res);
        if (req.method === 'GET') {
            switch (path) {
                case '/api/admin/get-logs': return await handleGetLogs(req, res);
                case '/api/admin/profiles': return await handleGetProfiles(req, res);
                case '/api/admin/settings': return await handleSettings(req, res);
                case '/api/admin/banners': return await handleBanners(req, res);
                case '/api/admin/support-tickets': return await handleSupportTickets(req, res);
                case '/api/admin/support-messages': return await handleSupportMessages(req, res);
                case '/api/admin/invoices': return await handleGetAllInvoices(req, res);
                case '/api/admin/due-date-requests': return await handleDueDateRequests(req, res);
                case '/api/admin/client-documents': return await handleClientDocuments(req, res);
                case '/api/admin/limit-requests': return await handleGetLimitRequests(req, res);
                default: return res.status(404).json({ error: 'Admin GET route not found' });
            }
        }
        if (req.method === 'POST') {
            switch (path) {
                case '/api/admin/setup-database': return await handleSetupDatabase(req, res);
                case '/api/admin/generate-mercadopago-token': return await handleGenerateMercadoPagoToken(req, res);
                case '/api/admin/get-mp-auth-url': return await handleGetMpAuthUrl(req, res);
                case '/api/admin/test-supabase': return await handleTestSupabase(req, res);
                case '/api/admin/test-gemini': return await handleTestGemini(req, res);
                case '/api/admin/test-mercadopago': return await handleTestMercadoPago(req, res);
                case '/api/admin/test-mercadolivre': return await handleTestMercadoLivre(req, res);
                case '/api/admin/analyze-credit': return await handleAnalyzeCredit(req, res);
                case '/api/admin/create-and-analyze-customer': return await handleCreateAndAnalyzeCustomer(req, res);
                case '/api/admin/create-sale': return await handleCreateSale(req, res); 
                case '/api/admin/negotiate-debt': return await handleNegotiateDebt(req, res); 
                case '/api/admin/manage-invoice': return await handleManageInvoice(req, res); 
                case '/api/admin/risk-details': return await handleRiskDetails(req, res); 
                case '/api/admin/manage-notes': return await handleManageInternalNotes(req, res); 
                case '/api/admin/upload-document': return await handleClientDocuments(req, res); 
                case '/api/admin/update-limit': return await handleUpdateLimit(req, res);
                case '/api/admin/manage-limit-request': return await handleLimitRequestActions(req, res); 
                case '/api/admin/diagnose-error': return await handleDiagnoseError(req, res);
                case '/api/admin/settings': return await handleSettings(req, res);
                case '/api/admin/chat': return await handleSupportChat(req, res);
                case '/api/admin/send-notification': return await handleSendNotification(req, res);
                case '/api/admin/generate-product-details': return await handleGenerateProductDetails(req, res);
                case '/api/admin/generate-banner': return await handleGenerateBanner(req, res);
                case '/api/admin/edit-image': return await handleEditImage(req, res);
                case '/api/admin/banners': return await handleBanners(req, res);
                case '/api/admin/support-tickets': return await handleSupportTickets(req, res);
                case '/api/admin/support-messages': return await handleSupportMessages(req, res);
                default: return res.status(404).json({ error: 'Admin POST route not found' });
            }
        }
        if (req.method === 'PUT') {
            switch (path) {
                case '/api/admin/products': return await handleProducts(req, res);
                case '/api/admin/support-tickets': return await handleSupportTickets(req, res);
                case '/api/admin/due-date-requests': return await handleDueDateRequests(req, res);
                default: return res.status(404).json({ error: 'Admin PUT route not found' });
            }
        }
        if (req.method === 'DELETE') {
            if (path === '/api/admin/banners') return await handleBanners(req, res);
        }
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    } catch (e: any) {
        console.error(`Error in admin API handler for path ${path}:`, e);
        return res.status(500).json({ error: 'Internal Server Error', message: e.message });
    }
}