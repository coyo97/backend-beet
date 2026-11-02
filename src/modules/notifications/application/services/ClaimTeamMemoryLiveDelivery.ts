
import {
  createHash,
} from "node:crypto";

import mongoose from "mongoose";

import {
  TeamMemoryLiveDeliveryModel,
  type TeamMemoryDeliveryStatus,
} from "../../infrastructure/database/models/TeamMemoryLiveDeliveryModel";

interface DeliveryIdentity {
  ownerId: string;
  matchKey: string;
  expoPushToken: string;
}

interface ClaimInput extends DeliveryIdentity {
  expiresAt: Date;
}

interface CompleteInput extends DeliveryIdentity {
  status: Exclude<
    TeamMemoryDeliveryStatus,
    "reserved"
  >;

  expoTicketId?: string | null;
  errorCode?: string | null;
}

export class ClaimTeamMemoryLiveDelivery {

  private recipientKey(
    token: string
  ): string {

    return createHash("sha256")
      .update(token.trim())
      .digest("hex");
  }

  private identity(
    input: DeliveryIdentity
  ) {

    if (
      !mongoose.isValidObjectId(
        input.ownerId
      )
    ) {
      throw new Error(
        "Invalid ownerId"
      );
    }

    const matchKey =
      input.matchKey.trim();

    const token =
      input.expoPushToken.trim();

    if (!matchKey) {
      throw new Error(
        "matchKey is required"
      );
    }

    if (
      !token.startsWith("ExpoPushToken[") &&
      !token.startsWith("ExponentPushToken[")
    ) {
      throw new Error(
        "Invalid Expo push token"
      );
    }

    return {
      ownerId:
        input.ownerId,

      matchKey,

      type:
        "TEAM_MEMORY_LIVE" as const,

      recipientKey:
        this.recipientKey(token),
    };
  }

  /*
   * Reservar antes de enviar.
   *
   * Solo una ejecución gana
   * el índice único de MongoDB.
   */
  public async claim(
    input: ClaimInput
  ): Promise<boolean> {

    const identity =
      this.identity(input);

    if (
      !Number.isFinite(
        input.expiresAt.getTime()
      ) ||
      input.expiresAt.getTime() <=
        Date.now()
    ) {
      throw new Error(
        "Invalid delivery expiration"
      );
    }

    try {
      await TeamMemoryLiveDeliveryModel
        .create({
          ...identity,

          status: "reserved",

          reservedAt:
            new Date(),

          completedAt: null,

          expoTicketId: null,
          errorCode: null,

          expiresAt:
            input.expiresAt,
        });

      return true;

    } catch (error) {

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return false;
      }

      throw error;
    }
  }

  /*
   * Completar únicamente
   * una reserva pendiente.
   *
   * accepted significa que Expo
   * aceptó el ticket, no que
   * el teléfono lo recibió.
   */
  public async complete(
    input: CompleteInput
  ): Promise<boolean> {

    const identity =
      this.identity(input);

    const result =
      await TeamMemoryLiveDeliveryModel
        .updateOne(
          {
            ...identity,
            status: "reserved",
          },
          {
            $set: {
              status:
                input.status,

              completedAt:
                new Date(),

              expoTicketId:
                input.expoTicketId ?? null,

              errorCode:
                input.errorCode ?? null,
            },
          }
        )
        .exec();

    return result.matchedCount === 1;
  }
}

