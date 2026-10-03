import {
  GetMatchContext,
} from "./application/use-cases/GetMatchContext";



import {
  FlashscoreMatchContextClient,
} from "./infrastructure/flashscore/FlashscoreMatchContextClient";

import {
  FlashscoreMatchContextProvider,
} from "./infrastructure/flashscore/FlashscoreMatchContextProvider";

import {
  sofascoreSessionClient,
} from "../football/footballModule";

import {
  SofascorePregameFormContextProvider,
} from "./infrastructure/sofascore/SofascorePregameFormContextProvider";

import {
  FotMobClient,
} from "../football/infrastructure/providers/fotmob/FotMobClient";

import {
  FotMobMatchContextProvider,
} from "./infrastructure/fotmob/FotMobMatchContextProvider";

import {
  MatchContextController,
} from "./presentation/controllers/MatchContextController";

import {
  CompetitionExternalSourceRegistry,
} from "./infrastructure/external-sources/CompetitionExternalSourceRegistry";

import {
  SofascoreCompetitionContextResolver,
} from "./infrastructure/sofascore/SofascoreCompetitionContextResolver";

import {
  SofascoreBrowser,
} from "../football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

import {
  SofascoreStandingsBrowserProvider,
} from "../football/infrastructure/providers/sofascore-browser/SofascoreStandingsBrowserProvider";

import {
  createMatchContextRouter,
} from "./presentation/routes/matchContextRoutes";

/*
 * ========================================
 * FLASHSCORE
 * ========================================
 */

const flashscoreClient =
  new FlashscoreMatchContextClient();

const flashscoreProvider =
  new FlashscoreMatchContextProvider(
    flashscoreClient
  );

/*
 * ========================================
 * FOTMOB
 * ========================================
 */

const fotMobClient =
  new FotMobClient();

const fotMobProvider =
  new FotMobMatchContextProvider(
    fotMobClient
  );
  
/*
 * ========================================
 * SOFASCORE DIRECT EVENT CONTEXT
 * ========================================
 *
 * Reutiliza la misma sesión persistente
 * que football/live y el Radar.
 */
const sofascorePregameFormProvider =
  new SofascorePregameFormContextProvider(
    sofascoreSessionClient
  );
/*
 * ========================================
 * USE CASE
 *
 * GetMatchContext ya trabaja con
 * múltiples providers.
 *
 * Orden:
 * 1. Flashscore
 * 2. FotMob
 *
 * Cada provider decide si soporta
 * el MatchSource recibido.
 * ========================================
 */

/*
 * ========================================
 * SOFASCORE BROWSER FALLBACK
 * ========================================
 */

const sofascoreBrowser =
  new SofascoreBrowser();

const competitionExternalSourceRegistry =
  new CompetitionExternalSourceRegistry();

const sofascoreStandingsProvider =
  new SofascoreStandingsBrowserProvider(
    sofascoreBrowser
  );

const sofascoreContextResolver =
  new SofascoreCompetitionContextResolver(
    competitionExternalSourceRegistry,
    sofascoreStandingsProvider
  );

export const getMatchContext =
  new GetMatchContext(
    [
      flashscoreProvider,
      fotMobProvider,
      sofascorePregameFormProvider,
    ],
    120_000,
    sofascoreContextResolver
  );

/*
 * ========================================
 * CONTROLLER
 * ========================================
 */

const controller =
  new MatchContextController(
    getMatchContext
  );

/*
 * ========================================
 * ROUTER
 * ========================================
 */

export const matchContextRouter =
  createMatchContextRouter(
    controller
  );
