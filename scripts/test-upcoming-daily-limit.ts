
import "dotenv/config";

import assert from "node:assert/strict";
import { Types } from "mongoose";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  MongooseUpcomingDailyLimitRepository,
} from "../src/modules/notifications/infrastructure/repositories/MongooseUpcomingDailyLimitRepository";

import {
  UpcomingDailyUsageModel,
  UpcomingDailyPolicyModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingDailyNotificationModels";

import {
  ClaimUpcomingReminderDelivery,
} from "../src/modules/notifications/application/services/ClaimUpcomingReminderDelivery";

import {
  UpcomingReminderDeliveryModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingReminderDeliveryModel";

async function main(): Promise<void> {

  /*
   * IDs nuevos para pruebas.
   * No corresponden a usuarios reales.
   */
  const ownerA = new Types.ObjectId().toHexString();
  const ownerB = new Types.ObjectId().toHexString();
  const ownerC = new Types.ObjectId().toHexString();

  const owners = [ownerA, ownerB, ownerC];

  const matchKey =
    `TEST-UPCOMING-${new Types.ObjectId().toHexString()}`;

  await connectDatabase();

  try {

    await UpcomingDailyUsageModel.init();
    await UpcomingReminderDeliveryModel.init();

    const limits =
      new MongooseUpcomingDailyLimitRepository();

    const claims =
      new ClaimUpcomingReminderDelivery();

    console.log("===== PRUEBA 1: VALOR INICIAL =====");

    const initial =
      await limits.getUsage(ownerA);

    assert.equal(initial.limit, 8);
    assert.equal(initial.used, 0);

    console.log("OK: 8 avisos por defecto");

    console.log("===== PRUEBA 2: DOS TELEFONOS =====");

    const first =
      await limits.tryReserve(
        ownerA,
        matchKey,
        "24h"
      );

    const second =
      await limits.tryReserve(
        ownerA,
        matchKey,
        "24h"
      );

    assert.equal(first, true);
    assert.equal(second, true);

    let usage =
      await limits.getUsage(ownerA);

    assert.equal(usage.used, 1);

    console.log(
      "OK: el mismo evento consume un solo cupo"
    );

    console.log("===== PRUEBA 3: VENTANAS =====");

    const differentWindow =
      await limits.tryReserve(
        ownerA,
        matchKey,
        "60m"
      );

    assert.equal(differentWindow, true);

    usage = await limits.getUsage(ownerA);

    assert.equal(usage.used, 2);

    console.log(
      "OK: 24h y 60m son avisos diferentes"
    );

    console.log("===== PRUEBA 4: LIMITE DE OCHO =====");

    for (let i = 3; i <= 8; i++) {
      const accepted =
        await limits.tryReserve(
          ownerA,
          `${matchKey}-${i}`,
          "24h"
        );

      assert.equal(accepted, true);
    }

    const ninth =
      await limits.tryReserve(
        ownerA,
        `${matchKey}-9`,
        "24h"
      );

    assert.equal(ninth, false);

    usage = await limits.getUsage(ownerA);

    assert.equal(usage.used, 8);
    assert.equal(usage.remaining, 0);

    console.log(
      "OK: noveno aviso rechazado"
    );

    console.log("===== PRUEBA 5: CONCURRENCIA =====");

    const attempts =
      await Promise.all(
        Array.from(
          { length: 20 },
          (_, index) =>
            limits.tryReserve(
              ownerB,
              `${matchKey}-concurrent-${index}`,
              "24h"
            )
        )
      );

    const acceptedCount =
      attempts.filter(Boolean).length;

    const rejectedCount =
      attempts.length - acceptedCount;

    assert.equal(acceptedCount, 8);
    assert.equal(rejectedCount, 12);

    console.log({
      acceptedCount,
      rejectedCount,
    });

    console.log("===== PRUEBA 6: CUENTAS INDEPENDIENTES =====");

    const otherAccount =
      await limits.tryReserve(
        ownerC,
        matchKey,
        "24h"
      );

    assert.equal(otherAccount, true);

    const otherUsage =
      await limits.getUsage(ownerC);

    assert.equal(otherUsage.used, 1);

    console.log(
      "OK: una cuenta no consume cupos de otra"
    );

    console.log("===== PRUEBA 7: DEDUPLICACION POR TOKEN =====");

    const expiresAt =
      new Date(Date.now() + 3600000);

    const phoneA =
      await claims.claim({
        matchKey,
        window: "24h",
        expoPushToken: "ExpoPushToken[TEST-A]",
        expiresAt,
      });

    const phoneB =
      await claims.claim({
        matchKey,
        window: "24h",
        expoPushToken: "ExpoPushToken[TEST-B]",
        expiresAt,
      });

    const repeatedPhoneA =
      await claims.claim({
        matchKey,
        window: "24h",
        expoPushToken: "ExpoPushToken[TEST-A]",
        expiresAt,
      });

    assert.equal(phoneA, true);
    assert.equal(phoneB, true);
    assert.equal(repeatedPhoneA, false);

    console.log(
      "OK: dos telefonos, sin duplicar el mismo token"
    );

    console.log(
      "TODAS LAS PRUEBAS SUPERADAS"
    );

  } finally {

    /*
     * Limpiar exclusivamente
     * los datos sinteticos.
     *
     * No modificar cuentas reales.
     */
    try {
      await UpcomingDailyUsageModel.deleteMany({
        ownerId: { $in: owners },
      }).exec();

      await UpcomingDailyPolicyModel.deleteMany({
        ownerId: { $in: owners },
      }).exec();

      await UpcomingReminderDeliveryModel.deleteMany({
        matchKey,
      }).exec();

      console.log(
        "Datos de prueba eliminados"
      );

    } finally {
      await disconnectDatabase();
    }
  }
}

void main().catch(error => {
  console.error(
    "TEST FAILED:",
    error instanceof Error
      ? error.message
      : error
  );

  process.exitCode = 1;
});

