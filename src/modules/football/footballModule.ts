import {
  ApiFootballProvider,
} from "./infrastructure/providers/api-football/ApiFootballProvider";

import {
  FlashscoreClient,
} from "./infrastructure/providers/flashscore/FlashscoreClient";

import {
  FlashscoreProvider,
} from "./infrastructure/providers/flashscore/FlashscoreProvider";

import {
  FlashscoreMatchIncidentProvider,
} from "./infrastructure/providers/flashscore/FlashscoreMatchIncidentProvider";

import {
  FlashscoreMatchStatisticsProvider,
} from "./infrastructure/providers/flashscore/FlashscoreMatchStatisticsProvider";

import {
  FotMobClient,
} from "./infrastructure/providers/fotmob/FotMobClient";

import {
  FotMobFixtureCatalog,
} from "./infrastructure/providers/fotmob/FotMobFixtureCatalog";

import {
  FotMobMatchResolver,
} from "./infrastructure/providers/fotmob/FotMobMatchResolver";

import {
  FotMobEnrichingFootballProvider,
} from "./infrastructure/providers/fotmob/FotMobEnrichingFootballProvider";

import {
  OneXBetLiveClient,
} from "./infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "./infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

import {
  OneXBetLiveProvider,
} from "./infrastructure/providers/onexbet/OneXBetLiveProvider";

import {
  SofascoreSessionClient,
} from "./infrastructure/providers/sofascore-browser/SofascoreSessionClient";

import {
  SofascoreLiveProvider,
} from "./infrastructure/providers/sofascore-browser/SofascoreLiveProvider";

import {
  CompositeFootballProvider,
} from "./infrastructure/providers/CompositeFootballProvider";

import {
  CachedFootballProvider,
} from "./infrastructure/providers/CachedFootballProvider";

import {
  GetMatchStatistics,
} from "./application/use-cases/GetMatchStatistics";

import {
  GetLiveMatches,
} from "./application/use-cases/GetLiveMatches";

import {
  FootballController,
} from "./presentation/controllers/FootballController";

import {
  createFootballRouter,
} from "./presentation/routes/footballRoutes";

import {
  env,
} from "../../config/env";

/*
 * =========================================================
 * FLASHSCORE CLIENT
 * =========================================================
 *
 * Cliente compartido.
 *
 * Otros módulos también lo utilizan:
 *
 * - radar
 * - match-context
 * - incidents
 * - statistics
 *
 * IMPORTANTE:
 *
 * No modificamos el comportamiento Flashscore existente.
 * =========================================================
 */

export const flashscoreClient =
  new FlashscoreClient();

/*
 * =========================================================
 * API-FOOTBALL
 * =========================================================
 *
 * Fuente estructurada secundaria.
 *
 * Tiene cobertura limitada por nuestro plan, por lo que
 * NO debe ser la única fuente para descubrir partidos.
 * =========================================================
 */

const rawApiFootballProvider =
  new ApiFootballProvider();

const apiFootballProvider =
  new CachedFootballProvider(
    rawApiFootballProvider,
    {
      name:
        "api-football",

      ttlMs:
        env
          .API_FOOTBALL_LIVE_CACHE_MS,

      /*
       * API-Football tiene límite de requests.
       *
       * Si falla temporalmente podemos reutilizar
       * datos anteriores durante una hora.
       */
      staleIfErrorMs:
        60 *
        60 *
        1000,
    }
  );

/*
 * =========================================================
 * FLASHSCORE LIVE
 * =========================================================
 *
 * Flashscore continúa funcionando exactamente como antes.
 *
 * Nos sirve para:
 *
 * - live discovery cuando tiene cobertura
 * - incidentes
 * - tarjetas
 * - estadísticas
 * - contexto
 * - tablas
 *
 * Sabemos que no cubre todo el universo que aparece
 * en casas como 1xBet, pero NO lo reemplazamos.
 * =========================================================
 */

const rawFlashscoreProvider =
  new FlashscoreProvider(
    flashscoreClient
  );

