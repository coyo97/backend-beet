
import assert from "node:assert/strict";

import {
  InvalidAlertRuleError,
  parseCreateAlertRuleInput,
} from "../src/modules/alert-rules/application/services/ParseAlertRuleInput";

import {
  EvaluateAlertRule,
} from "../src/modules/alert-rules/application/services/EvaluateAlertRule";

const ownerId =
  "aaaaaaaaaaaaaaaaaaaaaaaa";

const ruleInput = {
  name: "Roja y presión",
  enabled: true,

  phase: "live",
  scope: "all",

  filters: {
    countries: [],
    competitions: [],
    excludedCompetitions: [],
  },

  when: {
    kind: "all",
    conditions: [
      {
        kind: "comparison",
        metric: "totalRedCards",
        operator: "gte",
        value: 1,
      },
      {
        kind: "comparison",
        metric: "minute",
        operator: "gte",
        value: 60,
      },
    ],
  },

  delivery: {
    priority: "high",
    cooldownMinutes: 30,
    remindersBeforeKickoff: [],
  },
};

const parsed =
  parseCreateAlertRuleInput(
    ruleInput,
    ownerId
  );

assert.equal(
  parsed.ownerId,
  ownerId
);

console.log(
  "OK: propietario asignado por backend"
);

assert.throws(
  () =>
    parseCreateAlertRuleInput(
      {
        ...ruleInput,
        ownerId:
          "bbbbbbbbbbbbbbbbbbbbbbbb",
      },
      ownerId
    ),
  InvalidAlertRuleError
);

console.log(
  "OK: no permite suplantar propietario"
);

const evaluator =
  new EvaluateAlertRule();

assert.equal(
  evaluator.execute(
    parsed.when,
    {
      totalRedCards: 1,
      minute: 65,
    }
  ),
  true
);

assert.equal(
  evaluator.execute(
    parsed.when,
    {
      totalRedCards: 0,
      minute: 65,
    }
  ),
  false
);

assert.equal(
  evaluator.execute(
    parsed.when,
    {
      minute: 65,
    }
  ),
  false
);

console.log(
  "OK: condiciones AND y datos ausentes"
);

console.log(
  "ALERT RULE EDIT VALIDATION: OK"
);

