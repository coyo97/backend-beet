
import "dotenv/config";

import {
  createHash,
} from "node:crypto";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  PushDeviceModel,
} from "../src/modules/notifications/infrastructure/database/models/PushDeviceModel";

async function main() {

  await connectDatabase();

  try {

    const devices =
      await PushDeviceModel
        .find({})
        .sort({
          lastSeenAt: -1,
        })
        .select({
          _id: 1,
          ownerId: 1,
          expoPushToken: 1,
          platform: 1,
          active: 1,
          createdAt: 1,
          lastSeenAt: 1,
        })
        .lean()
        .exec();

    const groups =
      new Map<string, typeof devices>();

    for (const device of devices) {

      const owner =
        String(
          device.ownerId ??
          "SIN_PROPIETARIO"
        );

      const group =
        groups.get(owner) ?? [];

      group.push(device);

      groups.set(owner, group);
    }

    console.log(
      "\n===== DISPOSITIVOS POR CUENTA ====="
    );

    console.log({
      users: groups.size,
      totalDevices: devices.length,
    });

    for (const [owner, items] of groups) {

      console.log(
        "\nCUENTA:",
        owner === "SIN_PROPIETARIO"
          ? owner
          : `...${owner.slice(-8)}`
      );

      console.table(
        items.map(device => ({
          id:
            String(device._id).slice(-8),

          tokenRef:
            createHash("sha256")
              .update(
                device.expoPushToken
              )
              .digest("hex")
              .slice(0, 10),

          platform:
            device.platform,

          active:
            device.active,

          createdAt:
            device.createdAt
              ? new Date(
                  device.createdAt
                ).toISOString()
              : null,

          lastSeenAt:
            device.lastSeenAt
              ? new Date(
                  device.lastSeenAt
                ).toISOString()
              : null,
        }))
      );
    }

    console.log(
      "\nDIAGNÓSTICO TERMINADO"
    );

    console.log(
      "No se modificó ningún registro."
    );

  } finally {
    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