const flashscoreProvider =
  new CachedFootballProvider(
    rawFlashscoreProvider,
    {
      name:
        "flashscore",

      ttlMs:
        env
          .FLASHSCORE_LIVE_CACHE_MS,

      staleIfErrorMs:
        5 *
        60 *
        1000,
    }
  );

/*
 * =========================================================
 * FOTMOB CLIENT
 * =========================================================
 *
 * IMPORTANTE:
 *
 * FotMob ya NO se utilizará como discovery provider
 * principal.
 *
 * Vimos que:
 *
 * matches?date=...
 *
 * puede devolver 0 partidos marcados como live aunque
 * existan partidos jugando en otras fuentes.
 *
 * Por tanto FotMob tendrá principalmente este papel:
 *
 *     ENRICHMENT
 *
 * Un partido es descubierto por:
 *
 * - Flashscore
 * - API-Football
 * - 1xBet
 *
 * y posteriormente intentamos encontrar el mismo partido
 * dentro del catálogo FotMob.
 *
 * Si encontramos coincidencia agregamos:
 *
 * {
 *   provider: "fotmob",
 *   externalId: "..."
 * }
 *
 * Esto permitirá posteriormente:
 *
 * - tabla
 * - posición
 * - forma
 * - matchDetails
 * - lineups
 * - estadísticas
 * - tarjetas
 * - incidentes
 *
 * Si FotMob falla:
 *
 * EL PARTIDO ORIGINAL NO DESAPARECE.
 * =========================================================
 */

export const fotMobClient =
  new FotMobClient();

/*
 * =========================================================
 * FOTMOB FIXTURE CATALOG
 * =========================================================
 *
 * Evitamos algo como:
 *
 * 50 partidos 1xBet
 * x
 * 3 fechas FotMob
 * =
 * 150 requests
 *
 * En cambio:
 *
 * ayer  -> 1 request
 * hoy   -> 1 request
 * mañana-> 1 request
 *
 * y mantenemos esos fixtures en memoria durante el TTL.
 * =========================================================
 */

export const fotMobFixtureCatalog =
  new FotMobFixtureCatalog(
    fotMobClient,

    Number(
      process.env
        .FOTMOB_FIXTURE_CACHE_MS ??
        30_000
    )
  );

/*
 * =========================================================
 * FOTMOB MATCH RESOLVER
 * =========================================================
 *
 * Compara:
 *
 * - equipo local
 * - equipo visitante
 * - competición
 * - hora aproximada
 *
 * y devuelve el matchId FotMob cuando existe una
 * coincidencia suficientemente segura.
 * =========================================================
 */

export const fotMobMatchResolver =
  new FotMobMatchResolver(
    fotMobFixtureCatalog
  );

/*
 * =========================================================
 * 1XBET LIVE DISCOVERY
 * =========================================================
 *
 * Esta es nuestra fuente de discovery de cobertura amplia.
 *
 * Ya comprobamos directamente que su HTML contiene:
 *
 * - Regional League W
 * - Student League
 * - Student League 2
 * - Short Football 5x5
 * - BudnesLiga LFL 5x5
 * - 4x4
 * - juveniles
 * - ligas menores
 * - partidos que Flashscore no estaba mostrando
 *
 * IMPORTANTE:
 *
 * 1xBet sirve principalmente para descubrir:
 *
 *     "este partido existe y se está jugando"
 *
 * No asumimos que tenga suficientes datos estructurados
 * para hacer análisis completo.
 * =========================================================
 */

const oneXBetLiveClient =
  new OneXBetLiveClient(
    process.env
      .ONEXBET_LIVE_URL ??
      "https://afg.1xbet.com/en/live/football"
  );

const oneXBetLiveParser =
  new OneXBetLiveHtmlParser();

const rawOneXBetLiveProvider =
  new OneXBetLiveProvider(
    oneXBetLiveClient,
    oneXBetLiveParser
  );

