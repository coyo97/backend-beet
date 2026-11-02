
import mongoose from "mongoose";

import type {
  Request,
  Response,
} from "express";

import {
  PushDeviceModel,
} from "../../infrastructure/database/models/PushDeviceModel";

import {
  MongooseTeamMemoryLiveOptInRepository,
} from "../../infrastructure/repositories/MongooseTeamMemoryLiveOptInRepository";

export class TeamMemoryPushPreferencesController {

  constructor(
    private readonly repository =
      new MongooseTeamMemoryLiveOptInRepository()
  ) {}

  /*
   * Obtener el propietario autenticado.
   *
   * El ID debe venir del middleware JWT,
   * nunca del body enviado por el móvil.
   */
  private getOwnerId(
    res: Response
  ): string | null {

    const ownerId =
      res.locals.authUserId;

    if (
      typeof ownerId !== "string" ||
      !mongoose.isValidObjectId(ownerId)
    ) {
      return null;
    }

    return ownerId;
  }

  /*
   * GET
   * /notifications/team-memory-preferences
   *
   * Devuelve únicamente dispositivos
   * activos del usuario autenticado.
   */
  public list = async (
    _req: Request,
    res: Response
  ): Promise<void> => {

    const ownerId =
      this.getOwnerId(res);

    if (!ownerId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    try {

      const devices =
        await PushDeviceModel
          .find({
            ownerId:
              new mongoose.Types.ObjectId(
                ownerId
              ),

            active: true,
          })
          .select({
            _id: 1,
            expoPushToken: 1,
            platform: 1,
          })
          .lean()
          .exec();

      const result =
        await Promise.all(
          devices.map(async device => ({
            id: String(device._id),

            platform:
              device.platform,

            enabled:
              await this.repository.getForOwner(
                ownerId,
                device.expoPushToken
              ),
          }))
        );

      res.status(200).json({
        devices: result,
      });

    } catch (error) {

      console.error(
        "[TeamMemoryPushPreferences.list]",
        error
      );

      res.status(500).json({
        message:
          "Could not load Team Memory preferences",
      });
    }
  };

  /*
   * PATCH
   * /notifications/team-memory-preferences
   *
   * Body:
   * {
   *   deviceId: "...",
   *   enabled: true
   * }
   */
  public update = async (
    req: Request,
    res: Response
  ): Promise<void> => {

    const ownerId =
      this.getOwnerId(res);

    if (!ownerId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const {
      deviceId,
      enabled,
    } = req.body ?? {};

    if (
      typeof deviceId !== "string" ||
      !mongoose.isValidObjectId(deviceId) ||
      typeof enabled !== "boolean"
    ) {
      res.status(400).json({
        message:
          "Valid deviceId and enabled are required",
      });
      return;
    }

    try {

      /*
       * Solo permitir cambios sobre
       * dispositivos activos y propios.
       */
      const device =
        await PushDeviceModel
          .findOne({
            _id:
              new mongoose.Types.ObjectId(
                deviceId
              ),

            ownerId:
              new mongoose.Types.ObjectId(
                ownerId
              ),

            active: true,
          })
          .select({
            _id: 1,
            expoPushToken: 1,
            platform: 1,
          })
          .lean()
          .exec();

      if (!device) {
        res.status(404).json({
          message: "Device not found",
        });
        return;
      }

      const updated =
        await this.repository.setForOwner(
          ownerId,
          device.expoPushToken,
          enabled
        );

      res.status(200).json({
        device: {
          id: String(device._id),

          platform:
            device.platform,

          enabled:
            updated,
        },
      });

    } catch (error) {

      console.error(
        "[TeamMemoryPushPreferences.update]",
        error
      );

      res.status(500).json({
        message:
          "Could not update Team Memory preferences",
      });
    }
  };
}

