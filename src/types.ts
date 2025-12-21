
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
  NOTIFICATIONS,
}

export interface Invoice {
  id: string;
  user_id: string; 
  month: string;
  due_date: string;
  amount: number;
  status: 'Paga' | 'Em aberto' | 'Boleto Gerado' | 'Expirado' | 'Cancelado' | 'Aguardando Assinatura';
  payment_method?: string | null;
  payment_date?: string | null;
  payment_id?: string | null;
  payment_code?: string | null; 
  payment_expiration?: string | null; 
  boleto_url?: string | null;
  boleto_barcode?: string | null;
  notes?: string | null;
  discountValue?: number; 
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  reply?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  products?: { name: string; image_url: string };
}

export interface Profile {
  id: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  identification_type?: string | null;
  identification_number?: string | null;
  phone?: string | null;
  zip_code?: string | null;
  street_name?: string | null;
  street_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  federal_unit?: string | null;
  credit_score?: number | null;
  credit_limit?: number | null;
  credit_status?: string | null;
  last_limit_request_date?: string | null;
  avatar_url?: string | null;
  coins_balance?: number;
}

export interface ScoreHistory {
  id: string;
  user_id: string;
  change: number;
  new_score: number;
  reason: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category?: string; 
  brand?: string; 
  rating?: number; 
  reviews_count?: number; 
  is_new?: boolean; 
  is_full?: boolean;
  free_shipping?: boolean;
  // Campos Logísticos (Ocultos do Cliente)
  weight?: number; // em gramas
  height?: number; // em cm
  width?: number; // em cm
  length?: number; // em cm
  created_at: string;
}

export interface CartItem extends Product {
    cartId: string;
    quantity: number;
}

export interface LimitRequest {
    id: string;
    user_id: string;
    requested_amount: number;
    current_limit: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

export interface Contract {
    id: string;
    user_id: string;
    title: string;
    items: string;
    total_value: number;
    installments: number;
    status: 'Ativo' | 'Pendente' | 'Assinado' | 'Cancelado' | 'pending_signature';
    signature_data?: string | null;
    terms_accepted?: boolean;
    created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  read: boolean;
  created_at: string;
}