const oneXBetLiveProvider =
  new CachedFootballProvider(
    rawOneXBetLiveProvider,
    {
      name:
        "1xbet-live",

      ttlMs:
        Number(
          process.env
            .ONEXBET_LIVE_CACHE_MS ??
            15_000
        ),

      /*
       * Si 1xBet falla temporalmente,
       * conservamos hasta dos minutos
       * del último resultado.
       */
      staleIfErrorMs:
        2 *
        60 *
        1000,
    }
  );

  /*
 * =========================================================
 * SOFASCORE LIVE DISCOVERY
 * =========================================================
 *
 * SofaScore usa una sesión persistente de Playwright.
 *
 * Ya verificamos experimentalmente:
 *
 * GET /api/v1/sport/football/events/live
 *
 * devuelve todos los partidos en vivo visibles en
 * SofaScore cuando la sesión persistente es válida.
 *
 * También verificamos:
 *
 * /api/v1/event/{id}/incidents
 *
 * para tarjetas y rojas.
 *
 * Los incidents se conectarán al Radar después.
 * Aquí solamente utilizamos SofaScore como fuente
 * de discovery de partidos live.
 * =========================================================
 */

export const sofascoreSessionClient =
  new SofascoreSessionClient();

const rawSofascoreLiveProvider =
  new SofascoreLiveProvider(
    sofascoreSessionClient
  );

const sofascoreLiveProvider =
  new CachedFootballProvider(
    rawSofascoreLiveProvider,
    {
      name:
        "sofascore-live",

      ttlMs:
        Number(
          process.env
            .SOFASCORE_LIVE_CACHE_MS ??
            15_000
        ),

      /*
       * Si SofaScore falla temporalmente,
       * conservamos el último resultado
       * durante dos minutos.
       */
      staleIfErrorMs:
        2 *
        60 *
        1000,
    }
  );

/*
 * =========================================================
 * MATCH INCIDENTS
 * =========================================================
 *
 * NO CAMBIAMOS ESTO.
 *
 * Flashscore sigue siendo la fuente actual de:
 *
 * - goles
 * - amarillas
 * - rojas
 * - sustituciones
 * - VAR
 *
 * Más adelante FotMob será una SEGUNDA fuente.
 * =========================================================
 */

export const flashscoreIncidentProvider =
  new FlashscoreMatchIncidentProvider(
    flashscoreClient
  );

/*
 * =========================================================
 * MATCH STATISTICS
 * =========================================================
 *
 * NO CAMBIAMOS ESTO.
 *
 * Flashscore sigue siendo nuestro provider actual.
 *
 * Posteriormente podremos construir:
 *
 * CompositeMatchStatisticsProvider
 *
 * Flashscore
 *      +
 * FotMob
 * =========================================================
 */

export const flashscoreStatisticsProvider =
  new FlashscoreMatchStatisticsProvider(
    flashscoreClient
  );

/*
 * =========================================================
 * BASE LIVE PROVIDERS
 * =========================================================
 *
 * MUY IMPORTANTE:
 *
 * FotMob NO está aquí.
 *
 * Discovery real:
 *
 * API-Football
 * Flashscore
 * 1xBet
 *
 * FotMob va DESPUÉS como enriquecedor.
 * =========================================================
 */

const compositeProviders = [
  {
    name:
      "api-football",

    provider:
      apiFootballProvider,
  },

  {
    name:
      "flashscore",

    provider:
      flashscoreProvider,
  },

  /*
   * SofaScore puede desactivarse con:
   *
   * SOFASCORE_LIVE_ENABLED=false
   */
  ...(
    process.env
      .SOFASCORE_LIVE_ENABLED ===
    "false"
      ? []
      : [
          {
            name:
              "sofascore-live",

            provider:
              sofascoreLiveProvider,
          },
        ]
  ),

  /*
   * 1xBet puede desactivarse temporalmente con:
   *
   * ONEXBET_LIVE_ENABLED=false
   */
  ...(
    process.env
      .ONEXBET_LIVE_ENABLED ===
    "false"
      ? []
      : [
          {
            name:
              "1xbet-live",

            provider:
              oneXBetLiveProvider,
          },
        ]
  ),
];

