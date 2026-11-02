
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
  PushDeviceModel,
} from "../src/modules/notifications/infrastructure/database/models/PushDeviceModel";

import {
  TeamMemoryLiveOptInModel,
} from "../src/modules/notifications/infrastructure/database/models/TeamMemoryLiveOptInModel";

import {
  TeamMemoryLiveDeliveryModel,
} from "../src/modules/notifications/infrastructure/database/models/TeamMemoryLiveDeliveryModel";

import {
  MongoosePushDeviceRepository,
} from "../src/modules/notifications/infrastructure/repositories/MongoosePushDeviceRepository";

import {
  MongooseTeamMemoryLiveOptInRepository,
} from "../src/modules/notifications/infrastructure/repositories/MongooseTeamMemoryLiveOptInRepository";

import {
  ClaimTeamMemoryLiveDelivery,
} from "../src/modules/notifications/application/services/ClaimTeamMemoryLiveDelivery";

import {
  DispatchTeamMemoryLiveAlerts,
} from "../src/modules/notifications/application/services/DispatchTeamMemoryLiveAlerts";

import type {
  OwnerTeamMemoryLiveAlert,
} from "../src/modules/notifications/application/services/FindTeamMemoryLiveAlerts";

import type {
  PushNotificationSender,
} from "../src/modules/notifications/application/ports/PushNotificationSender";

async function main() {

  const ownerA =
    new mongoose.Types.ObjectId();

  const ownerB =
    new mongoose.Types.ObjectId();

  const id = randomUUID();

  const tokenA =
    `ExponentPushToken[TEST-A-${id}]`;

  const tokenB =
    `ExponentPushToken[TEST-B-${id}]`;

  const matchKey =
    `test:team-memory:${id}`;

  let fakeMessages = 0;

  const fakeSender: PushNotificationSender = {
    send: async messages => {
      fakeMessages += messages.length;

      return messages.map(
        message => ({
          token: message.to,
          status: "ok" as const,
          receiptId: "FAKE-TICKET",
        })
      );
    },
  };

  await connectDatabase();

  try {

    await PushDeviceModel.init();
    await TeamMemoryLiveOptInModel.init();
    await TeamMemoryLiveDeliveryModel.init();

    await PushDeviceModel.create([
      {
        ownerId: ownerA,
        expoPushToken: tokenA,
        platform: "android",
        active: true,
        lastSeenAt: new Date(),
      },
      {
        ownerId: ownerB,
        expoPushToken: tokenB,
        platform: "android",
        active: true,
        lastSeenAt: new Date(),
      },
    ]);

    const devices =
      new MongoosePushDeviceRepository();

    const optIns =
      new MongooseTeamMemoryLiveOptInRepository();

    const claims =
      new ClaimTeamMemoryLiveDelivery();

    /*
     * Solo A autoriza Team Memory.
     */
    await optIns.setForOwner(
      ownerA.toString(),
      tokenA,
      true
    );

    /*
     * Preferencias generales falsas
     * para no alterar configuraciones
     * reales de otros usuarios.
     */
    const preferences = {
      get: async (ownerId: string) => ({
        enabled:
          ownerId === ownerA.toString(),
      }),
    };

    const makeAlert = (
      ownerId: string
    ): OwnerTeamMemoryLiveAlert => ({
      ownerId,
      matchKey,
      type: "TEAM_MEMORY_LIVE",
      teamName: "Palmeiras",
      opponentName: "Santos",
      wins: 2,
      losses: 1,
      previousOpponentWins: 1,
      previousOpponentLosses: 0,
      title: "🧠 Palmeiras está jugando",
      body:
        "Palmeiras vs Santos. En tu historial te hizo ganar 2 veces.",
    });

    const alerts = [
      makeAlert(ownerA.toString()),
      makeAlert(ownerB.toString()),
    ];

    /*
     * Primera prueba:
     * el envío permanece bloqueado
     * aunque se solicite send:true.
     */
    const safeDispatcher =
      new DispatchTeamMemoryLiveAlerts(
        devices,
        preferences,
        optIns,
        claims,
        fakeSender
      );

    const preview =
      await safeDispatcher.execute(
        alerts,
        { send: true }
      );

    assert.equal(preview.eligible, 1);
    assert.equal(preview.claimed, 0);
    assert.equal(preview.attempted, 0);
    assert.equal(fakeMessages, 0);

    console.log(
      "\n===== PREVIEW SEGURO ====="
    );

    console.table(preview);

    /*
     * Segunda prueba:
     * autorizar únicamente nuestro
     * emisor FALSO de pruebas.
     */
    const testDispatcher =
      new DispatchTeamMemoryLiveAlerts(
        devices,
        preferences,
        optIns,
        claims,
        fakeSender,
        true
      );

    const [first, second] =
      await Promise.all([
        testDispatcher.execute(
          alerts,
          { send: true }
        ),

        testDispatcher.execute(
          alerts,
          { send: true }
        ),
      ]);

    console.log(
      "\n===== DESPACHOS SIMULTÁNEOS ====="
    );

    console.table({
      totalClaims:
        first.claimed + second.claimed,

      duplicates:
        first.duplicates + second.duplicates,

      accepted:
        first.accepted + second.accepted,

      fakeMessages,
    });

    assert.equal(
      first.claimed + second.claimed,
      1
    );

    assert.equal(
      first.duplicates + second.duplicates,
      1
    );

    assert.equal(
      first.accepted + second.accepted,
      1
    );

    assert.equal(fakeMessages, 1);

    const records =
      await TeamMemoryLiveDeliveryModel
        .find({ matchKey })
        .lean()
        .exec();

    assert.equal(records.length, 1);
    assert.equal(
      records[0].status,
      "accepted"
    );

    assert.equal(
      records[0].expoTicketId,
      "FAKE-TICKET"
    );

    console.log(
      "\nOK: consentimiento respetado"
    );

    console.log(
      "OK: preferencias generales respetadas"
    );

    console.log(
      "OK: solo dispositivos propios"
    );

    console.log(
      "OK: despachos simultáneos protegidos"
    );

    console.log(
      "OK: ninguna llamada real a Expo"
    );

    console.log(
      "\nPRUEBA SUPERADA"
    );

  } finally {

    await TeamMemoryLiveDeliveryModel
      .deleteMany({ matchKey });

    await TeamMemoryLiveOptInModel
      .deleteMany({
        ownerId: {
          $in: [ownerA, ownerB],
        },
      });

    await PushDeviceModel
      .deleteMany({
        expoPushToken: {
          $in: [tokenA, tokenB],
        },
      });

    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(
    "[TeamMemoryDispatcherTest]",
    error
  );

  process.exitCode = 1;
});

