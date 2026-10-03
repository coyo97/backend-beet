import type {
  LiveMatch,
} from "../football/domain/entities/LiveMatch";

import {
  OneXBetLiveClient,
} from "../football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveSnapshotExtractor,
} from "../football/infrastructure/providers/onexbet/OneXBetLiveSnapshotExtractor";

import {
  sofascoreSessionClient,
} from "../football/footballModule";

import {
  SofascoreRedCardScanner,
} from "./infrastructure/sofascore/SofascoreRedCardScanner";


import {
  OneXBetLiveSnapshotProvider,
} from "../football/infrastructure/providers/onexbet/OneXBetLiveSnapshotProvider";

import {
  FotMobClient,
} from "../football/infrastructure/providers/fotmob/FotMobClient";

import {
  FotMobRedCardExtractor,
} from "../football/infrastructure/providers/fotmob/FotMobRedCardExtractor";

import {
  FotMobRedCardProvider,
} from "../football/infrastructure/providers/fotmob/FotMobRedCardProvider";

import {
  OneXBetRedCardScanner,
} from "./infrastructure/onexbet/OneXBetRedCardScanner";

import {
  FotMobRedCardScanner,
} from "./infrastructure/fotmob/FotMobRedCardScanner";

import {
  MultiSourceRedCardAggregator,
} from "./application/services/MultiSourceRedCardAggregator";

import {
  SupplementalRedCardMapper,
} from "./application/services/SupplementalRedCardMapper";

import {
  GetSupplementalRedCards,
} from "./application/use-cases/GetSupplementalRedCards";

import {
  SupplementalRedCardsController,
} from "./infrastructure/http/SupplementalRedCardsController";

import type {
  GetLiveMatches,
} from "../football/application/use-cases/GetLiveMatches";


export function createSupplementalRedCardsModule(
  getLiveMatches:
    GetLiveMatches
) {

  /*
   * 1xBet
   */
  const oneXBetClient =
    new OneXBetLiveClient(
      process.env
        .ONEXBET_LIVE_URL ??
        "https://afg.1xbet.com/en/live/football"
    );

  const oneXBetSnapshotProvider =
    new OneXBetLiveSnapshotProvider(
      oneXBetClient,

      new OneXBetLiveSnapshotExtractor(),

      Number(
        process.env
          .ONEXBET_LIVE_CACHE_MS ??
          10_000
      )
    );

  const oneXBetScanner =
    new OneXBetRedCardScanner(
      oneXBetSnapshotProvider
    );

  /*
   * FotMob
   */
  const fotMobClient =
    new FotMobClient();

  const fotMobRedCardProvider =
    new FotMobRedCardProvider(
      fotMobClient,

      new FotMobRedCardExtractor()
    );

  const fotMobScanner =
    new FotMobRedCardScanner(
      fotMobRedCardProvider,

      Number(
        process.env
          .FOTMOB_RED_CACHE_MS ??
          10_000
      ),

      4
    );

/*
 * SofaScore
 *
 * Reutilizamos la MISMA sesión que usa
 * football/live.
 */
const sofascoreScanner =
  process.env
    .SOFASCORE_LIVE_ENABLED ===
  "false"
    ? undefined
    : new SofascoreRedCardScanner(
        sofascoreSessionClient,

        Number(
          process.env
            .SOFASCORE_RED_CACHE_MS ??
            10_000
        ),

        4
      );

  /*
   * 1xBet + FotMob
   */
/*
 * 1xBet + FotMob + SofaScore
 */
const aggregator =
  new MultiSourceRedCardAggregator(
    oneXBetScanner,
    fotMobScanner,
    sofascoreScanner
  );

  const mapper =
    new SupplementalRedCardMapper();

  const getSupplementalRedCards =
    new GetSupplementalRedCards(
      getLiveMatches,
      aggregator,
      mapper
    );

  const controller =
    new SupplementalRedCardsController(
      getSupplementalRedCards
    );

  return {
    controller,
    getSupplementalRedCards,
    aggregator,
  };
}
