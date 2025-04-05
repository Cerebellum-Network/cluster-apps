/**
 * Modelo para mapeo de transacciones de Stripe
 * Parte de la implementación de la subtarea #4.4 - Implement Transaction Record Mapping and Reconciliation
 */

import { Schema, model, Document } from 'mongoose';

export enum StripeTransactionStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  DISPUTED = 'DISPUTED'
}

export enum StripeTransactionType {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  DISPUTE = 'DISPUTE'
}

export interface TransactionEventLog {
  timestamp: Date;
  eventType: string;
  status: string;
  data: Record<string, any>;
}

export interface StripeTransactionDocument extends Document {
  userId: string;
  paymentId: string;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  stripeRefundId?: string;
  stripeDisputeId?: string;
  amount: number;
  currency: string;
  status: StripeTransactionStatus;
  type: StripeTransactionType;
  metadata: Record<string, any>;
  paymentMethod: string;
  paymentMethodDetails?: Record<string, any>;
  description?: string;
  receiptUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  eventLog: TransactionEventLog[];
}

const stripeTransactionSchema = new Schema<StripeTransactionDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    stripeChargeId: {
      type: String,
      sparse: true,
      index: true
    },
    stripeRefundId: {
      type: String,
      sparse: true,
      index: true
    },
    stripeDisputeId: {
      type: String,
      sparse: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true,
      default: 'usd'
    },
    status: {
      type: String,
      enum: Object.values(StripeTransactionStatus),
      required: true,
      default: StripeTransactionStatus.CREATED
    },
    type: {
      type: String,
      enum: Object.values(StripeTransactionType),
      required: true,
      default: StripeTransactionType.PAYMENT
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    paymentMethod: {
      type: String,
      required: true
    },
    paymentMethodDetails: {
      type: Schema.Types.Mixed
    },
    description: {
      type: String
    },
    receiptUrl: {
      type: String
    },
    eventLog: [
      {
        timestamp: {
          type: Date,
          default: Date.now
        },
        eventType: {
          type: String,
          required: true
        },
        status: {
          type: String,
          required: true
        },
        data: {
          type: Schema.Types.Mixed,
          default: {}
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Índices adicionales para consultas comunes
stripeTransactionSchema.index({ createdAt: -1 });
stripeTransactionSchema.index({ updatedAt: -1 });
stripeTransactionSchema.index({ status: 1, createdAt: -1 });
stripeTransactionSchema.index({ userId: 1, status: 1 });

// Método para agregar un evento al registro de eventos
stripeTransactionSchema.methods.addEvent = function(
  eventType: string,
  status: string,
  data: Record<string, any> = {}
) {
  this.eventLog.push({
    timestamp: new Date(),
    eventType,
    status,
    data
  });
  this.status = status;
};

export const StripeTransaction = model<StripeTransactionDocument>('StripeTransaction', stripeTransactionSchema);

export default StripeTransaction; 