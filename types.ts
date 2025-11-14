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

export enum PaymentMethod {
  CARD = 'card',
  PIX = 'pix',
  BOLETO = 'boleto',
}

export interface Invoice {
  id: string;
  month: string;
  dueDate: string;
  amount: number;
  status: 'Paga' | 'Em aberto' | 'Boleto Gerado';
}

export interface PayerInfo {
  email: string;
  firstName: string;
  lastName: string;
  identificationType: string;
  identificationNumber: string;
  zipCode?: string;
  streetName?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  federalUnit?: string;
}