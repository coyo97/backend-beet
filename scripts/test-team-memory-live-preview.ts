
import assert from "node:assert/strict";

import type {
  LiveMatch,
} from "../src/modules/football/domain/entities/LiveMatch";

import {
  LiveMatchesSnapshotStore,
} from "../src/modules/football/application/services/LiveMatchesSnapshotStore";

import {
  TeamMemoryLivePreviewScheduler,
} from "../src/modules/notifications/infrastructure/schedulers/TeamMemoryLivePreviewScheduler";

import type {
  OwnerTeamMemoryLiveAlert,
} from "../src/modules/notifications/application/services/FindTeamMemoryLiveAlerts";

async function main() {

  const now = new Date();

  const snapshot =
    new LiveMatchesSnapshotStore();

  const match: LiveMatch = {
    sources: [
      {
        provider: "flashscore",
        externalId: "PREVIEW-TEST",
      },
    ],

    kickoffAt: now.toISOString(),

    status: {
      long: "First Half",
      short: "1H",
      minute: 3,
    },

    competition: {
      id: null,
      name: "Liga de prueba",
      country: "Brasil",
      logo: null,
      flag: null,
      season: null,
      round: null,
    },

    home: {
      id: null,
      name: "Equipo Prueba A",
      logo: null,
      goals: 0,
      winner: null,
    },

    away: {
      id: null,
      name: "Equipo Prueba B",
      logo: null,
      goals: 0,
      winner: null,
    },

    dataAvailability: {
      score: true,
      events: false,
      redCards: false,
      statistics: false,
      possession: false,
      shots: false,
      corners: false,
      lineups: false,
      odds: false,
    },
  };

  snapshot.observe([match], now);

  let finderCalls = 0;

  const makeAlert = (
    ownerId: string
  ): OwnerTeamMemoryLiveAlert => ({
    ownerId,
    matchKey: "preview-test-match",
    type: "TEAM_MEMORY_LIVE",
    teamName: "Equipo Prueba A",
    opponentName: "Equipo Prueba B",
    wins: 1,
    losses: 0,
    previousOpponentWins: 0,
    previousOpponentLosses: 0,
    title: "Equipo conocido está jugando",
    body: "Aviso simulado",
  });

  const finder = {
    execute: async (
      matches: readonly LiveMatch[]
    ): Promise<OwnerTeamMemoryLiveAlert[]> => {

      finderCalls++;

      assert.equal(
        matches.length,
        1
      );

      return [
        makeAlert("user-A"),
        makeAlert("user-B"),
      ];
    },
  };

  const scheduler =
    new TeamMemoryLivePreviewScheduler(
      snapshot,
      finder
    );

  try {
    console.log(
      "\n===== SNAPSHOT RECIENTE ====="
    );

    const first =
      await scheduler.runOnce(now);

    assert.equal(first.status, "ok");
    assert.equal(first.liveMatches, 1);
    assert.equal(first.candidateAlerts, 2);
    assert.equal(first.owners, 2);
    assert.equal(first.sent, 0);

    console.log(
      "OK: dos avisos personales detectados"
    );

    console.log(
      "\n===== SNAPSHOT VENCIDO ====="
    );

    const later =
      new Date(
        now.getTime() + 121_000
      );

    const second =
      await scheduler.runOnce(later);

    assert.equal(
      second.status,
      "no-fresh-matches"
    );

    assert.equal(
      second.candidateAlerts,
      0
    );

    assert.equal(
      finderCalls,
      1
    );

    console.log(
      "OK: snapshot antiguo descartado"
    );

    console.log(
      "OK: ninguna consulta adicional al proveedor"
    );

    console.log(
      "OK: ningún envío Expo"
    );

  } finally {
    scheduler.stop();
  }
}

void main().catch(error => {
  console.error(
    "[TeamMemoryLivePreviewTest]",
    error
  );

  process.exitCode = 1;
});

