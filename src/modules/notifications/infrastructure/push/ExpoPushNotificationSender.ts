import type {
  PushNotificationMessage,
  PushNotificationSender,
  PushSendResult,
} from "../../application/ports/PushNotificationSender";

interface ExpoPushTicket {
  status:
    | "ok"
    | "error";

  id?:
    string;

  message?:
    string;

  details?: {
    error?:
      string;
  };
}

interface ExpoPushResponse {
  data?:
    ExpoPushTicket[];

  errors?: Array<{
    code?:
      string;

    message?:
      string;
  }>;
}

export class ExpoPushNotificationSender
  implements PushNotificationSender
{
  private readonly endpoint =
    "https://exp.host/--/api/v2/push/send";

  private readonly chunkSize =
    100;

  public async send(
    messages:
      PushNotificationMessage[]
  ): Promise<
    PushSendResult[]
  > {

    if (
      messages.length ===
      0
    ) {
      return [];
    }

    const results:
      PushSendResult[] =
        [];

    for (
      let index = 0;
      index <
      messages.length;
      index +=
        this.chunkSize
    ) {
      const chunk =
        messages.slice(
          index,
          index +
            this.chunkSize
        );

      const chunkResults =
        await this.sendChunk(
          chunk
        );

      results.push(
        ...chunkResults
      );
    }

    return results;
  }

  private async sendChunk(
    messages:
      PushNotificationMessage[]
  ): Promise<
    PushSendResult[]
  > {

    let lastError:
      unknown;

    for (
      let attempt = 0;
      attempt < 3;
      attempt += 1
    ) {
      try {
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
                JSON.stringify(
                  messages
                ),
            }
          );

        if (
          response.status ===
            429 ||
          response.status >=
            500
        ) {
          throw new Error(
            `Expo Push temporary error: HTTP ${response.status}`
          );
        }

        const body =
          await response
            .json() as
            ExpoPushResponse;

        if (
          !response.ok
        ) {
          throw new Error(
            body.errors
              ?.map(
                (
                  item
                ) =>
                  item.message
              )
              .filter(
                Boolean
              )
              .join("; ") ||
            `Expo Push HTTP ${response.status}`
          );
        }

        const tickets =
          Array.isArray(
            body.data
          )
            ? body.data
            : [];

        return messages.map(
          (
            message,
            ticketIndex
          ) => {

            const ticket =
              tickets[
                ticketIndex
              ];

            if (!ticket) {
              return {
                token:
                  message.to,

                status:
                  "error",

                message:
                  "Expo returned no ticket",
              };
            }

            if (
              ticket.status ===
              "ok"
            ) {
              return {
                token:
                  message.to,

                status:
                  "ok",

                receiptId:
                  ticket.id,
              };
            }

            return {
              token:
                message.to,

              status:
                "error",

              errorCode:
                ticket.details
                  ?.error,

              message:
                ticket.message,
            };
          }
        );
      } catch (error) {
        lastError =
          error;

        if (
          attempt <
          2
        ) {
          await this.sleep(
            500 *
              2 **
                attempt
          );

          continue;
        }
      }
    }

    console.error(
      "[ExpoPush] request failed",
      lastError
    );

    return messages.map(
      (
        message
      ) => ({
        token:
          message.to,

        status:
          "error",

        message:
          lastError instanceof
            Error
            ? lastError.message
            : "Unknown Expo Push error",
      })
    );
  }

  private sleep(
    milliseconds:
      number
  ): Promise<void> {

    return new Promise(
      (
        resolve
      ) => {
        setTimeout(
          resolve,
          milliseconds
        );
      }
    );
  }
}
