
import assert from "node:assert/strict";

import type {
  DueUpcomingReminder,
} from "../src/modules/notifications/application/services/GetDueUpcomingReminders";

import {
  rankUpcomingReminders,
  upcomingPriorityScore,
} from "../src/modules/notifications/application/services/RankUpcomingReminders";

const now =
  new Date("2026-11-02T12:00:00.000Z");

function reminder(
  matchKey: string,
  window: "24h" | "60m",
  pointsGap: number,
  positionGap: number,
  dataQuality: number
): DueUpcomingReminder {

  return {
    matchKey,
    window,
    title: matchKey,
    body: "Prueba",
    homeName: "Local",
    awayName: "Visitante",

    dueAt: now,

    kickoffAt: new Date(
      now.getTime() + 60 * 60_000
    ),

    pointsGap,
    positionGap,
    dataQuality,
  };
}

const high24h = reminder(
  "24h-high",
  "24h",
  40,
  15,
  100
);

const low60m = reminder(
  "60m-low",
  "60m",
  3,
  1,
  71
);

const high60m = reminder(
  "60m-high",
  "60m",
  35,
  10,
  90
);

const original = [
  low60m,
  high24h,
  high60m,
];

const ranked =
  rankUpcomingReminders(original);

assert.deepEqual(
  ranked.map(item => item.matchKey),
  [
    "60m-high",
    "60m-low",
    "24h-high",
  ]
);

console.log(
  "OK: urgencia de 60 minutos"
);

assert.ok(
  upcomingPriorityScore(high60m) >
  upcomingPriorityScore(low60m)
);

console.log(
  "OK: diferencia de puntos y posiciones"
);

assert.equal(
  original[0].matchKey,
  "60m-low"
);

console.log(
  "OK: no modifica el arreglo original"
);

const reversed =
  rankUpcomingReminders(
    [...original].reverse()
  );

assert.deepEqual(
  reversed.map(item => item.matchKey),
  ranked.map(item => item.matchKey)
);

console.log(
  "OK: orden independiente de MongoDB"
);

console.log(
  "UPCOMING RANKING: OK"
);

