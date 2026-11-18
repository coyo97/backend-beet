import assert from "node:assert/strict";

import type {
  MatchOpportunity,
} from "../src/modules/opportunity-filter/domain/entities/MatchOpportunity";

import type {
  AlertRule,
} from "../src/modules/alert-rules/domain/AlertRule";

import {
  PreviewFavoriteAlertRules,
} from "../src/modules/alert-rules/application/services/PreviewFavoriteAlertRules";

/*
 * Partido ficticio.
 *
 * Favorito:
 * - Local
 * - 40 puntos
 * - Segunda posición
 *
 * Rival:
 * - 20 puntos
 * - Posición 11
 *
 * Marcador:
 * - Local 0
 * - Visitante 1
 */
function makeOpportunity(
  minute: number
): MatchOpportunity {
  return {
    profile: "clear-favorite",

    favoredSide: "home",

    dataQuality: 85,

    hasTable: true,

    home: {
      points: 40,
      position: 2,
    },

    away: {
      points: 20,
      position: 11,
    },

    match: {
      competition: {
        name: "Primera División",
        country: "Bolivia",
      },

      status: {
        minute,
      },

      home: {
        name: "Equipo Favorito",
        goals: 0,
      },

      away: {
        name: "Equipo Rival",
        goals: 1,
      },
    },
  } as unknown as MatchOpportunity;
}

/*
 * Regla ficticia:
 *
 * AND:
 * - minuto >= 60
 * - diferencia de puntos >= 15
 * - favorito perdiendo >= 1 gol
 */
function makeRule(): AlertRule {
  return {
    id: "test-rule-001",

    ownerId:
      "507f1f77bcf86cd799439011",

    name:
      "Favorito perdiendo después del 60",

    enabled: true,

    phase: "live",

    scope: "all",

    filters: {
      countries: ["Bolivia"],
      competitions: [],
      excludedCompetitions: [],
    },

    when: {
      kind: "all",

      conditions: [
        {
          kind: "comparison",
          metric: "minute",
          operator: "gte",
          value: 60,
        },

        {
          kind: "comparison",
          metric: "pointGap",
          operator: "gte",
          value: 15,
        },

        {
          kind: "comparison",
          metric: "favoriteGoalsBehind",
          operator: "gte",
          value: 1,
        },
      ],
    },

    delivery: {
      priority: "normal",
      cooldownMinutes: 30,
      remindersBeforeKickoff: [],
    },

    createdAt:
      "2026-11-07T00:00:00.000Z",

    updatedAt:
      "2026-11-07T00:00:00.000Z",
  };
}

const preview =
  new PreviewFavoriteAlertRules();

const rule =
  makeRule();

/*
 * PRUEBA 1:
 *
 * Minuto 65.
 * Todas las condiciones se cumplen.
 */
const test1 =
  preview.execute(
    [makeOpportunity(65)],
    [rule]
  );

assert.equal(
  test1.matches.length,
  1,
  "Debe encontrar la regla cumplida"
);

console.log(
  "PASS 1: AND encuentra coincidencia"
);

/*
 * PRUEBA 2:
 *
 * Minuto 45.
 * Todavía no debe activar la regla.
 */
const test2 =
  preview.execute(
    [makeOpportunity(45)],
    [rule]
  );

assert.equal(
  test2.matches.length,
  0,
  "No debe activarse antes del minuto 60"
);

console.log(
  "PASS 2: respeta el minuto mínimo"
);

/*
 * PRUEBA 3:
 *
 * Filtro de país incompatible.
 */
const countryRule: AlertRule = {
  ...rule,

  filters: {
    ...rule.filters,
    countries: ["Argentina"],
  },
};

const test3 =
  preview.execute(
    [makeOpportunity(65)],
    [countryRule]
  );

assert.equal(
  test3.matches.length,
  0,
  "Debe respetar el filtro de país"
);

console.log(
  "PASS 3: respeta los filtros"
);

/*
 * PRUEBA 4:
 *
 * No existe información de tabla.
 * No podemos afirmar una diferencia
 * de puntos.
 */
const withoutTable =
  makeOpportunity(65);

withoutTable.hasTable = false;

const test4 =
  preview.execute(
    [withoutTable],
    [rule]
  );

assert.equal(
  test4.matches.length,
  0,
  "No debe inventar datos de tabla"
);

console.log(
  "PASS 4: no inventa estadísticas"
);

/*
 * PRUEBA 5:
 *
 * Regla desactivada.
 */
const disabledRule: AlertRule = {
  ...rule,
  enabled: false,
};

const test5 =
  preview.execute(
    [makeOpportunity(65)],
    [disabledRule]
  );

assert.equal(
  test5.matches.length,
  0,
  "No debe evaluar reglas desactivadas"
);

console.log(
  "PASS 5: ignora reglas desactivadas"
);

/*
 * PRUEBA 6:
 *
 * OR:
 * minuto >= 80
 * O
 * diferencia de puntos >= 15.
 *
 * Al minuto 65 debe cumplirse por
 * la segunda condición.
 */
const orRule: AlertRule = {
  ...rule,

  when: {
    kind: "any",

    conditions: [
      {
        kind: "comparison",
        metric: "minute",
        operator: "gte",
        value: 80,
      },

      {
        kind: "comparison",
        metric: "pointGap",
        operator: "gte",
        value: 15,
      },
    ],
  },
};

const test6 =
  preview.execute(
    [makeOpportunity(65)],
    [orRule]
  );

assert.equal(
  test6.matches.length,
  1,
  "OR debe aceptar una condición cumplida"
);

console.log(
  "PASS 6: OR encuentra coincidencia"
);

/*
 * PRUEBA 7:
 *
 * No debemos evaluar presión
 * hasta disponer de datos fiables.
 */
const pressureRule: AlertRule = {
  ...rule,

  when: {
    kind: "comparison",
    metric: "favoritePressure",
    operator: "gte",
    value: 70,
  },
};

const test7 =
  preview.execute(
    [makeOpportunity(65)],
    [pressureRule]
  );

assert.equal(
  test7.eligibleRules,
  0,
  "No debe aceptar métricas no disponibles"
);

console.log(
  "PASS 7: descarta métricas no conectadas"
);

console.log(
  "\nTodas las pruebas del preview pasaron."
);
