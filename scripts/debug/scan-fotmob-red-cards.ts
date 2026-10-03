import type {
  LiveMatch,
} from "../../src/modules/football/domain/entities/LiveMatch";

import {
  FotMobClient,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobClient";

import {
  FotMobRedCardExtractor,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobRedCardExtractor";

import {
  FotMobRedCardProvider,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobRedCardProvider";

import {
  FotMobRedCardScanner,
} from "../../src/modules/radar/infrastructure/fotmob/FotMobRedCardScanner";

interface LiveResponse {
  count?:
    number;

  matches?:
    LiveMatch[];

  data?:
    LiveMatch[];
}

async function getLiveMatches():
  Promise<
    LiveMatch[]
  > {

  const response =
    await fetch(
      "http://127.0.0.1:8000/api/v1/football/live"
    );

  if (!response.ok) {
    throw new Error(
      `Football Radar HTTP ${response.status}`
    );
  }

  const body =
    await response
      .json() as
      LiveResponse;

  if (
    Array.isArray(
      body.matches
    )
  ) {
    return body.matches;
  }

  if (
    Array.isArray(
      body.data
    )
  ) {
    return body.data;
  }

  return [];
}

async function main() {

  const matches =
    await getLiveMatches();

  const bookmakerMatches =
    matches.filter(
      (
        match
      ) =>
        match.sources.some(
          (
            source
          ) =>
            source.provider ===
            "bookmaker"
        )
    );

  const fotmobMatches =
    matches.filter(
      (
        match
      ) =>
        match.sources.some(
          (
            source
          ) =>
            source.provider ===
            "fotmob"
        )
    );

  const both =
    matches.filter(
      (
        match
      ) => {

        const providers =
          new Set(
            match.sources.map(
              (
                source
              ) =>
                source.provider
            )
          );

        return (
          providers.has(
            "bookmaker"
          ) &&
          providers.has(
            "fotmob"
          )
        );
      }
    );

  console.log(
    "\n=============================="
  );

  console.log(
    "LIVE TOTAL:",
    matches.length
  );

  console.log(
    "CON 1XBET:",
    bookmakerMatches.length
  );

  console.log(
    "CON FOTMOB:",
    fotmobMatches.length
  );

  console.log(
    "1XBET + FOTMOB:",
    both.length
  );

  console.log(
    "==============================\n"
  );

  if (
    fotmobMatches.length ===
    0
  ) {

    console.log(
      "No hay partidos enriquecidos con FotMob."
    );

    console.log(
      "No hacemos ninguna consulta de rojas."
    );

    return;
  }

  const client =
    new FotMobClient();

  const provider =
    new FotMobRedCardProvider(
      client,
      new FotMobRedCardExtractor()
    );

  const scanner =
    new FotMobRedCardScanner(
      provider,

      10_000,

      4
    );

  const redCards =
    await scanner.scan(
      matches
    );

  console.log(
    "PARTIDOS CON ROJA FOTMOB:",
    redCards.length
  );

  for (
    const item
    of redCards
  ) {

    console.log(
      "\n🔴 ========================="
    );

    console.log({
      competition:
        item.match
          .competition
          .name,

      home:
        item.match
          .home
          .name,

      away:
        item.match
          .away
          .name,

      score:
        `${item.match.home.goals ?? "-"}-${item.match.away.goals ?? "-"}`,

      minute:
        item.match
          .status
          .minute,

      fotmobId:
        item
          .fotmobExternalId,

      homeRedCards:
        item.snapshot
          .homeRedCards,

      awayRedCards:
        item.snapshot
          .awayRedCards,

      confidence:
        item.snapshot
          .confidence,

      events:
        item.snapshot
          .events,
    });
  }
}

void main();
