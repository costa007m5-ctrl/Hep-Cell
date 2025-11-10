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
  DEV, // Adicionado
}

export interface Invoice {
  id: string;
  user_id: string; // Adicionado para rastreamento no painel de admin
  month: string;
  dueDate: string;
  amount: number;
  status: 'Paga' | 'Em aberto';
}