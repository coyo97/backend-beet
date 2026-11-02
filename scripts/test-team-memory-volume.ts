
import "dotenv/config";

import assert from "node:assert/strict";
import { Types } from "mongoose";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  MongooseTeamMemoryLiveVolumeRepository,
} from "../src/modules/notifications/infrastructure/repositories/MongooseTeamMemoryLiveVolumeRepository";

import {
  TeamMemoryLiveVolumePolicyModel,
  TeamMemoryLiveVolumeUsageModel,
} from "../src/modules/notifications/infrastructure/database/models/TeamMemoryLiveVolumeModels";

async function main(): Promise<void> {

  const ownerA =
    new Types.ObjectId().toHexString();

  const ownerB =
    new Types.ObjectId().toHexString();

  const owners = [ownerA, ownerB];

  await connectDatabase();

  try {
    await TeamMemoryLiveVolumePolicyModel.init();
    await TeamMemoryLiveVolumeUsageModel.init();

    const repository =
      new MongooseTeamMemoryLiveVolumeRepository();

    console.log("===== TEST 1: VALORES INICIALES =====");

    const initial =
      await repository.getUsage(ownerA);

    assert.equal(initial.dailyLimit, 4);
    assert.equal(initial.cooldownMinutes, 30);
    assert.equal(initial.used, 0);

    console.log("OK: 4 avisos y pausa de 30 min");

    console.log("===== TEST 2: MISMO EVENTO =====");

    assert.equal(
      await repository.tryReserve(
        ownerA,
        "test:match:1"
      ),
      true
    );

    assert.equal(
      await repository.tryReserve(
        ownerA,
        "test:match:1"
      ),
      true
    );

    assert.equal(
      (await repository.getUsage(ownerA)).used,
      1
    );

    console.log("OK: mismo aviso consume un cupo");

    console.log("===== TEST 3: PAUSA =====");

    assert.equal(
      await repository.tryReserve(
        ownerA,
        "test:match:2"
      ),
      false
    );

    console.log("OK: otro partido bloqueado por pausa");

    console.log("===== TEST 4: CAMBIO DINAMICO =====");

    await repository.setPolicy(
      ownerA,
      10,
      0
    );

    const updated =
      await repository.getUsage(ownerA);

    assert.equal(updated.dailyLimit, 10);
    assert.equal(updated.cooldownMinutes, 0);

    assert.equal(
      await repository.tryReserve(
        ownerA,
        "test:match:2"
      ),
      true
    );

    console.log("OK: configuración nueva aplicada");

    console.log("===== TEST 5: CONCURRENCIA =====");

    await repository.setPolicy(
      ownerB,
      4,
      0
    );

    const attempts =
      await Promise.all(
        Array.from(
          { length: 20 },
          (_, index) =>
            repository.tryReserve(
              ownerB,
              `test:concurrent:${index}`
            )
        )
      );

    const accepted =
      attempts.filter(Boolean).length;

    const rejected =
      attempts.length - accepted;

    assert.equal(accepted, 4);
    assert.equal(rejected, 16);

    assert.equal(
      (await repository.getUsage(ownerB)).used,
      4
    );

    console.log({
      accepted,
      rejected,
    });

    console.log("===== TEST 6: AISLAMIENTO =====");

    const usageA =
      await repository.getUsage(ownerA);

    const usageB =
      await repository.getUsage(ownerB);

    assert.equal(usageA.used, 2);
    assert.equal(usageB.used, 4);

    console.log("OK: cuentas independientes");

    console.log("TODAS LAS PRUEBAS SUPERADAS");

  } finally {
    try {
      await TeamMemoryLiveVolumeUsageModel
        .deleteMany({
          ownerId: { $in: owners },
        })
        .exec();

      await TeamMemoryLiveVolumePolicyModel
        .deleteMany({
          ownerId: { $in: owners },
        })
        .exec();

      console.log("Datos sintéticos eliminados");

    } finally {
      await disconnectDatabase();
    }
  }
}

void main().catch(error => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});

