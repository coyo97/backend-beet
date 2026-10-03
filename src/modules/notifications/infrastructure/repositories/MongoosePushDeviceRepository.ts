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
    input:
      RegisterPushDeviceInput
  ): Promise<
    PushDevice
  > {

    const now =
      new Date();

    const device =
      await PushDeviceModel
        .findOneAndUpdate(
          {
            expoPushToken:
              input.expoPushToken,
          },

          {
            $set: {
              platform:
                input.platform,

              active:
                true,

              lastSeenAt:
                now,
            },
          },

          {
            new:
              true,

            upsert:
              true,

            setDefaultsOnInsert:
              true,
          }
        )
        .exec();

    return this.toDomain(
      device
    );
  }

  public async findActive():
    Promise<
      PushDevice[]
    > {

    const devices =
      await PushDeviceModel
        .find({
          active:
            true,
        })
        .exec();

    return devices.map(
      (
        device
      ) =>
        this.toDomain(
          device
        )
    );
  }

  public async deactivate(
    expoPushToken:
      string
  ): Promise<void> {

    await PushDeviceModel
      .updateOne(
        {
          expoPushToken,
        },

        {
          $set: {
            active:
              false,
          },
        }
      )
      .exec();
  }

  private toDomain(
    device:
      PushDeviceDocument
  ): PushDevice {

    return {
      id:
        String(
          device._id
        ),

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
