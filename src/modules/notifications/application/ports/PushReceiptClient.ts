export interface RemotePushReceipt {
  receiptId:
    string;

  status:
    | "ok"
    | "error";

  errorCode:
    string | null;

  message:
    string | null;
}

export interface PushReceiptClient {
  getReceipts(
    receiptIds:
      string[]
  ): Promise<
    Map<
      string,
      RemotePushReceipt
    >
  >;
}
