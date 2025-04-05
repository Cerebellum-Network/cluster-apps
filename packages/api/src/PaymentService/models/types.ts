export enum PaymentStatus {
  INITIATED = 'INITIATED',
  PROCESSING_PAYMENT = 'PROCESSING_PAYMENT',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  SWAPPING_TOKENS = 'SWAPPING_TOKENS',
  TOKENS_SWAPPED = 'TOKENS_SWAPPED',
  TELEPORT_INITIATED = 'TELEPORT_INITIATED',
  TELEPORTING = 'TELEPORTING',
  TELEPORT_CONFIRMED = 'TELEPORT_CONFIRMED',
  UPDATING_DDC = 'UPDATING_DDC',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum StablecoinTransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED'
}

export enum SwapTransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum TeleportTransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum DDCAccountUpdateStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface Payment {
  id: string;
  userId: string;
  status: PaymentStatus;
  amount: string;
  error?: string;
  stablecoinTransactions?: StablecoinTransaction[];
  swapTransactions?: SwapTransaction[];
  teleportTransactions?: TeleportTransaction[];
  ddcAccountUpdates?: DDCAccountUpdate[];
}

export interface StablecoinTransaction {
  id: string;
  paymentId: string;
  transactionHash: string;
  status: StablecoinTransactionStatus;
  blockNumber?: number;
  error?: string;
}

export interface SwapTransaction {
  id: string;
  paymentId: string;
  txHash: string;
  status: SwapTransactionStatus;
  blockNumber?: number;
  error?: string;
}

export interface TeleportTransaction {
  id: string;
  paymentId: string;
  teleportTxId: string;
  status: TeleportTransactionStatus;
  confirmedAt?: Date;
  error?: string;
}

export interface DDCAccountUpdate {
  id: string;
  paymentId: string;
  txHash: string;
  status: DDCAccountUpdateStatus;
  error?: string;
} 