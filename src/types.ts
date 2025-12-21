
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

export interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  sku: string;
  status: 'active' | 'inactive';
  condition: 'novo' | 'lacrado' | 'recondicionado';
  
  // Descrição
  description: string | null;
  highlights: string | null;
  
  // Imagens
  image_url: string | null;
  secondary_images?: string[];

  // Especificações Técnicas
  processor?: string;
  ram?: string;
  storage?: string;
  display?: string;
  os?: string;
  camera?: string;
  battery?: string;
  connectivity?: string;
  ports?: string;
  voltage?: string;
  color?: string;

  // Preço e Pagamento
  price: number;
  promotional_price?: number;
  max_installments: number;
  pix_discount_percent?: number;
  cost_price?: number; // Oculto do cliente

  // Estoque
  stock: number;
  min_stock_alert: number;
  availability: 'pronta_entrega' | 'sob_encomenda';

  // Frete (Interno)
  weight: number; // em gramas
  height: number; // em cm
  width: number; // em cm
  length: number; // em cm
  
  // Garantia e Legal
  warranty_manufacturer?: number; // meses
  warranty_store?: number; // meses
  has_invoice: boolean;
  certifications?: string; // Anatel, etc
  package_content?: string;

  // Visibilidade
  is_highlight: boolean;
  is_best_seller: boolean;
  is_new: boolean;
  allow_reviews: boolean;

  created_at: string;
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

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  read: boolean;
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

// Added ScoreHistory to fix import error in src/components/ScoreHistoryView.tsx on line 2
export interface ScoreHistory {
  id: string;
  user_id: string;
  change: number;
  new_score: number;
  reason: string;
  created_at: string;
}

// Added ProductReview to fix import errors in src/components/store/ProductDetails.tsx on line 3 and src/components/ReviewsTab.tsx on line 3
export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  reply?: string;
  created_at: string;
  // For joined queries in admin views
  products?: {
    name: string;
    image_url: string | null;
  };
}
