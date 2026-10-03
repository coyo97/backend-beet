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

import {
  OneXBetRedCardScanner,
} from "../../src/modules/radar/infrastructure/onexbet/OneXBetRedCardScanner";

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

import {
  MultiSourceRedCardAggregator,
} from "../../src/modules/radar/application/services/MultiSourceRedCardAggregator";

interface LiveResponse {
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
      `Live endpoint HTTP ${response.status}`
    );
  }

  const json =
    await response
      .json() as
      LiveResponse;

  return (
    json.matches ??
    json.data ??
    []
  );
}

async function getExistingRadarCount():
  Promise<
    number | null
  > {

  try {

    const response =
      await fetch(
        "http://127.0.0.1:8000/api/v1/radar/red-cards"
      );

    if (!response.ok) {
      return null;
    }

    const json:
      any =
        await response
          .json();

    if (
      Array.isArray(
        json
      )
    ) {
      return json.length;
    }

    const candidates = [
      json.matches,
      json.items,
      json.data,
      json.redCards,
    ];

    for (
      const candidate
      of candidates
    ) {

      if (
        Array.isArray(
          candidate
        )
      ) {
        return candidate.length;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function main() {

  const liveMatches =
    await getLiveMatches();

  console.log(
    "\n================================"
  );

  console.log(
    "LIVE TOTAL:",
    liveMatches.length
  );

  const bookmaker =
    liveMatches.filter(
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

  const fotmob =
    liveMatches.filter(
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

  const flashscore =
    liveMatches.filter(
      (
        match
      ) =>
        match.sources.some(
          (
            source
          ) =>
            source.provider ===
            "flashscore"
        )
    );

  console.log(
    "1XBET:",
    bookmaker.length
  );

  console.log(
    "FOTMOB:",
    fotmob.length
  );

  console.log(
    "FLASHSCORE:",
    flashscore.length
  );

  /*
   * 1xBet
   */
  const oneXBetSnapshots =
    new OneXBetLiveSnapshotProvider(
      new OneXBetLiveClient(
        process.env
          .ONEXBET_LIVE_URL ??
        "https://afg.1xbet.com/en/live/football"
      ),

      new OneXBetLiveSnapshotExtractor(),

      10_000
    );

  const oneXBetScanner =
    new OneXBetRedCardScanner(
      oneXBetSnapshots
    );

  /*
   * FotMob
   */
  const fotMobClient =
    new FotMobClient();

  const fotMobRedCards =
    new FotMobRedCardProvider(
      fotMobClient,

      new FotMobRedCardExtractor()
    );

  const fotMobScanner =
    new FotMobRedCardScanner(
      fotMobRedCards,
      10_000,
      4
    );

  /*
   * Aggregator
   */
  const aggregator =
    new MultiSourceRedCardAggregator(
      oneXBetScanner,
      fotMobScanner
    );

  const detections =
    await aggregator.scan(
      liveMatches
    );

  console.log(
    "\n================================"
  );

  console.log(
    "NUEVO AGGREGATOR:",
    detections.length
  );

  const oldRadar =
    await getExistingRadarCount();

  console.log(
    "RADAR EXISTENTE:",
    oldRadar ??
      "estructura desconocida"
  );

  console.log(
    "================================"
  );

  for (
    const detection
    of detections
  ) {

    console.log(
      "\n🔴 RED CARD"
    );

    console.log({
      competition:
        detection.match
          .competition
          .name,

      home:
        detection.match
          .home
          .name,

      away:
        detection.match
          .away
          .name,

      score:
        `${detection.match.home.goals ?? "-"}-${detection.match.away.goals ?? "-"}`,

      minute:
        detection.match
          .status
          .minute,

      homeRedCards:
        detection
          .homeRedCards,

      awayRedCards:
        detection
          .awayRedCards,

      sources:
        detection
          .sources,

      confidence:
        detection
          .confidence,

      events:
        detection
          .events,
    });
  }
}

void main();
