import type {
  CreatePendingPushReceiptInput,
  PushReceipt,
} from "../entities/PushReceipt";

export interface PushReceiptRepository {
  createPending(
    input:
      CreatePendingPushReceiptInput
  ): Promise<void>;

  findReady(
    now: Date,
    limit: number
  ): Promise<
    PushReceipt[]
  >;

  markDelivered(
    receiptId: string,
    checkedAt: Date
  ): Promise<void>;

  markError(
    receiptId: string,
    errorCode: string | null,
    errorMessage: string | null,
    checkedAt: Date
  ): Promise<void>;

  reschedule(
    receiptId: string,
    nextCheckAt: Date,
    checkedAt: Date
  ): Promise<void>;

  markExpired(
    receiptId: string,
    checkedAt: Date
  ): Promise<void>;
}
