
import {
  randomUUID,
} from "node:crypto";

import "dotenv/config";

import assert from "node:assert/strict";

import mongoose from "mongoose";

import type {
  LiveMatch,
} from "../src/modules/football/domain/entities/LiveMatch";

import {
  liveMatchesSnapshotStore,
} from "../src/modules/football/application/services/LiveMatchesSnapshotStore";

import {
  normalizeTeamName,
} from "../src/modules/team-memory/domain/services/normalizeTeamName";

import {
  TeamMemoryEventModel,
} from "../src/modules/team-memory/infrastructure/database/models/TeamMemoryEventModel";

import {
  FindTeamMemoryLiveAlerts,
} from "../src/modules/notifications/application/services/FindTeamMemoryLiveAlerts";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

function makeMatch(
  homeName: string,
  awayName: string,
  minute: number,
  now: Date,
  status = "1H"
): LiveMatch {

  return {
    sources: [
      {
        provider: "flashscore",
        externalId: "TEST-ONLY",
      },
    ],

    kickoffAt:
      new Date(
        now.getTime() -
        minute * 60_000
      ).toISOString(),

    status: {
      long:
        status === "NS"
          ? "Not Started"
          : "First Half",

      short: status,

      minute:
        status === "NS"
          ? null
          : minute,
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
      name: homeName,
      logo: null,
      goals: 0,
      winner: null,
    },

    away: {
      id: null,
      name: awayName,
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
}

async function main() {

	const testTeam =
  `Radar-Test-${randomUUID()}`;

  const ownerA =
    new mongoose.Types.ObjectId().toString();

  const ownerB =
    new mongoose.Types.ObjectId().toString();

  const ownerC =
    new mongoose.Types.ObjectId().toString();


  const now =
    new Date();

  await connectDatabase();

  try {

    await TeamMemoryEventModel.create([
      {
        ownerId: ownerA,
        teamName: testTeam,
        teamKey: normalizeTeamName(testTeam),
        outcome: "win",
        opponentName: "Santos",
      },

      {
        ownerId: ownerA,
        teamName: testTeam,
        teamKey: normalizeTeamName(testTeam),
        outcome: "win",
        opponentName: "Corinthians",
      },

      {
        ownerId: ownerA,
        teamName: testTeam,
        teamKey: normalizeTeamName(testTeam),
        outcome: "loss",
        opponentName: "Flamengo",
      },

      {
        ownerId: ownerB,
        teamName: testTeam,
        teamKey: normalizeTeamName(testTeam),
        outcome: "loss",
        opponentName: "Santos",
      },

      {
        ownerId: ownerC,
        teamName: "Flamengo",
        teamKey: normalizeTeamName("Flamengo"),
        outcome: "win",
        opponentName: "Gremio",
      },
    ]);

    const matches = [
      makeMatch(
        testTeam,
        "Santos",
        5,
        now
      ),

      /*
       * Un segundo proveedor
       * devuelve el mismo partido.
       *
       * La alerta debe deduplicarse.
       */
      {
        ...makeMatch(
          testTeam,
          "Santos",
          5,
          now
        ),

        sources: [
          {
            provider:
              "fotmob" as const,

            externalId:
              "SECOND-PROVIDER",
          },
        ],
      },

      /*
       * Partido demasiado avanzado.
       */
      makeMatch(
        "Flamengo",
        "Gremio",
        55,
        now
      ),

      /*
       * Partido que no empezó.
       */
      makeMatch(
        testTeam,
        "Corinthians",
        0,
        now,
        "NS"
      ),
    ];

	/*
 * Simular que GetLiveMatches
 * ya obtuvo estos encuentros.
 */
liveMatchesSnapshotStore.observe(
  matches,
  now
);

const cachedMatches =
  liveMatchesSnapshotStore.getFresh(
    120_000,
    now
  );

assert.equal(
  cachedMatches.length,
  matches.length
);
	
    const scanner =
      new FindTeamMemoryLiveAlerts();

    console.log(
      "\n===== TEAM MEMORY + MONGODB ====="
    );

    const alerts =
  await scanner.execute(
    cachedMatches,
    now
  );

    console.table(
      alerts.map(alert => ({
        ownerId: alert.ownerId,
        team: alert.teamName,
        opponent: alert.opponentName,
        wins: alert.wins,
        losses: alert.losses,
        againstOpponent:
          alert.previousOpponentWins,
      }))
    );

    /*
     * Dos usuarios tienen memoria
     * sobre Palmeiras.
     *
     * Cada uno obtiene un aviso.
     */
    assert.equal(
      alerts.length,
      2
    );

    const alertA =
      alerts.find(
        alert =>
          alert.ownerId === ownerA
      );

    const alertB =
      alerts.find(
        alert =>
          alert.ownerId === ownerB
      );

    assert.ok(alertA);
    assert.ok(alertB);

    /*
     * Historial del usuario A.
     */
    assert.equal(
      alertA.wins,
      2
    );

    assert.equal(
      alertA.losses,
      1
    );

    assert.equal(
      alertA.previousOpponentWins,
      1
    );

    /*
     * Historial del usuario B.
     *
     * No hereda datos del A.
     */
    assert.equal(
      alertB.wins,
      0
    );

    assert.equal(
      alertB.losses,
      1
    );

    assert.equal(
      alertB.previousOpponentWins,
      0
    );

    /*
     * El usuario C solo tiene
     * memoria de Flamengo, cuyo
     * partido ya está avanzado.
     */
    assert.ok(
      !alerts.some(
        alert =>
          alert.ownerId === ownerC
      )
    );

    /*
     * Las dos fuentes del partido
     * deben producir una única
     * identidad por usuario.
     */
    assert.equal(
      alertA.matchKey,
      alertB.matchKey
    );

    console.log(
      "\n===== AVISO DEL USUARIO A ====="
    );

    console.log(
      alertA.title
    );

    console.log(
      alertA.body
    );

    console.log(
      "\n===== AVISO DEL USUARIO B ====="
    );

    console.log(
      alertB.title
    );

    console.log(
      alertB.body
    );

    console.log(
      "\nOK: datos reales de MongoDB"
    );

    console.log(
      "OK: un historial por usuario"
    );

    console.log(
      "OK: dos proveedores sin duplicado"
    );

    console.log(
      "OK: partidos avanzados excluidos"
    );

    console.log(
      "OK: ningún envío realizado"
    );

  } finally {

    /*
     * Eliminar únicamente los
     * eventos ficticios de esta
     * ejecución.
     */
    await TeamMemoryEventModel
      .deleteMany({
        ownerId: {
          $in: [
            ownerA,
            ownerB,
            ownerC,
          ],
        },
      });

    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(
    "[TeamMemoryLiveMongoTest]",
    error
  );

  process.exitCode = 1;
});

