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
  payment_id?: string | null; // ID do pagamento no Mercado Pago
  boleto_url?: string | null; // URL para visualizar o boleto
  boleto_barcode?: string | null; // Código de barras do boleto
  notes?: string | null;
}

export interface Profile {
  id: string;
  email?: string;
}