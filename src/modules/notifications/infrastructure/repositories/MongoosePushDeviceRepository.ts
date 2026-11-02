
import mongoose from "mongoose";

import type {
  PushDevice,
  RegisterPushDeviceInput,
} from "../../domain/entities/PushDevice";

import type {
  PushDeviceRepository,
} from "../../domain/repositories/PushDeviceRepository";

import {
  PushDeviceModel,
  type PushDeviceDocument,
} from "../database/models/PushDeviceModel";

export class MongoosePushDeviceRepository
  implements PushDeviceRepository
{
  public async register(
    input: RegisterPushDeviceInput
  ): Promise<PushDevice> {

    if (
      !mongoose.isValidObjectId(
        input.ownerId
      )
    ) {
      throw new Error(
        "Invalid device ownerId"
      );
    }

    const ownerId =
      new mongoose.Types.ObjectId(
        input.ownerId
      );

    const now = new Date();

    /*
     * Un token pertenece a un
     * usuario autenticado.
     *
     * Si el mismo celular cambia
     * de cuenta, actualizamos
     * su propietario.
     */
    const device =
      await PushDeviceModel
        .findOneAndUpdate(
          {
            expoPushToken:
              input.expoPushToken,
          },
          {
            $set: {
              ownerId,

              platform:
                input.platform,

              active:
                true,

              lastSeenAt:
                now,
            },
          },
          {
            new: true,

            upsert: true,

            setDefaultsOnInsert:
              true,
          }
        )
        .exec();

    return this.toDomain(
      device
    );
  }

  /*
   * Buscar solo los dispositivos
   * activos de un usuario.
   */
  public async findActiveByOwner(
    ownerId: string
  ): Promise<PushDevice[]> {

    if (
      !mongoose.isValidObjectId(
        ownerId
      )
    ) {
      return [];
    }

    const devices =
      await PushDeviceModel
        .find({
          ownerId:
            new mongoose.Types.ObjectId(
              ownerId
            ),

          active:
            true,
        })
        .exec();

    return devices.map(
      device =>
        this.toDomain(device)
    );
  }

  /*
   * Método antiguo.
   *
   * Lo mantendremos hasta
   * migrar los publicadores
   * de Watchlist.
   *
   * No debe utilizarse para
   * nuevas notificaciones
   * personales.
   */
  public async findActive():
    Promise<PushDevice[]> {

    const devices =
      await PushDeviceModel
        .find({
          active: true,
        })
        .exec();

    return devices.map(
      device =>
        this.toDomain(device)
    );
  }


  /*
   * Desvincular un dispositivo
   * durante el cierre de sesión.
   *
   * Solo modifica registros que
   * pertenecen al usuario del JWT.
   */
  public async deactivateForOwner(
    ownerId: string,
    expoPushToken: string
  ): Promise<void> {

    if (
      !mongoose.isValidObjectId(ownerId)
    ) {
      throw new Error(
        "Invalid device ownerId"
      );
    }

    await PushDeviceModel
      .updateOne(
        {
          ownerId:
            new mongoose.Types.ObjectId(
              ownerId
            ),

          expoPushToken,
        },
        {
          $set: {
            active: false,
          },
        }
      )
      .exec();
  }


  public async deactivate(
    expoPushToken: string
  ): Promise<void> {

    await PushDeviceModel
      .updateOne(
        {
          expoPushToken,
        },
        {
          $set: {
            active: false,
          },
        }
      )
      .exec();
  }

  private toDomain(
    device: PushDeviceDocument
  ): PushDevice {

    return {
      id:
        String(device._id),

      ownerId:
        device.ownerId
          ? String(device.ownerId)
          : null,

      expoPushToken:
        device.expoPushToken,

      platform:
        device.platform,

      active:
        device.active,

      lastSeenAt:
        device.lastSeenAt
          .toISOString(),

      createdAt:
        device.createdAt
          .toISOString(),

      updatedAt:
        device.updatedAt
          .toISOString(),
    };
  }
}

