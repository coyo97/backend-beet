
import mongoose from "mongoose";

import type {
  Request,
  Response,
} from "express";

import {
  PushDeviceModel,
} from "../../infrastructure/database/models/PushDeviceModel";

import {
  MongooseUpcomingPushOptInRepository,
} from "../../infrastructure/repositories/MongooseUpcomingPushOptInRepository";

export class UpcomingPushPreferencesController {

  constructor(
    private readonly optIns =
      new MongooseUpcomingPushOptInRepository()
  ) {}

  /*
   * La identidad proviene exclusivamente
   * del JWT verificado por requireAuth.
   *
   * Nunca usar:
   * - req.body.ownerId
   * - req.query.ownerId
   * - x-football-radar-owner-id
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
   * GET /notifications/upcoming-preferences
   *
   * Devuelve dispositivos propios y
   * su consentimiento actual.
   *
   * No expone tokens Expo.
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
          devices.map(
            async device => ({
              id:
                String(device._id),

              platform:
                device.platform,

              enabled:
                await this.optIns.getForOwner(
                  ownerId,
                  device.expoPushToken
                ),
            })
          )
        );

      res.status(200).json({
        devices: result,
      });

    } catch (error) {
      console.error(
        "[UpcomingPushPreferences.list]",
        error
      );

      res.status(500).json({
        message:
          "Could not load upcoming preferences",
      });
    }
  };

  /*
   * PATCH /notifications/upcoming-preferences
   *
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
       * Buscar el dispositivo usando
       * simultáneamente:
       *
       * - ID del dispositivo
       * - propietario autenticado
       * - estado activo
       *
       * Esto impide modificar
       * dispositivos de otra cuenta.
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
          message:
            "Device not found",
        });
        return;
      }

      const updated =
        await this.optIns.setForOwner(
          ownerId,
          device.expoPushToken,
          enabled
        );

      res.status(200).json({
        device: {
          id:
            String(device._id),

          platform:
            device.platform,

          enabled:
            updated,
        },
      });

    } catch (error) {
      console.error(
        "[UpcomingPushPreferences.update]",
        error
      );

      res.status(500).json({
        message:
          "Could not update upcoming preferences",
      });
    }
  };
}

