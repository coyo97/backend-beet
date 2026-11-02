
import assert from "node:assert/strict";

import type {
  OwnerTeamMemoryLiveAlert,
} from "../src/modules/notifications/application/services/FindTeamMemoryLiveAlerts";

import {
  rankTeamMemoryLiveAlerts,
} from "../src/modules/notifications/application/services/RankTeamMemoryLiveAlerts";

import {
  scoreTeamMemoryLiveAlert,
} from "../src/modules/notifications/application/services/ScoreTeamMemoryLiveAlert";

function alert(
  matchKey: string,
  wins: number,
  losses: number,
  previousOpponentWins: number,
  previousOpponentLosses: number
): OwnerTeamMemoryLiveAlert {

  return {
    ownerId: "000000000000000000000001",
    matchKey,
    type: "TEAM_MEMORY_LIVE",
    teamName: "Equipo A",
    opponentName: "Equipo B",

    wins,
    losses,
    previousOpponentWins,
    previousOpponentLosses,

    title: "Team Memory",
    body: "Alerta de prueba",
  };
}

const weak = alert(
  "weak",
  1, 1,
  0, 0
);

const strongHistory = alert(
  "strong-history",
  4, 1,
  0, 0
);

const repeatedOpponent = alert(
  "repeated-opponent",
  0, 2,
  1, 0
);

const original = [
  weak,
  strongHistory,
  repeatedOpponent,
];

const ranked =
  rankTeamMemoryLiveAlerts(original);

assert.deepEqual(
  ranked.map(item => item.matchKey),
  [
    "repeated-opponent",
    "strong-history",
    "weak",
  ]
);

console.log(
  "OK: rival repetido tiene prioridad"
);

assert.ok(
  scoreTeamMemoryLiveAlert(strongHistory) >
  scoreTeamMemoryLiveAlert(weak)
);

console.log(
  "OK: historial más relevante"
);

assert.equal(
  original[0].matchKey,
  "weak"
);

console.log(
  "OK: arreglo original intacto"
);

const reversed =
  rankTeamMemoryLiveAlerts(
    [...original].reverse()
  );

assert.deepEqual(
  reversed.map(item => item.matchKey),
  ranked.map(item => item.matchKey)
);

console.log(
  "OK: independiente del orden de entrada"
);

console.log(
  "TEAM MEMORY RANKING: OK"
);

