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
  month: string;
  dueDate: string;
  amount: number;
  status: 'Paga' | 'Em aberto';
}