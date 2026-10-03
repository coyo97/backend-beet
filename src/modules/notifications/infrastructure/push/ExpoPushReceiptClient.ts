import type {
  PushReceiptClient,
  RemotePushReceipt,
} from "../../application/ports/PushReceiptClient";

interface ExpoReceipt {
  status:
    | "ok"
    | "error";

  message?:
    string;

  details?: {
    error?:
      string;
  };
}

interface ExpoReceiptResponse {
  data?: Record<
    string,
    ExpoReceipt
  >;

  errors?: Array<{
    code?:
      string;

    message?:
      string;
  }>;
}

export class ExpoPushReceiptClient
  implements PushReceiptClient
{
  private readonly endpoint =
    "https://exp.host/--/api/v2/push/getReceipts";

  public async getReceipts(
    receiptIds:
      string[]
  ): Promise<
    Map<
      string,
      RemotePushReceipt
    >
  > {

    if (
      receiptIds.length ===
      0
    ) {
      return new Map();
    }

    if (
      receiptIds.length >
      1000
    ) {
      throw new Error(
        "Expo allows at most 1000 receipt IDs per request"
      );
    }

    const response =
      await fetch(
        this.endpoint,
        {
          method:
            "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              ids:
                receiptIds,
            }),
        }
      );

    const body =
      await response
        .json() as
        ExpoReceiptResponse;

    if (
      !response.ok
    ) {
      throw new Error(
        body.errors
          ?.map(
            (
              error
            ) =>
              error.message
          )
          .filter(
            Boolean
          )
          .join("; ") ||
        `Expo receipt HTTP ${response.status}`
      );
    }

    const result =
      new Map<
        string,
        RemotePushReceipt
      >();

    for (
      const [
        receiptId,
        receipt,
      ] of Object.entries(
        body.data ?? {}
      )
    ) {
      result.set(
        receiptId,
        {
          receiptId,

          status:
            receipt.status,

          errorCode:
            receipt.details
              ?.error ??
            null,

          message:
            receipt.message ??
            null,
        }
      );
    }

    return result;
  }
}
