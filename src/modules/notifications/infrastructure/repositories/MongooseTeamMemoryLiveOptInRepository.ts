
import {
  createHash,
} from "node:crypto";

import mongoose from "mongoose";

import {
  PushDeviceModel,
} from "../database/models/PushDeviceModel";

import {
  TeamMemoryLiveOptInModel,
} from "../database/models/TeamMemoryLiveOptInModel";

export class MongooseTeamMemoryLiveOptInRepository {

  private hashToken(token: string): string {
    return createHash("sha256")
      .update(token.trim())
      .digest("hex");
  }

  private parseOwnerId(
    ownerId: string
  ): mongoose.Types.ObjectId {

    if (!mongoose.isValidObjectId(ownerId)) {
      throw new Error("Invalid ownerId");
    }

    return new mongoose.Types.ObjectId(
      ownerId
    );
  }

  /*
   * El dispositivo debe pertenecer
   * al usuario autenticado y estar activo.
   */
  private async assertOwnership(
    ownerId: string,
    expoPushToken: string
  ): Promise<mongoose.Types.ObjectId> {

    const owner =
      this.parseOwnerId(ownerId);

    const token =
      expoPushToken.trim();

    if (!token) {
      throw new Error(
        "Invalid Expo push token"
      );
    }

    const exists =
      await PushDeviceModel.exists({
        ownerId: owner,
        expoPushToken: token,
        active: true,
      });

    if (!exists) {
      throw new Error(
        "Device does not belong to authenticated user"
      );
    }

    return owner;
  }

  /*
   * Consultar el consentimiento.
   * Si no existe, está desactivado.
   */
  public async getForOwner(
    ownerId: string,
    expoPushToken: string
  ): Promise<boolean> {

    const owner =
      await this.assertOwnership(
        ownerId,
        expoPushToken
      );

    const document =
      await TeamMemoryLiveOptInModel
        .findOne({
          ownerId: owner,
          recipientKey:
            this.hashToken(expoPushToken),
          enabled: true,
        })
        .lean()
        .exec();

    return document !== null;
  }

  /*
   * Activar o desactivar solo
   * dispositivos propios.
   *
   * El ownerId debe venir del JWT,
   * no del cuerpo de una petición.
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

    const owner =
      await this.assertOwnership(
        ownerId,
        expoPushToken
      );

    const recipientKey =
      this.hashToken(expoPushToken);

    await TeamMemoryLiveOptInModel
      .updateOne(
        {
          recipientKey,
        },
        {
          $set: {
            ownerId: owner,
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
   * Utilizado por el futuro
   * despachador Team Memory.
   *
   * Retorna solamente dispositivos:
   *
   * - activos
   * - del propietario solicitado
   * - con consentimiento vigente
   *
   * Un cambio de cuenta no hereda
   * permisos anteriores.
   */
  public async getEnabledTokensForOwner(
    ownerId: string,
    tokens: readonly string[]
  ): Promise<Set<string>> {

    const owner =
      this.parseOwnerId(ownerId);

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
          ownerId: owner,
          active: true,

          expoPushToken: {
            $in: uniqueTokens,
          },
        })
        .select({
          expoPushToken: 1,
          _id: 0,
        })
        .lean()
        .exec();

    const byHash =
      new Map<string, string>();

    for (const device of devices) {
      byHash.set(
        this.hashToken(
          device.expoPushToken
        ),
        device.expoPushToken
      );
    }

    if (byHash.size === 0) {
      return new Set();
    }

    const documents =
      await TeamMemoryLiveOptInModel
        .find({
          ownerId: owner,
          enabled: true,

          recipientKey: {
            $in: [...byHash.keys()],
          },
        })
        .select({
          recipientKey: 1,
          _id: 0,
        })
        .lean()
        .exec();

    const result =
      new Set<string>();

    for (const document of documents) {
      const token =
        byHash.get(
          document.recipientKey
        );

      if (token) {
        result.add(token);
      }
    }

    return result;
  }
}

