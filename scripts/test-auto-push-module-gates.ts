
import "dotenv/config";

import assert from "node:assert/strict";

import {
  teamMemoryTestVolumeLimiter,
} from "../src/modules/notifications/teamMemoryLiveModule";

import {
  upcomingTestDailyLimit,
} from "../src/modules/notifications/upcomingReminderModule";

const ownerA =
  "aaaaaaaaaaaaaaaaaaaaaaaa";

const ownerB =
  "bbbbbbbbbbbbbbbbbbbbbbbb";

const previous =
  process.env.AUTO_PUSH_TEST_OWNER_ID;

async function verifyBlocked(
  ownerId: string
): Promise<void> {

  const memory =
    await teamMemoryTestVolumeLimiter.tryReserve(
      ownerId,
      "TEST:NOTIFICATION-GATE"
    );

  const upcoming =
    await upcomingTestDailyLimit.tryReserve(
      ownerId,
      "TEST:NOTIFICATION-GATE",
      "60m"
    );

  assert.equal(memory, false);
  assert.equal(upcoming, false);
}

async function main(): Promise<void> {
  try {
    delete process.env.AUTO_PUSH_TEST_OWNER_ID;

    await verifyBlocked(ownerA);

    console.log(
      "OK: ambos módulos bloqueados sin propietario"
    );

    process.env.AUTO_PUSH_TEST_OWNER_ID =
      ownerA;

    await verifyBlocked(ownerB);

    console.log(
      "OK: ambos módulos excluyen otras cuentas"
    );

    process.env.AUTO_PUSH_TEST_OWNER_ID =
      "invalid";

    await verifyBlocked(ownerA);

    console.log(
      "OK: configuración inválida bloquea envíos"
    );

    console.log(
      "AUTO PUSH MODULE GATES: OK"
    );

  } finally {
    if (previous === undefined) {
      delete process.env.AUTO_PUSH_TEST_OWNER_ID;
    } else {
      process.env.AUTO_PUSH_TEST_OWNER_ID =
        previous;
    }
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

