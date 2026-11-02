
import assert from "node:assert/strict";

import type {
  MatchOpportunity,
} from "../src/modules/opportunity-filter/domain/entities/MatchOpportunity";

import type {
  AlertRuleCondition,
} from "../src/modules/alert-rules/domain/AlertRule";

import {
  BuildFavoriteAlertFacts,
} from "../src/modules/alert-rules/application/services/BuildFavoriteAlertFacts";

import {
  EvaluateAlertRule,
} from "../src/modules/alert-rules/application/services/EvaluateAlertRule";

/*
 * Partido ficticio exclusivamente
 * para comprobar la logica.
 */
const opportunity = {
  profile: "clear-favorite",
  favoredSide: "home",
  hasTable: true,
  dataQuality: 85,

  home: {
    points: 40,
    position: 2,
  },

  away: {
    points: 25,
    position: 11,
  },

  match: {
    home: {
      name: "Equipo fuerte",
      goals: 0,
    },

    away: {
      name: "Equipo debil",
      goals: 1,
    },

    status: {
      minute: 38,
    },
  },
} as MatchOpportunity;

/*
 * Esta condicion sera configurable
 * desde el movil.
 */
const condition: AlertRuleCondition = {
  kind: "all",

  conditions: [
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

    {
      kind: "comparison",
      metric: "minute",
      operator: "gte",
      value: 25,
    },
  ],
};

const builder =
  new BuildFavoriteAlertFacts();

const evaluator =
  new EvaluateAlertRule();

assert.equal(
  builder.supports(condition),
  true
);

const facts =
  builder.build(opportunity);

assert.ok(facts);

console.log(
  "METRICAS:",
  facts
);

assert.equal(
  evaluator.execute(
    condition,
    facts
  ),
  true
);

console.log(
  "OK: favorito perdiendo detectado"
);

/*
 * Si el favorito empata,
 * ya no debe cumplir la regla.
 */
const equalized: MatchOpportunity = {
  ...opportunity,

  match: {
    ...opportunity.match,

    home: {
      ...opportunity.match.home,
      goals: 1,
    },
  },
};

const equalizedFacts =
  builder.build(equalized);

assert.ok(equalizedFacts);

assert.equal(
  evaluator.execute(
    condition,
    equalizedFacts
  ),
  false
);

console.log(
  "OK: empate descartado"
);

/*
 * Si no hay datos fiables
 * de la tabla, el evaluador
 * no debe inventar los puntos.
 */
const withoutTable: MatchOpportunity = {
  ...opportunity,
  hasTable: false,
};

const withoutTableFacts =
  builder.build(withoutTable);

assert.ok(withoutTableFacts);

assert.equal(
  evaluator.execute(
    condition,
    withoutTableFacts
  ),
  false
);

console.log(
  "OK: tabla ausente descartada"
);

