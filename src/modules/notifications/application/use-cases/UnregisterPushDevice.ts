
import mongoose from "mongoose";

import type {
  PushDeviceRepository,
} from "../../domain/repositories/PushDeviceRepository";

export interface UnregisterPushDeviceInput {
  ownerId: string;

  expoPushToken: string;
}

export class UnregisterPushDevice {
  constructor(
    private readonly repository:
      PushDeviceRepository
  ) {}

  public async execute(
    input: UnregisterPushDeviceInput
  ): Promise<void> {

    if (
      !mongoose.isValidObjectId(
        input.ownerId
      )
    ) {
      throw new Error(
        "Invalid ownerId"
      );
    }

    const expoPushToken =
      input.expoPushToken?.trim();

    if (
      typeof expoPushToken !== "string" ||
      !(
        expoPushToken.startsWith(
          "ExponentPushToken["
        ) ||
        expoPushToken.startsWith(
          "ExpoPushToken["
        )
      ) ||
      !expoPushToken.endsWith("]")
    ) {
      throw new Error(
        "Invalid Expo push token"
      );
    }

    await this.repository
      .deactivateForOwner(
        input.ownerId,
        expoPushToken
      );
  }
}

