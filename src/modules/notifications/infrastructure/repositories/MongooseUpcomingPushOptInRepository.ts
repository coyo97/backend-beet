
import {
  createHash,
} from "node:crypto";

import mongoose from "mongoose";

import {
  PushDeviceModel,
} from "../database/models/PushDeviceModel";

import {
  UpcomingPushOptInModel,
} from "../database/models/UpcomingPushOptInModel";

export class MongooseUpcomingPushOptInRepository {

  private hashToken(token: string): string {
    return createHash("sha256")
      .update(token.trim())
      .digest("hex");
  }

  /*
   * Confirmar que el dispositivo:
   *
   * - existe
   * - está activo
   * - pertenece al usuario
   */
  private async assertOwnership(
    ownerId: string,
    expoPushToken: string
  ): Promise<mongoose.Types.ObjectId> {

    if (!mongoose.isValidObjectId(ownerId)) {
      throw new Error(
        "Invalid ownerId"
      );
    }

    const token =
      expoPushToken.trim();

    if (!token) {
      throw new Error(
        "Invalid Expo push token"
      );
    }

    const ownerObjectId =
      new mongoose.Types.ObjectId(ownerId);

    const device =
      await PushDeviceModel.exists({
        expoPushToken: token,
        ownerId: ownerObjectId,
        active: true,
      });

    if (!device) {
      throw new Error(
        "Device does not belong to authenticated user"
      );
    }

    return ownerObjectId;
  }

  /*
   * Consultar el consentimiento
   * de un dispositivo propio.
   *
   * Sin documento = false.
   */
  public async getForOwner(
    ownerId: string,
    expoPushToken: string
  ): Promise<boolean> {

    const ownerObjectId =
      await this.assertOwnership(
        ownerId,
        expoPushToken
      );

    const document =
      await UpcomingPushOptInModel
        .findOne({
          recipientKey:
            this.hashToken(expoPushToken),

          ownerId: ownerObjectId,

          enabled: true,
        })
        .lean()
        .exec();

    return document !== null;
  }

  /*
   * Cambiar el consentimiento
   * de un dispositivo propio.
   *
   * Importante:
   * el ownerId deberá provenir
   * del JWT ya verificado.
   */
  public async setForOwner(
    ownerId: string,
    expoPushToken: string,
    enabled: boolean
  ): Promise<boolean> {

    if (typeof enabled !== "boolean") {
      throw new Error(
        "enabled must be boolean"
      );
    }

    const ownerObjectId =
      await this.assertOwnership(
        ownerId,
        expoPushToken
      );

    const recipientKey =
      this.hashToken(expoPushToken);

    /*
     * Una sola preferencia por token.
     *
     * Si cambia el propietario,
     * únicamente una acción explícita
     * del nuevo propietario puede
     * actualizar su consentimiento.
     */
    await UpcomingPushOptInModel
      .updateOne(
        {
          recipientKey,
        },
        {
          $set: {
            ownerId: ownerObjectId,
            enabled,
          },

          $setOnInsert: {
            recipientKey,
          },
        },
        {
          upsert: true,
        }
      )
      .exec();

    return enabled;
  }

  /*
   * Compatible con el despachador
   * que ya construimos.
   *
   * Solo devuelve tokens que:
   *
   * 1. Están activos.
   * 2. Tienen propietario.
   * 3. Tienen consentimiento.
   * 4. El consentimiento pertenece
   *    al propietario ACTUAL.
   */
  public async getEnabledTokens(
    tokens: readonly string[]
  ): Promise<Set<string>> {

    const uniqueTokens = [
      ...new Set(
        tokens
          .map(token => token.trim())
          .filter(Boolean)
      ),
    ];

    if (uniqueTokens.length === 0) {
      return new Set();
    }

    const devices =
      await PushDeviceModel
        .find({
          expoPushToken: {
            $in: uniqueTokens,
          },

          active: true,

          ownerId: {
            $ne: null,
          },
        })
        .select({
          expoPushToken: 1,
          ownerId: 1,
          _id: 0,
        })
        .lean()
        .exec();

    const deviceByHash =
      new Map<
        string,
        {
          token: string;
          ownerId: string;
        }
      >();

    for (const device of devices) {

      if (!device.ownerId) {
        continue;
      }

      deviceByHash.set(
        this.hashToken(
          device.expoPushToken
        ),
        {
          token:
            device.expoPushToken,

          ownerId:
            String(device.ownerId),
        }
      );
    }

    if (deviceByHash.size === 0) {
      return new Set();
    }

    const optIns =
      await UpcomingPushOptInModel
        .find({
          recipientKey: {
            $in: [...deviceByHash.keys()],
          },

          enabled: true,

          ownerId: {
            $ne: null,
          },
        })
        .select({
          recipientKey: 1,
          ownerId: 1,
          _id: 0,
        })
        .lean()
        .exec();

    const enabledTokens =
      new Set<string>();

    for (const optIn of optIns) {

      if (!optIn.ownerId) {
        continue;
      }

      const device =
        deviceByHash.get(
          optIn.recipientKey
        );

      if (
        device &&
        device.ownerId ===
          String(optIn.ownerId)
      ) {
        enabledTokens.add(
          device.token
        );
      }
    }

    return enabledTokens;
  }
}

