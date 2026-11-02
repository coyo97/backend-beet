
import assert from "node:assert/strict";

import {
  UpcomingMatchEvaluator,
  type UpcomingEvaluationInput,
} from "../src/modules/opportunity-filter/domain/services/UpcomingMatchEvaluator";

const evaluator =
  new UpcomingMatchEvaluator();

const now =
  Date.parse(
    "2026-10-25T12:00:00Z"
  );

const input: UpcomingEvaluationInput = {
  match: {
    kickoffAt:
      "2026-10-26T12:00:00Z",
  },

  hasTable: true,

  dataQuality: 80,

  favoredSide: "home",

  home: {
    name: "Equipo A",

    position: 2,
    points: 40,
    played: 20,
    pointsPerGame: 2,

    form: [
      "W", "W", "D", "W", "W",
    ],
  },

  away: {
    name: "Equipo B",

    position: 11,
    points: 25,
    played: 20,
    pointsPerGame: 1.25,

    form: [
      "L", "D", "L", "W", "D",
    ],
  },
};

const result =
  evaluator.evaluate(
    input,
    now
  );

console.log(
  "\n===== ENFRENTAMIENTO FUTURO ====="
);

console.dir(
  result,
  { depth: null }
);

assert.ok(result);

assert.equal(
  result.level,
  "high"
);

assert.equal(
  result.leadingSide,
  "home"
);

assert.equal(
  result.pointsGap,
  15
);

assert.equal(
  result.positionGap,
  9
);

/*
 * Diferencia demasiado pequeña.
 */
const smallGap =
  evaluator.evaluate(
    {
      ...input,

      away: {
        ...input.away,
        points: 37,
      },
    },

    now
  );

assert.equal(
  smallGap,
  null
);

/*
 * Sin tabla comparable
 * no se emite alerta.
 */
const noTable =
  evaluator.evaluate(
    {
      ...input,
      hasTable: false,
    },

    now
  );

assert.equal(
  noTable,
  null
);

/*
 * No evaluar un partido
 * que ya comenzó.
 */
const started =
  evaluator.evaluate(
    {
      ...input,

      match: {
        kickoffAt:
          "2026-10-25T11:00:00Z",
      },
    },

    now
  );

assert.equal(
  started,
  null
);

/*
 * El scorer detecta ventaja
 * para el rival.
 */
const contradictory =
  evaluator.evaluate(
    {
      ...input,
      favoredSide: "away",
    },

    now
  );

assert.equal(
  contradictory,
  null
);

/*
 * Si los puntos pueden deberse
 * a tener varios partidos más
 * disputados, no afirmamos
 * superioridad sin respaldo PPG.
 */
const unevenPlayed =
  evaluator.evaluate(
    {
      ...input,

      away: {
        ...input.away,
        played: 16,
        pointsPerGame: 2,
      },
    },

    now
  );

assert.equal(
  unevenPlayed,
  null
);

console.log(
  "\nOK: prioridad alta detectada"
);

console.log(
  "OK: diferencia de puntos correcta"
);

console.log(
  "OK: diferencia de posiciones correcta"
);

console.log(
  "OK: datos insuficientes descartados"
);

console.log(
  "OK: partidos iniciados descartados"
);

console.log(
  "OK: evaluaciones contradictorias descartadas"
);

