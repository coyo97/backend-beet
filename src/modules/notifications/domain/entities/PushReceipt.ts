export type PushReceiptStatus =
  | "pending"
  | "delivered"
  | "error"
  | "expired";

export interface PushReceipt {
  id: string;

  receiptId: string;

  expoPushToken: string;

  status: PushReceiptStatus;

  errorCode:
    string | null;

  errorMessage:
    string | null;

  sentAt: Date;

  nextCheckAt: Date;

  checkedAt:
    Date | null;

  attempts: number;

  createdAt: Date;

  updatedAt: Date;
}

export interface CreatePendingPushReceiptInput {
  receiptId: string;

  expoPushToken: string;

  sentAt: Date;

  nextCheckAt: Date;
}
