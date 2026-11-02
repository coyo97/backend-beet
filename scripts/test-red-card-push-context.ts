
import assert from "node:assert/strict";

import type {
  MatchContext,
} from "../src/modules/match-context/domain/entities/MatchContext";

import {
  formatRedCardPushContext,
} from "../src/modules/alert-rules/application/services/FormatRedCardPushContext";

const context = {
  competition: {
    tableAvailable: true,
    tableScope: "competition",
  },

  availability: {
    standings: true,
    recentForm: true,
  },

  home: {
    position: 2,
    points: 40,
    form: ["W", "W", "D", "W", "W"],
  },

  away: {
    position: 11,
    points: 25,
    form: ["L", "D", "L", "W", "D"],
  },
} as unknown as MatchContext;

const formatted =
  formatRedCardPushContext(context);

console.log(
  "\n===== CONTEXTO DISPONIBLE ====="
);

console.log(formatted);

assert.ok(
  formatted.includes("40 pts")
);

assert.ok(
  formatted.includes("25 pts")
);

assert.ok(
  formatted.includes("15 pts")
);

assert.ok(
  formatted.includes("G-G-E-G-G")
);

/*
 * Sin contexto, no agregar
 * estadísticas inventadas.
 */
assert.equal(
  formatRedCardPushContext(null),
  ""
);

/*
 * Una competición sin tabla
 * no debe mostrar posiciones
 * ni puntos.
 */
const withoutTable = {
  ...context,

  competition: {
    ...context.competition,
    tableAvailable: false,
    tableScope: "none",
  },

  availability: {
    ...context.availability,
    standings: false,
  },
} as MatchContext;

const limited =
  formatRedCardPushContext(
    withoutTable
  );

assert.equal(
  limited.includes("40 pts"),
  false
);

assert.equal(
  limited.includes("2.º"),
  false
);

console.log(
  "\nOK: formato enriquecido"
);

console.log(
  "OK: sin datos inventados"
);

console.log(
  "OK: copas sin tabla"
);

