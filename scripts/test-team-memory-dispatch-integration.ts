
import assert from "node:assert/strict";

import {
  DispatchTeamMemoryLiveAlerts,
} from "../src/modules/notifications/application/services/DispatchTeamMemoryLiveAlerts";

import type {
  OwnerTeamMemoryLiveAlert,
} from "../src/modules/notifications/application/services/FindTeamMemoryLiveAlerts";

/*
 * Usuarios y dispositivos ficticios.
 * Ninguno pertenece a MongoDB.
 */
const OWNER_A = "000000000000000000000001";
const OWNER_B = "000000000000000000000002";
const OWNER_C = "000000000000000000000003";

const A1 = "ExpoPushToken[MOCK-A1]";
const A2 = "ExpoPushToken[MOCK-A2]";
const A3 = "ExpoPushToken[MOCK-A3]";
const B1 = "ExpoPushToken[MOCK-B1]";
const C1 = "ExpoPushToken[MOCK-C1]";

const MATCH = "TEST:TEAM-MEMORY:LIVE";

const alerts = [
  {
    ownerId: OWNER_A,
    matchKey: MATCH,
    title: "Team Memory: equipo A",
    body: "Equipo de tu historial jugando",
  },
  {
    ownerId: OWNER_B,
    matchKey: MATCH,
    title: "Team Memory: equipo B",
    body: "Equipo de tu historial jugando",
  },
  {
    ownerId: OWNER_C,
    matchKey: MATCH,
    title: "Team Memory: equipo C",
    body: "No debe enviarse",
  },
] as OwnerTeamMemoryLiveAlert[];

/*
 * A tiene tres teléfonos:
 * A1 y A2 autorizados, A3 no.
 *
 * B tiene un teléfono autorizado.
 *
 * C tiene las preferencias generales
 * desactivadas.
 */
const devicesByOwner: Record<string, string[]> = {
  [OWNER_A]: [A1, A2, A3],
  [OWNER_B]: [B1],
  [OWNER_C]: [C1],
};

const allowedByOwner: Record<string, string[]> = {
  [OWNER_A]: [A1, A2],
  [OWNER_B]: [B1],
  [OWNER_C]: [C1],
};

const fakeDevices = {
  findActiveByOwner: async (ownerId: string) =>
    (devicesByOwner[ownerId] ?? []).map(
      expoPushToken => ({ expoPushToken })
    ),
};

const fakePreferences = {
  get: async (ownerId: string) => ({
    enabled: ownerId !== OWNER_C,
  }),
};

const fakeOptIns = {
  getEnabledTokensForOwner: async (
    ownerId: string,
    tokens: string[]
  ) => {
    const allowed =
      new Set(allowedByOwner[ownerId] ?? []);

    return new Set(
      tokens.filter(token => allowed.has(token))
    );
  },
};

/*
 * Reservas falsas en memoria.
 * La identidad incluye propietario,
 * partido y teléfono.
 */
const reservations = new Set<string>();
const completed: string[] = [];

const fakeClaims = {
  claim: async (input: {
    ownerId: string;
    matchKey: string;
    expoPushToken: string;
  }) => {
    const key = [
      input.ownerId,
      input.matchKey,
      input.expoPushToken,
    ].join("|");

    if (reservations.has(key)) {
      return false;
    }

    reservations.add(key);
    return true;
  },

  complete: async (input: {
    ownerId: string;
    matchKey: string;
    expoPushToken: string;
    status: string;
  }) => {
    completed.push([
      input.ownerId,
      input.matchKey,
      input.expoPushToken,
      input.status,
    ].join("|"));

    return true;
  },
};

/*
 * Emisor falso. Solo guarda los
 * destinatarios en un arreglo.
 */
const sentTo: string[] = [];

const fakeSender = {
  send: async (messages: Array<{ to: string }>) => {
    sentTo.push(...messages.map(message => message.to));

    return messages.map(() => ({
      status: "ok" as const,
      receiptId: "MOCK-TICKET",
    }));
  },
};

type Params =
  ConstructorParameters<
    typeof DispatchTeamMemoryLiveAlerts
  >;

  /*
 * Limitador simulado:
 * máximo un partido diferente
 * por cuenta durante la prueba.
 */
const volumeEvents =
  new Set<string>();

const fakeVolumeLimiter = {
  tryReserve: async (
    ownerId: string,
    matchKey: string
  ): Promise<boolean> => {

    const key =
      `${ownerId}|${matchKey}`;

    if (volumeEvents.has(key)) {
      return true;
    }

    const used =
      [...volumeEvents].filter(
        item =>
          item.startsWith(
            `${ownerId}|`
          )
      ).length;

    if (used >= 1) {
      return false;
    }

    volumeEvents.add(key);
    return true;
  },
};

function makeDispatcher(allowSending: boolean) {
  return new DispatchTeamMemoryLiveAlerts(
    fakeDevices as unknown as Params[0],
    fakePreferences as Params[1],
    fakeOptIns as unknown as Params[2],
    fakeClaims as unknown as Params[3],
    fakeSender as unknown as Params[4],
    allowSending,
	fakeVolumeLimiter
  );
}