/*
 * =========================================================
 * BASE COMPOSITE FOOTBALL PROVIDER
 * =========================================================
 *
 * Este provider representa TODO lo que ya conseguimos
 * descubrir antes de intentar usar FotMob.
 *
 *
 * EJEMPLO A
 * ---------------------------------------------------------
 *
 * Palmeiras vs Santos
 *
 * API-Football -> sí
 * Flashscore    -> sí
 * 1xBet         -> sí
 *
 * Después del dedupe:
 *
 * sources: [
 *   api-football,
 *   flashscore,
 *   bookmaker
 * ]
 *
 *
 * EJEMPLO B
 * ---------------------------------------------------------
 *
 * ECON vs SVET
 * Student League
 *
 * API-Football -> no
 * Flashscore    -> no
 * 1xBet         -> sí
 *
 * Resultado:
 *
 * sources: [
 *   bookmaker
 * ]
 *
 * Y EL PARTIDO SIGUE EXISTIENDO.
 * =========================================================
 */

export const baseFootballProvider =
  new CompositeFootballProvider(
    compositeProviders
  );

/*
 * =========================================================
 * FOTMOB ENRICHMENT
 * =========================================================
 *
 * Aquí ocurre algo muy diferente al discovery.
 *
 *
 * CASO 1
 * ---------------------------------------------------------
 *
 * Partido:
 *
 * Indonesia Liga 2
 * Equipo A vs Equipo B
 *
 * sources originales:
 *
 * [
 *   bookmaker
 * ]
 *
 * FotMobMatchResolver encuentra:
 *
 * matchId = 12345678
 *
 * Resultado:
 *
 * sources: [
 *   bookmaker,
 *   fotmob
 * ]
 *
 *
 * CASO 2
 * ---------------------------------------------------------
 *
 * Student League
 *
 * FotMob no lo conoce.
 *
 * Resultado:
 *
 * sources: [
 *   bookmaker
 * ]
 *
 * Nada se rompe.
 *
 *
 * CASO 3
 * ---------------------------------------------------------
 *
 * FotMob falla con:
 *
 * HTTP 403
 * HTTP 500
 * timeout
 * JSON inválido
 *
 * FotMobEnrichingFootballProvider devuelve el partido
 * original.
 *
 * No elimina Flashscore.
 * No elimina 1xBet.
 * No elimina API-Football.
 * =========================================================
 */

const enrichedFootballProvider =
  new FotMobEnrichingFootballProvider(
    baseFootballProvider,
    fotMobMatchResolver
  );

/*
 * =========================================================
 * PUBLIC FOOTBALL PROVIDER
 * =========================================================
 *
 * Permite desactivar solamente el ENRICHMENT FotMob.
 *
 * Ejemplo:
 *
 * FOTMOB_ENRICH_ENABLED=false
 *
 * En ese caso volvemos automáticamente a:
 *
 * baseFootballProvider
 *
 * y seguimos teniendo:
 *
 * - Flashscore
 * - API-Football
 * - 1xBet
 *
 * Esto nos da un interruptor de seguridad.
 * =========================================================
 */

export const footballProvider =
  process.env
    .FOTMOB_ENRICH_ENABLED ===
  "false"
    ? baseFootballProvider
    : enrichedFootballProvider;

/*
 * =========================================================
 * USE CASES
 * =========================================================
 */

/*
 * TODOS LOS PARTIDOS LIVE
 *
 * GET /api/v1/football/live
 *
 * Discovery:
 *
 * - API-Football
 * - Flashscore
 * - 1xBet
 *
 * Enrichment opcional:
 *
 * - FotMob
 */

export const getLiveMatches =
  new GetLiveMatches(
    footballProvider
  );

/*
 * =========================================================
 * MATCH STATISTICS
 * =========================================================
 *
 * Por ahora se mantiene EXACTAMENTE con Flashscore.
 *
 * NO lo pasamos todavía a FotMob.
 *
 * Primero comprobaremos que el enriquecimiento de partidos
 * funciona correctamente.
 * =========================================================
 */

export const getMatchStatistics =
  new GetMatchStatistics(
    flashscoreStatisticsProvider
  );

/*
 * =========================================================
 * HTTP
 * =========================================================
 */

const footballController =
  new FootballController(
    getLiveMatches,
    getMatchStatistics
  );

export const footballRouter =
  createFootballRouter(
    footballController
  );
