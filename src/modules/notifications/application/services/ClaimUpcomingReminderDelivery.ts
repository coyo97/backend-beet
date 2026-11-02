
import {
  createHash,
} from "node:crypto";

import type {
  UpcomingReminderWindow,
} from "../../infrastructure/database/models/UpcomingReminderModel";

import {
  UpcomingReminderDeliveryModel,
  type UpcomingDeliveryStatus,
} from "../../infrastructure/database/models/UpcomingReminderDeliveryModel";

export interface ClaimUpcomingDeliveryInput {
  matchKey: string;
  window: UpcomingReminderWindow;

  expoPushToken: string;
  expiresAt: Date;
}

export interface CompleteUpcomingDeliveryInput {
  matchKey: string;
  window: UpcomingReminderWindow;

  expoPushToken: string;

  status:
    Exclude<
      UpcomingDeliveryStatus,
      "reserved"
    >;

  expoTicketId?: string | null;
  errorCode?: string | null;
}

export class ClaimUpcomingReminderDelivery {

  private recipientKey(
    expoPushToken: string
  ): string {

    return createHash("sha256")
      .update(expoPushToken.trim())
      .digest("hex");
  }

  /*
   * Devuelve true únicamente
   * cuando este proceso consiguió
   * crear la reserva.
   *
   * Si ya existe, devuelve false.
   */
  public async claim(
    input: ClaimUpcomingDeliveryInput
  ): Promise<boolean> {

    const matchKey =
      input.matchKey.trim();

    const token =
      input.expoPushToken.trim();

    if (
      !matchKey ||
      !token ||
      !["24h", "60m"].includes(
        input.window
      )
    ) {
      throw new Error(
        "Invalid delivery claim"
      );
    }

    if (
      !Number.isFinite(
        input.expiresAt.getTime()
      ) ||
      input.expiresAt.getTime() <=
        Date.now()
    ) {
      return false;
    }

    try {

      /*
       * create() + índice único:
       *
       * MongoDB garantiza que
       * solamente una inserción
       * tendrá éxito.
       *
       * Nunca consultar primero
       * y luego insertar.
       */
      await UpcomingReminderDeliveryModel
        .create({
          matchKey,

          window:
            input.window,

          recipientKey:
            this.recipientKey(token),

          status:
            "reserved",

          reservedAt:
            new Date(),

          completedAt:
            null,

          expoTicketId:
            null,

          errorCode:
            null,

          expiresAt:
            input.expiresAt,
        });

      return true;

    } catch (error) {

      /*
       * E11000:
       * otra reserva ya existe.
       */
      const duplicate =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000;

      if (duplicate) {
        return false;
      }

      throw error;
    }
  }

  /*
   * Se utilizará después de
   * intentar el envío a Expo.
   *
   * Solo permite completar
   * una reserva pendiente.
   */
  public async complete(
    input: CompleteUpcomingDeliveryInput
  ): Promise<boolean> {

    const result =
      await UpcomingReminderDeliveryModel
        .updateOne(
          {
            matchKey:
              input.matchKey.trim(),

            window:
              input.window,

            recipientKey:
              this.recipientKey(
                input.expoPushToken
              ),

            status:
              "reserved",
          },
          {
            $set: {
              status:
                input.status,

              completedAt:
                new Date(),

              expoTicketId:
                input.expoTicketId ??
                null,

              errorCode:
                input.errorCode ??
                null,
            },
          }
        )
        .exec();

    return (
      result.modifiedCount === 1
    );
  }
}