async function main() {

  console.log("===== TEST 1: BLOQUEO GLOBAL =====");

  const disabled = makeDispatcher(false);

  const blocked = await disabled.execute(
    alerts,
    { send: true }
  );

  assert.equal(blocked.claimed, 0);
  assert.equal(blocked.attempted, 0);
  assert.equal(sentTo.length, 0);
  assert.equal(reservations.size, 0);

  console.log("OK: envío bloqueado");

  console.log("===== TEST 2: PREVIEW =====");

  const dispatcher = makeDispatcher(true);

  const preview = await dispatcher.execute(
    alerts,
    { send: false }
  );

  assert.equal(preview.claimed, 0);
  assert.equal(sentTo.length, 0);
  assert.equal(reservations.size, 0);

  console.log("OK: preview sin enviar");

  console.log("===== TEST 3: ENVIO SIMULADO =====");

  const result = await dispatcher.execute(
    alerts,
    { send: true }
  );

  assert.equal(result.globalDisabled, 1);
  assert.equal(result.claimed, 3);
  assert.equal(result.attempted, 3);
  assert.equal(result.accepted, 3);

  assert.deepEqual(
    [...sentTo].sort(),
    [A1, A2, B1].sort()
  );

  assert.equal(sentTo.includes(A3), false);
  assert.equal(sentTo.includes(C1), false);

  console.log("OK: dos usuarios autorizados");
  console.log("OK: dos teléfonos de cuenta A");
  console.log("OK: teléfono sin permiso excluido");
  console.log("OK: cuenta C desactivada");

  console.log("===== TEST 4: DEDUPLICACION =====");

  const repeated = await dispatcher.execute(
    alerts,
    { send: true }
  );

  assert.equal(repeated.claimed, 0);
  assert.equal(repeated.duplicates, 3);
  assert.equal(sentTo.length, 3);
  assert.equal(completed.length, 3);

  console.log("OK: segundo escaneo sin duplicados");

  console.log("===== RESULTADO =====", {
    autorizados: result.optedInDevices,
    enviadosSimulados: sentTo.length,
    duplicadosBloqueados: repeated.duplicates,
    reservas: reservations.size,
  });

  console.log(
  "===== TEST 5: LIMITE DE VOLUMEN ====="
);

/*
 * Otro partido de la cuenta A.
 *
 * La cuenta A ya utilizó su único
 * cupo simulado.
 */
const anotherMatch = {
  ...alerts[0],
  matchKey:
    "TEST:TEAM-MEMORY:SECOND-MATCH",
} as OwnerTeamMemoryLiveAlert;

const volumeResult =
  await dispatcher.execute(
    [anotherMatch],
    { send: true }
  );

assert.equal(
  volumeResult.volumeBlocked,
  2
);

assert.equal(
  volumeResult.claimed,
  0
);

assert.equal(
  sentTo.length,
  3
);

console.log(
  "OK: otro partido bloqueado por límite"
);

console.log(
  "OK: ningún envío adicional"
);


console.log(
  "===== TEST 6: PRIORIDAD CON UN SOLO CUPO ====="
);

/*
 * Reiniciar exclusivamente los mocks
 * utilizados por esta prueba.
 *
 * No se modifica MongoDB.
 */
volumeEvents.clear();
reservations.clear();
sentTo.length = 0;
completed.length = 0;

/*
 * Ambos partidos pertenecen a A.
 * El segundo es mucho más relevante.
 */
const weakPriority = {
  ...alerts[0],
  matchKey: "TEST:LOW-PRIORITY",
  wins: 1,
  losses: 1,
  previousOpponentWins: 0,
  previousOpponentLosses: 0,
} as OwnerTeamMemoryLiveAlert;

const highPriority = {
  ...alerts[0],
  matchKey: "TEST:HIGH-PRIORITY",
  wins: 4,
  losses: 1,
  previousOpponentWins: 2,
  previousOpponentLosses: 0,
} as OwnerTeamMemoryLiveAlert;

/*
 * Enviamos primero el partido débil
 * intencionalmente.
 *
 * El ranking del despachador
 * debe invertir ese orden.
 */
const priorityResult =
  await dispatcher.execute(
    [
      weakPriority,
      highPriority,
    ],
    { send: true }
  );

/*
 * El límite simulado permite
 * solamente un partido por cuenta.
 *
 * Dos teléfonos autorizados
 * deben recibir el mismo encuentro.
 */
assert.equal(priorityResult.claimed, 2);
assert.equal(priorityResult.accepted, 2);
assert.equal(priorityResult.volumeBlocked, 2);

assert.deepEqual(
  [...sentTo].sort(),
  [A1, A2].sort()
);

/*
 * Verificar cuál partido consumió
 * el único cupo disponible.
 */
assert.equal(
  volumeEvents.has(
    `${OWNER_A}|${highPriority.matchKey}`
  ),
  true
);

assert.equal(
  volumeEvents.has(
    `${OWNER_A}|${weakPriority.matchKey}`
  ),
  false
);

console.log(
  "OK: el partido más relevante obtuvo el cupo"
);

console.log(
  "OK: ambos teléfonos recibieron el aviso simulado"
);

console.log(
  "OK: el partido de menor prioridad fue bloqueado"
);


  console.log(
    "TEAM MEMORY DISPATCH INTEGRATION: OK"
  );
}

void main().catch(error => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});

