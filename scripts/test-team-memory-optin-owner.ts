
import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  MongooseTeamMemoryLiveOptInRepository,
} from "../src/modules/notifications/infrastructure/repositories/MongooseTeamMemoryLiveOptInRepository";

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

  await connectDatabase();

  const repository =
    new MongooseTeamMemoryLiveOptInRepository();

  try {

    await PushDeviceModel.init();
    await TeamMemoryLiveOptInModel.init();

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

    console.log(
      "\n===== CONSENTIMIENTO INICIAL ====="
    );

    assert.equal(
      await repository.getForOwner(
        ownerA.toString(),
        tokenA
      ),
      false
    );

    console.log(
      "OK: desactivado por defecto"
    );

    /*
     * A autoriza su dispositivo.
     */
    await repository.setForOwner(
      ownerA.toString(),
      tokenA,
      true
    );

    assert.equal(
      await repository.getForOwner(
        ownerA.toString(),
        tokenA
      ),
      true
    );

    console.log(
      "OK: autorización explícita"
    );

    /*
     * A no puede autorizar
     * el dispositivo de B.
     */
    await assert.rejects(
      repository.setForOwner(
        ownerA.toString(),
        tokenB,
        true
      ),
      /does not belong/
    );

    console.log(
      "OK: otro propietario rechazado"
    );

    /*
     * Cada usuario solo recibe
     * sus dispositivos autorizados.
     */
    const enabledA =
      await repository
        .getEnabledTokensForOwner(
          ownerA.toString(),
          [tokenA, tokenB]
        );

    const enabledB =
      await repository
        .getEnabledTokensForOwner(
          ownerB.toString(),
          [tokenA, tokenB]
        );

    assert.deepEqual(
      [...enabledA],
      [tokenA]
    );

    assert.equal(
      enabledB.size,
      0
    );

    console.log(
      "OK: destinatarios separados por usuario"
    );

    /*
     * Cambiar A a cuenta B.
     */
    await PushDeviceModel.updateOne(
      {
        expoPushToken: tokenA,
      },
      {
        $set: {
          ownerId: ownerB,
        },
      }
    );

    const afterTransfer =
      await repository
        .getEnabledTokensForOwner(
          ownerB.toString(),
          [tokenA]
        );

    assert.equal(
      afterTransfer.size,
      0
    );

    console.log(
      "OK: cambio de cuenta sin heredar consentimiento"
    );

    /*
     * Nuevo consentimiento
     * del propietario B.
     */
    await repository.setForOwner(
      ownerB.toString(),
      tokenA,
      true
    );

    assert.equal(
      (
        await repository
          .getEnabledTokensForOwner(
            ownerB.toString(),
            [tokenA]
          )
      ).size,
      1
    );

    /*
     * Desactivar el dispositivo.
     */
    await PushDeviceModel.updateOne(
      {
        expoPushToken: tokenA,
      },
      {
        $set: {
          active: false,
        },
      }
    );

    assert.equal(
      (
        await repository
          .getEnabledTokensForOwner(
            ownerB.toString(),
            [tokenA]
          )
      ).size,
      0
    );

    console.log(
      "OK: dispositivo inactivo excluido"
    );

    console.log(
      "OK: ninguna notificación enviada"
    );

    console.log(
      "\nPRUEBA SUPERADA"
    );

  } finally {

    await TeamMemoryLiveOptInModel.deleteMany({
      ownerId: {
        $in: [ownerA, ownerB],
      },
    });

    await PushDeviceModel.deleteMany({
      expoPushToken: {
        $in: [tokenA, tokenB],
      },
    });

    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(
    "[TeamMemoryOptInTest]",
    error
  );

  process.exitCode = 1;
});

