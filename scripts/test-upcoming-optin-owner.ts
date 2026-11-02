
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
  UpcomingPushOptInModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingPushOptInModel";

import {
  MongooseUpcomingPushOptInRepository,
} from "../src/modules/notifications/infrastructure/repositories/MongooseUpcomingPushOptInRepository";

async function main() {
  const ownerA = new mongoose.Types.ObjectId();
  const ownerB = new mongoose.Types.ObjectId();

  const token =
    `ExponentPushToken[TEST-${randomUUID()}]`;

  await connectDatabase();

  const repository =
    new MongooseUpcomingPushOptInRepository();

  try {
    await PushDeviceModel.init();
    await UpcomingPushOptInModel.init();

    await PushDeviceModel.create({
      ownerId: ownerA,
      expoPushToken: token,
      platform: "android",
      active: true,
      lastSeenAt: new Date(),
    });

    /*
     * Sin consentimiento previo.
     */
    assert.equal(
      await repository.getForOwner(
        ownerA.toString(),
        token
      ),
      false
    );

    assert.equal(
      (
        await repository.getEnabledTokens([token])
      ).size,
      0
    );

    console.log(
      "OK: desactivado por defecto"
    );

    /*
     * A activa su dispositivo.
     */
    await repository.setForOwner(
      ownerA.toString(),
      token,
      true
    );

    assert.equal(
      await repository.getForOwner(
        ownerA.toString(),
        token
      ),
      true
    );

    assert.equal(
      (
        await repository.getEnabledTokens([token])
      ).size,
      1
    );

    console.log(
      "OK: consentimiento del propietario"
    );

    /*
     * B no puede modificar el token.
     */
    await assert.rejects(
      repository.setForOwner(
        ownerB.toString(),
        token,
        true
      ),
      /does not belong/
    );

    console.log(
      "OK: otro usuario rechazado"
    );

    /*
     * El celular cambia de cuenta.
     */
    await PushDeviceModel.updateOne(
      {
        expoPushToken: token,
      },
      {
        $set: {
          ownerId: ownerB,
        },
      }
    );

    /*
     * El consentimiento de A
     * no debe transferirse a B.
     */
    assert.equal(
      (
        await repository.getEnabledTokens([token])
      ).size,
      0
    );

    assert.equal(
      await repository.getForOwner(
        ownerB.toString(),
        token
      ),
      false
    );

    console.log(
      "OK: cambio de cuenta no hereda permisos"
    );

    /*
     * B autoriza expresamente.
     */
    await repository.setForOwner(
      ownerB.toString(),
      token,
      true
    );

    assert.equal(
      (
        await repository.getEnabledTokens([token])
      ).size,
      1
    );

    /*
     * B desactiva las alertas.
     */
    await repository.setForOwner(
      ownerB.toString(),
      token,
      false
    );

    assert.equal(
      (
        await repository.getEnabledTokens([token])
      ).size,
      0
    );

    console.log(
      "OK: activación y desactivación"
    );

    /*
     * Un dispositivo inactivo
     * siempre queda excluido.
     */
    await repository.setForOwner(
      ownerB.toString(),
      token,
      true
    );

    await PushDeviceModel.updateOne(
      {
        expoPushToken: token,
      },
      {
        $set: {
          active: false,
        },
      }
    );

    assert.equal(
      (
        await repository.getEnabledTokens([token])
      ).size,
      0
    );

    console.log(
      "OK: dispositivo inactivo excluido"
    );

    console.log(
      "\nPRUEBA SUPERADA"
    );

  } finally {
    await UpcomingPushOptInModel.deleteMany({
      ownerId: {
        $in: [ownerA, ownerB],
      },
    });

    await PushDeviceModel.deleteMany({
      expoPushToken: token,
    });

    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(
    "[UpcomingOptInOwnerTest]",
    error
  );

  process.exitCode = 1;
});

