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
  due_date: string;
  amount: number;
  status: 'Paga' | 'Em aberto' | 'Boleto Gerado' | 'Expirado' | 'Cancelado';
  payment_method?: string | null;
  payment_date?: string | null;
  payment_id?: string | null;
  boleto_url?: string | null;
  boleto_barcode?: string | null;
  notes?: string | null;
  discountValue?: number; // Adicionado para interface
  created_at: string;
}

export interface Profile {
  id: string;
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
  last_limit_request_date?: string | null;
  notify_due_date?: boolean;
  notify_new_invoice?: boolean;
  notify_promotions?: boolean;
  avatar_url?: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category?: string; // Novo
  rating?: number; // Novo
  reviews_count?: number; // Novo
  is_new?: boolean; // Novo
  created_at: string;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface Address {
    id: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    isDefault: boolean;
}

export interface Order {
    id: string;
    date: string;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    total: number;
    items: { name: string; quantity: number; price: number }[];
    trackingCode?: string;
}

export interface Review {
    id: string;
    userName: string;
    rating: number;
    comment: string;
    date: string;
}

export interface ScoreHistory {
  id: number;
  date: string;
  reason: string;
  change: number;
  newScore: number;
}
