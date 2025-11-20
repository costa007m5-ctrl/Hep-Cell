import { VercelRequest, VercelResponse } from '@vercel/node';

export enum PaymentStatus {
  IDLE,
  PENDING,
  SUCCESS,
  ERROR,
}

export enum Tab {
  INICIO,
  FATURAS,
  LOJA,
  PERFIL,
}

export interface Invoice {
  id: string;
  user_id: string; 
  month: string;
  due_date: string; // Corrigido de dueDate para due_date
  amount: number;
  status: 'Paga' | 'Em aberto' | 'Boleto Gerado' | 'Expirado' | 'Cancelado';
  payment_method?: string | null;
  payment_date?: string | null;
  payment_id?: string | null; // ID do pagamento no Mercado Pago
  boleto_url?: string | null; // URL para visualizar o boleto
  boleto_barcode?: string | null; // Código de barras do boleto
  notes?: string | null;
  created_at: string;
}

export interface Profile {
  id: string; // Corresponde a auth.users.id
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  identification_type?: string | null;
  identification_number?: string | null;
  zip_code?: string | null;
  street_name?: string | null;
  street_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  federal_unit?: string | null;
  credit_score?: number | null;
  credit_limit?: number | null;
  credit_status?: string | null;
  last_limit_request_date?: string | null; // Data da última solicitação de aumento
  notify_due_date?: boolean;
  notify_new_invoice?: boolean;
  notify_promotions?: boolean;
  avatar_url?: string | null;
}

export interface ScoreHistory {
  id: number;
  date: string;
  reason: string;
  change: number;
  newScore: number;
}


export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  created_at: string;
}