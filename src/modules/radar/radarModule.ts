import {
  getLiveMatches,
  flashscoreIncidentProvider,
} from "../football/footballModule";

import {
  GetRedCardMatches,
} from "./application/use-cases/GetRedCardMatches";

import {
  SocketIoRedCardDetectedPublisher,
} from "./infrastructure/socket/SocketIoRedCardDetectedPublisher";


import {
  getLiveOpportunities,
} from "../opportunity-filter/opportunityFilterModule";


import {
  GetUnifiedRedCardMatchesForSignals,
} from "./application/use-cases/GetUnifiedRedCardMatchesForSignals";


import type {
  RedCardDetectedPublisher,
} from "./application/ports/RedCardDetectedPublisher";

import {
  alertRulesRepository,
} from "../alert-rules/alertRulesModule";

import {
  RedCardRulePushPublisher,
} from "../alert-rules/infrastructure/publishers/RedCardRulePushPublisher";


import {
  GetRedCardDetectedSignals,
} from "./application/use-cases/GetRedCardDetectedSignals";

import {
  RedCardDetectedRegistry,
} from "./application/services/RedCardDetectedRegistry";

import {
  RedCardDetectedScheduler,
} from "./application/services/RedCardDetectedScheduler";

import {
  ConsoleRedCardDetectedPublisher,
} from "./infrastructure/publishers/ConsoleRedCardDetectedPublisher";

import {
  RedCardDetectedController,
} from "./infrastructure/http/RedCardDetectedController";

import {
  GetUnifiedRedCards,
} from "./application/use-cases/GetUnifiedRedCards";

import {
  UnifiedRedCardsController,
} from "./infrastructure/http/UnifiedRedCardsController";

import {
  createSupplementalRedCardsModule,
} from "./supplementalRedCardsModule";

import {
  watchlistSignalMatcher,
} from "../watchlist/watchlistModule";

import {
  WatchlistRadarSignalPublisher,
} from "../watchlist/infrastructure/socket/WatchlistRadarSignalPublisher";

import {
  pushDeviceRepository,
  pushNotificationSender,
  pushReceiptRepository,
  pushPreferencesRepository,
} from "../notifications/notificationModule";

import {
  WatchlistPushPublisher,
} from "../notifications/infrastructure/radar/WatchlistPushPublisher";

import {
  RadarController,
} from "./presentation/controllers/RadarController";

import {
  createRadarRouter,
} from "./presentation/routes/radarRoutes";

import {
  getMatchStatistics,
} from "../football/footballModule";

import {
  AnalyzeMatchPressure,
} from "./application/use-cases/AnalyzeMatchPressure";

import {
  GetRedCardPressureSignals,
} from "./application/use-cases/GetRedCardPressureSignals";

import {
  env,
} from "../../config/env";

import {
  InMemoryRadarSignalStore,
} from "./infrastructure/store/InMemoryRadarSignalStore";

import {
  StoreRadarSignalPublisher,
} from "./infrastructure/publishers/StoreRadarSignalPublisher";

import {
  CompositeRadarSignalPublisher,
} from "./infrastructure/publishers/CompositeRadarSignalPublisher";

import type {
  SocketServer,
} from "../../shared/infrastructure/socket/SocketServer";

import {
  SignalRegistry,
} from "./application/services/SignalRegistry";

import {
  RadarScheduler,
} from "./application/services/RadarScheduler";

import {
  SocketIoRadarSignalPublisher,
} from "./infrastructure/socket/SocketIoRadarSignalPublisher";

const getRedCardMatches =
  new GetRedCardMatches(
    getLiveMatches,
    flashscoreIncidentProvider
  );



  export const analyzeMatchPressure =
  new AnalyzeMatchPressure(
    getMatchStatistics
  );
 
export const recentRadarSignalStore =
  new InMemoryRadarSignalStore({
    ttlMs:
      env.RADAR_HISTORY_TTL_MS,

    maxItems:
      env.RADAR_HISTORY_MAX_ITEMS,
  });

 

/*
 * Radar suplementario.
 *
 * Utiliza exactamente el mismo
 * getLiveMatches que el resto
 * del módulo football.
 */
