
import "dotenv/config";

import assert from "node:assert/strict";

import {
  randomUUID,
} from "node:crypto";

import mongoose from "mongoose";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  TeamMemoryLiveDeliveryModel,
} from "../src/modules/notifications/infrastructure/database/models/TeamMemoryLiveDeliveryModel";

import {
  ClaimTeamMemoryLiveDelivery,
} from "../src/modules/notifications/application/services/ClaimTeamMemoryLiveDelivery";

async function main() {

  const ownerA =
    new mongoose.Types.ObjectId().toString();

  const ownerB =
    new mongoose.Types.ObjectId().toString();

  const id = randomUUID();

  const matchKey =
    `test:team-memory:${id}`;

  const tokenA =
    `ExponentPushToken[TEST-A-${id}]`;

  const tokenB =
    `ExponentPushToken[TEST-B-${id}]`;

  const tokenC =
    `ExponentPushToken[TEST-C-${id}]`;

  const expiresAt =
    new Date(
      Date.now() + 48 * 60 * 60_000
    );

  await connectDatabase();

  try {

    await TeamMemoryLiveDeliveryModel.init();

    const service =
      new ClaimTeamMemoryLiveDelivery();

    const base = {
      ownerId: ownerA,
      matchKey,
      expoPushToken: tokenA,
      expiresAt,
    };

    console.log(
      "\n===== OCHO RESERVAS SIMULTÁNEAS ====="
    );

    const attempts =
      await Promise.all(
        Array.from(
          { length: 8 },
          () => service.claim(base)
        )
      );

    const acquired =
      attempts.filter(Boolean).length;

    assert.equal(acquired, 1);

    console.log({
      attempts: attempts.length,
      acquired,
      duplicatesPrevented:
        attempts.length - acquired,
    });

    const completed =
      await service.complete({
        ownerId: ownerA,
        matchKey,
        expoPushToken: tokenA,
        status: "accepted",
        expoTicketId: "FAKE-TICKET",
      });

    assert.equal(completed, true);

    const completedAgain =
      await service.complete({
        ownerId: ownerA,
        matchKey,
        expoPushToken: tokenA,
        status: "accepted",
        expoTicketId: "FAKE-TICKET-2",
      });

    assert.equal(completedAgain, false);

    console.log(
      "OK: reserva completada una sola vez"
    );

    /*
     * Segundo celular del mismo
     * usuario: debe poder reservar.
     */
    const secondDevice =
      await service.claim({
        ownerId: ownerA,
        matchKey,
        expoPushToken: tokenB,
        expiresAt,
      });

    assert.equal(secondDevice, true);

    /*
     * Otro propietario y otro
     * dispositivo: independiente.
     */
    const otherOwner =
      await service.claim({
        ownerId: ownerB,
        matchKey,
        expoPushToken: tokenC,
        expiresAt,
      });

    assert.equal(otherOwner, true);

    const records =
      await TeamMemoryLiveDeliveryModel
        .find({
          matchKey,
        })
        .lean()
        .exec();

    assert.equal(records.length, 3);

    console.log(
      "OK: múltiples dispositivos admitidos"
    );

    console.log(
      "OK: propietarios independientes"
    );

    console.log(
      "OK: índice único protegido"
    );

    console.log(
      "OK: ninguna llamada a Expo"
    );

    console.log(
      "\nPRUEBA SUPERADA"
    );

  } finally {

    await TeamMemoryLiveDeliveryModel
      .deleteMany({
        matchKey,
      });

    await disconnectDatabase();
  }
}

void main().catch(error => {

  console.error(
    "[TeamMemoryDeliveryClaimsTest]",
    error
  );

  process.exitCode = 1;
});

