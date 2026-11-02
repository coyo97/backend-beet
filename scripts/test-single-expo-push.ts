
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

import {
  ExpoPushNotificationSender,
} from "../src/modules/notifications/infrastructure/push/ExpoPushNotificationSender";

async function main(): Promise<void> {

  /*
   * Dos identificadores obligatorios:
   *
   * 1. Sufijo del propietario.
   * 2. Referencia SHA-256 del token.
   *
   * Ambos deben coincidir exactamente.
   */
  const ownerSuffix = process.argv[2];
  const tokenRef = process.argv[3];

  if (
    !/^[0-9a-f]{8}$/i.test(ownerSuffix ?? "") ||
    !/^[0-9a-f]{10}$/i.test(tokenRef ?? "")
  ) {
    throw new Error(
      "Uso: npx tsx scripts/test-single-expo-push.ts " +
      "<ownerSuffix> <tokenRef>"
    );
  }

  await connectDatabase();

  try {

    const devices =
      await PushDeviceModel
        .find({
          active: true,
          ownerId: { $ne: null },
        })
        .select({
          ownerId: 1,
          expoPushToken: 1,
        })
        .lean()
        .exec();

    const matches =
      devices.filter(device => {

        const owner =
          String(device.ownerId ?? "");

        const hash =
          createHash("sha256")
            .update(device.expoPushToken)
            .digest("hex")
            .slice(0, 10);

        return (
          owner.toLowerCase().endsWith(
            ownerSuffix!.toLowerCase()
          ) &&
          hash === tokenRef!.toLowerCase()
        );
      });

    if (matches.length !== 1) {
      throw new Error(
        `Se esperaban 1 dispositivo, encontrados: ${matches.length}. ` +
        "No se enviaron notificaciones."
      );
    }

    const device = matches[0];

    console.log(
      "[Push Test] Un dispositivo seleccionado."
    );

    const sender =
      new ExpoPushNotificationSender();

    /*
     * Envío real, exclusivamente
     * al dispositivo seleccionado.
     */
    const results =
      await sender.send([
        {
          to: device.expoPushToken,

          title: "⚽ Football Radar",

          body:
            "Prueba de notificación remota. " +
            "Tu teléfono está conectado a Football Radar.",

          sound: "default",

          channelId: "radar-alerts",

          data: {
            type: "OPEN_ALERTS",
            test: true,
          },
        },
      ]);

    const result = results[0];

    console.log("[Push Test] Resultado:", {
      status: result?.status ?? "no-response",
      receiptId: result?.receiptId ?? null,
      errorCode: result?.errorCode ?? null,
    });

  } finally {
    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(
    "[Push Test] Error:",
    error instanceof Error
      ? error.message
      : "Error desconocido"
  );

  process.exitCode = 1;
});

