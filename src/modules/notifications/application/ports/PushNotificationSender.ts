export type PushNotificationData =
  Record<
    string,
    string |
    number |
    boolean |
    null
  >;

export interface PushNotificationMessage {
  to: string;

  title: string;

  body: string;

  sound?: "default";

  channelId?: string;

  data?: PushNotificationData;
}

export interface PushSendResult {
  token: string;

  status:
    | "ok"
    | "error";

  receiptId?:
    string;

  errorCode?:
    string;

  message?:
    string;
}

export interface PushNotificationSender {
  send(
    messages:
      PushNotificationMessage[]
  ): Promise<
    PushSendResult[]
  >;
}
