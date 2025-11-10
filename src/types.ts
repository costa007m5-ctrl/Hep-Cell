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
  due_date: string; // Alinhado com o nome da coluna no banco de dados
  amount: number;
  status: 'Paga' | 'Em aberto';
  paymentMethod?: string | null;
  paymentDate?: string | null;
  transactionId?: string | null;
  notes?: string | null;
}

export interface Profile {
  id: string;
  email?: string;
}
