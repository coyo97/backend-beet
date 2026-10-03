import type {
  LiveMatch,
} from "../../src/modules/football/domain/entities/LiveMatch";

import {
  OneXBetLiveClient,
} from "../../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveSnapshotExtractor,
} from "../../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveSnapshotExtractor";

import {
  OneXBetLiveSnapshotProvider,
} from "../../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveSnapshotProvider";

interface Response {
  matches?:
    LiveMatch[];

  data?:
    LiveMatch[];
}

async function main() {

  const response =
    await fetch(
      "http://127.0.0.1:8000/api/v1/football/live"
    );

  if (!response.ok) {
    throw new Error(
      `Radar HTTP ${response.status}`
    );
  }

  const body =
    await response
      .json() as
      Response;

  const matches =
    body.matches ??
    body.data ??
    [];

  const bookmaker =
    matches.flatMap(
      (
        match
      ) => {

        const source =
          match.sources.find(
            (
              item
            ) =>
              item.provider ===
              "bookmaker"
          );

        if (!source) {
          return [];
        }

        return [
          {
            match,
            externalId:
              source.externalId,
          },
        ];
      }
    );

  console.log(
    "Partidos 1xBet:",
    bookmaker.length
  );

  const provider =
    new OneXBetLiveSnapshotProvider(
      new OneXBetLiveClient(
        process.env
          .ONEXBET_LIVE_URL ??
        "https://afg.1xbet.com/en/live/football"
      ),

      new OneXBetLiveSnapshotExtractor(),

      10_000
    );

  const snapshots =
    await provider
      .getSnapshots(
        bookmaker.map(
          (
            item
          ) =>
            item.externalId
        )
      );

  const byId =
    new Map(
      snapshots.map(
        (
          snapshot
        ) => [
          snapshot.externalId,
          snapshot,
        ]
      )
    );

  for (
    const item
    of bookmaker
  ) {

    const snapshot =
      byId.get(
        item.externalId
      );

    console.log(
      "\n================================="
    );

    console.log(
      item.match
        .competition
        .name
    );

    console.log(
      `${item.match.home.name} vs ${item.match.away.name}`
    );

    console.log(
      "1xBet ID:",
      item.externalId
    );

    if (!snapshot) {

      console.log(
        "Snapshot: NO ENCONTRADO"
      );

      continue;
    }

    console.log(
      "score:",
      snapshot.homeScore,
      "-",
      snapshot.awayScore
    );

    console.log(
      "clock:",
      snapshot.clock
    );

    console.log(
      "red:",
      snapshot.homeRedCards,
      "-",
      snapshot.awayRedCards
    );

    console.log(
      "RED-LIKE FIELDS:",
      snapshot.redLikeFields
    );

    console.log(
      "CARD-LIKE FIELDS:",
      snapshot.cardLikeFields
    );

    console.log(
      "STAT-LIKE FIELDS:",
      snapshot.statLikeFields
    );
  }
}

void main();
