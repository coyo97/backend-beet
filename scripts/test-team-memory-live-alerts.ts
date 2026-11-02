
import assert from "node:assert/strict";

import {
  DetectTeamMemoryLiveAlerts,
  type TeamMemoryAlertEvent,
  type TeamMemoryLiveMatch,
} from "../src/modules/notifications/application/services/DetectTeamMemoryLiveAlerts";

const detector =
  new DetectTeamMemoryLiveAlerts();

const now =
  new Date("2026-10-25T15:05:00.000Z");

const matches: TeamMemoryLiveMatch[] = [
  {
    matchKey: "test:palmeiras-santos",
    homeName: "Palmeiras",
    awayName: "Santos",
    isLive: true,
    minute: 5,
  },
  {
    matchKey: "test:another",
    homeName: "Flamengo",
    awayName: "Gremio",
    isLive: true,
    minute: 55,
  },
  {
    matchKey: "test:not-started",
    homeName: "Palmeiras",
    awayName: "Corinthians",
    isLive: false,
    minute: null,
  },
];

const events: TeamMemoryAlertEvent[] = [
  {
    ownerId: "user-A",
    teamName: "Palmeiras",
    outcome: "win",
    opponentName: "Santos",
    createdAt: "2026-10-10T12:00:00Z",
  },
  {
    ownerId: "user-A",
    teamName: "Palmeiras",
    outcome: "win",
    opponentName: "Corinthians",
    createdAt: "2026-10-05T12:00:00Z",
  },
  {
    ownerId: "user-A",
    teamName: "Palmeiras",
    outcome: "loss",
    opponentName: "Flamengo",
    createdAt: "2026-10-01T12:00:00Z",
  },
  {
    /*
     * Memoria de otra persona.
     * No debe influir.
     */
    ownerId: "user-B",
    teamName: "Palmeiras",
    outcome: "loss",
    opponentName: "Santos",
  },
];

const alerts =
  detector.execute({
    ownerId: "user-A",
    matches,
    events,
    now,
  });

console.log(
  "\n===== TEAM MEMORY LIVE ====="
);

console.table(
  alerts.map(alert => ({
    matchKey: alert.matchKey,
    team: alert.teamName,
    wins: alert.wins,
    losses: alert.losses,
    previousOpponentWins:
      alert.previousOpponentWins,
  }))
);

assert.equal(alerts.length, 1);

assert.equal(
  alerts[0].matchKey,
  "test:palmeiras-santos"
);

assert.equal(
  alerts[0].wins,
  2
);

assert.equal(
  alerts[0].losses,
  1
);

assert.equal(
  alerts[0].previousOpponentWins,
  1
);

assert.match(
  alerts[0].body,
  /la última vez.*te hizo ganar/i
);

const otherUser =
  detector.execute({
    ownerId: "user-B",
    matches: [
      {
        matchKey: "test:unrelated",
        homeName: "Corinthians",
        awayName: "Flamengo",
        isLive: true,
        minute: 3,
      },
    ],
    events,
    now,
  });

assert.equal(
  otherUser.length,
  0
);

console.log(
  "\n===== NOTIFICACIÓN SIMULADA ====="
);

console.log(alerts[0].title);
console.log(alerts[0].body);

console.log(
  "\nOK: detecta equipo con historial"
);

console.log(
  "OK: reconoce rival repetido"
);

console.log(
  "OK: cuenta ganancias y pérdidas"
);

console.log(
  "OK: excluye partidos avanzados"
);

console.log(
  "OK: aísla memoria por usuario"
);

console.log(
  "OK: ninguna notificación enviada"
);

