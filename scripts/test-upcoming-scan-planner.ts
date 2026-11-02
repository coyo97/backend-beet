
import assert from "node:assert/strict";

import {
  UpcomingLeagueScanPlanner,
} from "../src/modules/opportunity-filter/application/services/UpcomingLeagueScanPlanner";

const now =
  Date.parse(
    "2026-10-25T12:00:00Z"
  );

const HOUR_MS =
  60 * 60 * 1000;

function league(
  key: string,
  hoursUntilKickoff: number
) {
  return {
    key,

    matches: [
      {
        kickoffAt:
          new Date(
            now +
            hoursUntilKickoff *
              HOUR_MS
          ).toISOString(),
      },
    ],
  };
}

const groups = [
  league("normal-1", 10),
  league("normal-2", 11),

  league("day-24h", 24),

  league("normal-3", 12),

  league("hour-60m", 1),

  league("normal-4", 13),
  league("normal-5", 14),
];

const planner =
  new UpcomingLeagueScanPlanner();

/*
 * Primera selección.
 */
const first =
  planner.select(
    groups,
    5,
    now
  );

const firstKeys =
  first.map(
    group => group.key
  );

console.log(
  "\n===== PLANIFICACIÓN 1 ====="
);

console.log(firstKeys);

assert.equal(
  first.length,
  5
);

assert.ok(
  firstKeys.includes(
    "hour-60m"
  )
);

assert.ok(
  firstKeys.includes(
    "day-24h"
  )
);

/*
 * Marcar la primera selección
 * como analizada correctamente.
 */
for (const group of first) {

  planner.markCompleted(
    group.key,
    true,
    now
  );
}

/*
 * Tres minutos después:
 *
 * No debe repetir inmediatamente
 * las ligas recién analizadas.
 */
const second =
  planner.select(
    groups,
    5,
    now + 3 * 60 * 1000
  );

const secondKeys =
  second.map(
    group => group.key
  );

console.log(
  "\n===== PLANIFICACIÓN 2 ====="
);

console.log(secondKeys);

for (const key of secondKeys) {

  assert.ok(
    !firstKeys.includes(key)
  );
}

/*
 * Verificar que ninguna ejecución
 * supera el límite indicado.
 */
assert.ok(
  first.length <= 5
);

assert.ok(
  second.length <= 5
);

/*
 * Verificar que las ligas vuelven
 * a ser elegibles tras el cooldown.
 */
const third =
  planner.select(
    groups,
    5,
    now + 22 * 60 * 1000
  );

const thirdKeys =
  third.map(
    group => group.key
  );

console.log(
  "\n===== PLANIFICACIÓN 3 ====="
);

console.log(thirdKeys);

assert.ok(
  thirdKeys.includes(
    "hour-60m"
  )
);

assert.ok(
  thirdKeys.includes(
    "day-24h"
  )
);

console.log(
  "\nOK: prioridad de 60 minutos"
);

console.log(
  "OK: prioridad de 24 horas"
);

console.log(
  "OK: rotación mundial"
);

console.log(
  "OK: cooldown por liga"
);

console.log(
  "OK: máximo 5 ligas por ciclo"
);