export const supplementalRedCardsModule =
  createSupplementalRedCardsModule(
    getLiveMatches
  );

  export const unifiedRedCardMatchesForSignals =
  new GetUnifiedRedCardMatchesForSignals(
    getRedCardMatches,

    getLiveMatches,

    supplementalRedCardsModule
      .aggregator
  );

  export const getRedCardDetectedSignals =
  new GetRedCardDetectedSignals(
    unifiedRedCardMatchesForSignals
  );

  export const redCardDetectedRegistry =
  new RedCardDetectedRegistry(
    env.RADAR_SIGNAL_TTL_MS
  );

const redCardDetectedController =
  new RedCardDetectedController(
    getRedCardDetectedSignals
  );


   export const getRedCardPressureSignals =
  new GetRedCardPressureSignals(
    unifiedRedCardMatchesForSignals,
    analyzeMatchPressure
  );


const radarController =
  new RadarController(
    getRedCardMatches,
    analyzeMatchPressure,
    getRedCardPressureSignals,
    recentRadarSignalStore
  );
  const getUnifiedRedCards =
  new GetUnifiedRedCards(
    async () =>
      getRedCardMatches
        .execute(),

    supplementalRedCardsModule
      .getSupplementalRedCards
  );

const unifiedRedCardsController =
  new UnifiedRedCardsController(
    getUnifiedRedCards
  );

export const radarRouter =
  createRadarRouter(
    radarController,

    supplementalRedCardsModule
      .controller,

    unifiedRedCardsController,

    redCardDetectedController
  );

export function createRadarScheduler(
  socketServer:
    SocketServer
): RadarScheduler {

const watchlistPushPublisher =
  new WatchlistPushPublisher(
    watchlistSignalMatcher,
    pushDeviceRepository,
    pushReceiptRepository,
    pushPreferencesRepository,
    pushNotificationSender
  );

  const registry =
    new SignalRegistry(
      env
        .RADAR_SIGNAL_TTL_MS
    );

const socketPublisher =
  new SocketIoRadarSignalPublisher(
    socketServer
  );

const storePublisher =
  new StoreRadarSignalPublisher(
    recentRadarSignalStore
  );

  const watchlistPublisher =
  new WatchlistRadarSignalPublisher(
    watchlistSignalMatcher,
    socketServer
  );

const publisher =
  new CompositeRadarSignalPublisher([
    storePublisher,
    socketPublisher,
    watchlistPublisher,
	watchlistPushPublisher,
  ]);


  return new RadarScheduler(
    getRedCardPressureSignals,

    registry,

    publisher,

    {
      intervalMs:
        env
          .RADAR_SCAN_INTERVAL_MS,
    }
  );
}


export function createRedCardDetectedScheduler(
  socketServer: SocketServer
): RedCardDetectedScheduler {

  /*
   * Publicador existente.
   *
   * Mantiene los eventos en vivo
   * que ya recibe la APK.
   */
  const socketPublisher =
    new SocketIoRedCardDetectedPublisher(
      socketServer
    );

  /*
   * Nuevo publicador.
   *
   * Evalua las reglas guardadas
   * en MongoDB y envia push solo
   * a los dispositivos del dueño.
   */

const rulePushPublisher =
  new RedCardRulePushPublisher(
    alertRulesRepository,

    pushDeviceRepository,

    pushPreferencesRepository,

    pushReceiptRepository,

    pushNotificationSender,

    /*
     * Lectura síncrona.
     *
     * No invocamos execute().
     * No hacemos nuevas consultas.
     */
    match =>
      getLiveOpportunities
        .peekCachedContext(match)
  );


  /*
   * Ambos sistemas funcionan de
   * manera independiente.
   *
   * Un fallo de Expo no debe
   * interrumpir Socket.IO.
   */
  const publisher: RedCardDetectedPublisher = {
    async publish(signal) {

      try {
        await socketPublisher.publish(
          signal
        );
      } catch (error) {
        console.error(
          "[RedCardDetected] Socket.IO failed",
          error
        );
      }

      try {
        await rulePushPublisher.publish(
          signal
        );
      } catch (error) {
        console.error(
          "[RedCardDetected] Rule push failed",
          error
        );
      }
    },
  };

  return new RedCardDetectedScheduler(
    getRedCardDetectedSignals,

    redCardDetectedRegistry,

    publisher,

    {
      intervalMs:
        env.RADAR_SCAN_INTERVAL_MS,
    }
  );
}

