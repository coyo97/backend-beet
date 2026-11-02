
import assert from "node:assert/strict";

import {
  isAutoPushTestOwnerAllowed,
} from "../src/modules/notifications/application/services/AutoPushTestOwnerGate";

const ownerA =
  "aaaaaaaaaaaaaaaaaaaaaaaa";

const ownerB =
  "bbbbbbbbbbbbbbbbbbbbbbbb";

const previous =
  process.env.AUTO_PUSH_TEST_OWNER_ID;

try {
  delete process.env.AUTO_PUSH_TEST_OWNER_ID;

  assert.equal(
    isAutoPushTestOwnerAllowed(ownerA),
    false
  );

  console.log(
    "OK: sin cuenta configurada, todo bloqueado"
  );

  process.env.AUTO_PUSH_TEST_OWNER_ID =
    "invalid";

  assert.equal(
    isAutoPushTestOwnerAllowed(ownerA),
    false
  );

  console.log(
    "OK: identificador inválido bloqueado"
  );

  process.env.AUTO_PUSH_TEST_OWNER_ID =
    ownerA;

  assert.equal(
    isAutoPushTestOwnerAllowed(ownerA),
    true
  );

  assert.equal(
    isAutoPushTestOwnerAllowed(ownerB),
    false
  );

  console.log(
    "OK: únicamente la cuenta autorizada"
  );

  console.log(
    "AUTO PUSH OWNER GATE: OK"
  );

} finally {
  if (previous === undefined) {
    delete process.env.AUTO_PUSH_TEST_OWNER_ID;
  } else {
    process.env.AUTO_PUSH_TEST_OWNER_ID =
      previous;
  }
}

