import os from "node:os";
import path from "node:path";

import {
  chromium,
  type BrowserContext,
  type Page,
} from "playwright";

export interface SofascoreApiTeam {
  id?: number;
  name?: string;
}

export interface SofascoreApiCategory {
  id?: number;
  name?: string;

  country?: {
    name?: string;
  };
}

export interface SofascoreEventResponse {
  event?:
    SofascoreApiLiveEvent;
}

export interface SofascorePregameTeam {
  position?:
    number;

  value?:
    string | number;

  form?:
    string[];
}

export interface SofascorePregameFormResponse {
  homeTeam?:
    SofascorePregameTeam;

  awayTeam?:
    SofascorePregameTeam;

  label?:
    string;
}

export interface SofascoreApiUniqueTournament {
  id?: number;
  name?: string;
}

export interface SofascoreApiTournament {
  id?: number;
  name?: string;

  category?:
    SofascoreApiCategory;

  uniqueTournament?:
    SofascoreApiUniqueTournament;
}

export interface SofascoreApiSeason {
  id?:
    number;

  name?:
    string;

  year?:
    string;
}

export interface SofascoreApiStandingRow {
  team?:
    SofascoreApiTeam;

  position?:
    number;

  matches?:
    number;

  wins?:
    number;

  draws?:
    number;

  losses?:
    number;

  scoresFor?:
    number;

  scoresAgainst?:
    number;

  points?:
    number;
}

export interface SofascoreApiStanding {
  rows?:
    SofascoreApiStandingRow[];
}

export interface SofascoreStandingsResponse {
  standings?:
    SofascoreApiStanding[];
}

export interface SofascoreApiStatus {
  /*
   * Verificado en live:
   *
   * 6  -> 1st half
   * 20 -> Started
   * 31 -> Halftime
   *
   * No dependemos todavía del código,
   * pero lo conservamos porque viene
   * directamente del payload.
   */
  code?: number;

  type?: string;

  description?: string;
}

export interface SofascoreApiScore {
  current?: number;
  display?: number;
  normaltime?: number;

  /*
   * Sofascore también expone los
   * parciales cuando están disponibles.
   */
  period1?: number;
  period2?: number;
}

export interface SofascoreApiTime {
  /*
   * Duración normal de un período.
   *
   * En fútbol observado:
   *
   * 2700 segundos = 45 minutos.
   */
  periodLength?: number;

  /*
   * Duración de período de prórroga.
   *
   * Observado:
   *
   * 900 segundos = 15 minutos.
   */
  overtimeLength?: number;

  totalPeriodCount?: number;

  /*
   * Timestamp UNIX del inicio del
   * período actualmente activo.
   */
  currentPeriodStartTimestamp?:
    number;

  /*
   * Timestamp UNIX del final del
   * período anterior.
   *
   * Muy útil cuando el partido está
   * en Halftime.
   */
  lastPeriodEndTimestamp?:
    number;

  /*
   * Segundos iniciales del reloj
   * del período actual.
   */
  initial?: number;

  /*
   * Máximo normal del período.
   *
   * Ejemplo observado:
   *
   * 2700 = 45:00.
   */
  max?: number;

  /*
   * Máximo adicional permitido.
   *
   * Ejemplo observado:
   *
   * 540 = 9 minutos de añadido.
   */
  extra?: number;
}

export interface SofascoreApiStatusTime {
  prefix?: string;

  /*
   * Segundos desde los que parte
   * el reloj actual.
   */
  initial?: number;

  /*
   * Duración máxima normal del
   * período actual.
   */
  max?: number;

  /*
   * Timestamp UNIX exacto usado
   * por SofaScore para avanzar
   * el reloj en vivo.
   */
  timestamp?: number;

  /*
   * Tiempo extra máximo que puede
   * mostrar el período.
   */
  extra?: number;
}

export interface SofascoreApiLiveEvent {
  id?:
    number;

  customId?:
    string;

  startTimestamp?:
    number;

  tournament?:
    SofascoreApiTournament;

  season?:
    SofascoreApiSeason;

  homeTeam?:
    SofascoreApiTeam;

  awayTeam?:
    SofascoreApiTeam;

  homeScore?:
    SofascoreApiScore;

  awayScore?:
    SofascoreApiScore;

  status?:
    SofascoreApiStatus;

  time?:
    SofascoreApiTime;

  statusTime?:
    SofascoreApiStatusTime;

  lastPeriod?:
    string;

  homeRedCards?:
    number | null;

  awayRedCards?:
    number | null;
}

export interface SofascoreLiveResponse {
  events?:
    SofascoreApiLiveEvent[];
}

export interface SofascoreTeamEventsResponse {
  events?:
    SofascoreApiLiveEvent[];

  hasNextPage?:
    boolean;
}

export interface SofascoreIncident {
  id?: number;

  incidentType?: string;

  incidentClass?: string;

  time?: number;

  addedTime?: number;

  /*
   * También verificamos que los
   * incidents pueden exponer segundos
   * más precisos.
   *
   * Los dejamos opcionales para no
   * alterar nada del scanner actual.
   */
  timeSeconds?: number;

  periodTimeSeconds?: number;

  reversedPeriodTime?: number;

  reversedPeriodTimeSeconds?:
    number;

  period?: string;

  isLive?: boolean;

  isHome?: boolean;

  player?: {
    id?: number;
    name?: string;
  };
}

export interface SofascoreIncidentResponse {
  incidents?:
    SofascoreIncident[];
}

interface BrowserFetchResult {
  status: number;
  body: string;
}

export class SofascoreSessionClient {
  private context:
    BrowserContext | null =
    null;

  private page:
    Page | null =
    null;

  private startPromise:
    Promise<void> | null =
    null;

  private readonly profileDir:
    string;

  /*
   * ========================================
   * CACHE GLOBAL DE RESPUESTAS
   * ========================================
   *
   * Una única instancia de este cliente es
   * compartida por todo el backend.
   *
   * Por tanto:
   *
   * - Mario
   * - hermano 1
   * - hermano 2
   *
   * reutilizan el mismo cache.
   */
  private readonly responseCache =
    new Map<
      string,
      {
        value:
          unknown;

        expiresAt:
          number;

        staleUntil:
          number;
      }
    >();

  /*
   * ========================================
   * EVENTOS LIVE
   * ========================================
   *
   * Cuando /events/live trae 500 partidos,
   * guardamos también cada evento por ID.
   *
   * Así getEvent(id) normalmente cuesta
   * CERO peticiones adicionales.
   */
  private readonly liveEventCache =
    new Map<
      number,
      {
        value:
          SofascoreApiLiveEvent;

        expiresAt:
          number;
      }
    >();

  /*
   * ========================================
   * REQUESTS EN CURSO
   * ========================================
   *
   * Si tres consumidores piden:
   *
   * /team/123/events/last/0
   *
   * al mismo tiempo, hacemos una sola
   * petición externa.
   */
  private readonly inflight =
    new Map<
      string,
      Promise<unknown>
    >();

  /*
   * ========================================
   * COLA SOFASCORE
   * ========================================
   *
   * Nunca enviamos decenas de requests
   * simultáneos.
   */
  private networkQueue:
    Promise<void> =
    Promise.resolve();

  private lastNetworkRequestAt =
    0;

  /*
   * No afirmamos que este sea un límite
   * oficial de SofaScore.
   *
   * Es simplemente una política propia
   * conservadora.
   */
  private readonly minRequestGapMs =
    900;

  /*
   * ========================================
   * CIRCUIT BREAKER
   * ========================================
   *
   * Ante 403 o 429:
   *
   * dejamos inmediatamente de consultar
   * SofaScore durante un tiempo.
   */
  private circuitOpenUntil =
    0;

  private readonly circuitCooldownMs =
    15 *
    60 *
    1000;

  constructor(
    profileDir =
      path.join(
        os.homedir(),
        ".cache",
        "football-radar",
        "sofascore-profile"
      )
  ) {
    this.profileDir =
      profileDir;
  }

  /*
   * ========================================
   * LIVE
   * ========================================
   */
  public async getLiveEvents():
    Promise<
      SofascoreApiLiveEvent[]
    > {

const payload =
  await this.fetchJson<
    SofascoreLiveResponse
  >(
    "/api/v1/sport/football/events/live",

    15_000,

    2 *
    60 *
    1000,

    "live"
  );

    const events =
      Array.isArray(
        payload.events
      )
        ? payload.events
        : [];

    const expiresAt =
      Date.now() +
      30_000;

    /*
     * Un solo /events/live puede alimentar
     * posteriormente cientos de getEvent().
     */
    for (
      const event
      of events
    ) {

      if (
        typeof event.id !==
        "number"
      ) {
        continue;
      }

      this.liveEventCache.set(
        event.id,
        {
          value:
            event,

          expiresAt,
        }
      );
    }

    return events;
  }

  /*
   * ========================================
   * EVENTO
   * ========================================
   */
  public async getEvent(
    eventId:
      number
  ): Promise<
    SofascoreApiLiveEvent
  > {

    /*
     * Primero buscamos dentro del snapshot
     * obtenido por /events/live.
     */
    const liveCached =
      this.liveEventCache.get(
        eventId
      );

    if (
      liveCached &&
      liveCached.expiresAt >
        Date.now()
    ) {
      return liveCached.value;
    }

    const payload =
      await this.fetchJson<
        SofascoreEventResponse
      >(
        `/api/v1/event/${eventId}`,

        60_000,

        10 *
        60 *
        1000
      );

    if (
      !payload.event
    ) {
      throw new Error(
        `Sofascore event ${eventId} not found`
      );
    }

    this.liveEventCache.set(
      eventId,
      {
        value:
          payload.event,

        expiresAt:
          Date.now() +
          60_000,
      }
    );

    return payload.event;
  }

  /*
   * ========================================
   * PREGAME FORM
   * ========================================
   *
   * No cambia cada 30 segundos.
   */
  public async getPregameForm(
    eventId:
      number
  ): Promise<
    SofascorePregameFormResponse
  > {

    return this.fetchJson<
      SofascorePregameFormResponse
    >(
      `/api/v1/event/${eventId}/pregame-form`,

      /*
       * Cache normal:
       * 30 minutos.
       */
      30 *
      60 *
      1000,

      /*
       * Stale:
       * otras 2 horas.
       */
      2 *
      60 *
      60 *
      1000
    );
  }

  /*
   * ========================================
   * ÚLTIMOS PARTIDOS DEL EQUIPO
   * ========================================
   *
   * Cache compartida por TEAM ID.
   */
  public async getTeamLastEvents(
    teamId:
      number,

    page =
      0
  ): Promise<
    SofascoreApiLiveEvent[]
  > {

    const payload =
      await this.fetchJson<
        SofascoreTeamEventsResponse
      >(
        `/api/v1/team/${teamId}/events/last/${page}`,

        /*
         * Últimos partidos cambian muy
         * poco durante un partido live.
         */
        15 *
        60 *
        1000,

        2 *
        60 *
        60 *
        1000
      );

    return Array.isArray(
      payload.events
    )
      ? payload.events
      : [];
  }

  /*
   * ========================================
   * STANDINGS
   * ========================================
   *
   * ESTE MÉTODO NO DEBE DESAPARECER.
   *
   * SofascorePregameFormContextProvider
   * lo utiliza actualmente.
   *
   * Además una misma tabla puede servir
   * para muchos partidos:
   *
   * Premier League
   *   partido 1 ─┐
   *   partido 2 ─┼── una sola tabla
   *   partido 3 ─┘
   */
  public async getStandings(
    tournamentId:
      number,

    seasonId:
      number
  ): Promise<
    SofascoreApiStandingRow[]
  > {

    const payload =
      await this.fetchJson<
        SofascoreStandingsResponse
      >(
        `/api/v1/tournament/${tournamentId}/season/${seasonId}/standings/total`,

        /*
         * Una tabla no necesita refrescarse
         * cada 30 segundos.
         */
        10 *
        60 *
        1000,

        /*
         * Podemos conservarla bastante
         * tiempo si SofaScore falla.
         */
        2 *
        60 *
        60 *
        1000
      );

    return (
      payload.standings ??
      []
    )
      .flatMap(
        standing =>
          Array.isArray(
            standing.rows
          )
            ? standing.rows
            : []
      );
  }

  /*
   * ========================================
   * INCIDENTES
   * ========================================
   *
   * Estos sí cambian rápidamente.
   */
  public async getIncidents(
    eventId:
      number
  ): Promise<
    SofascoreIncident[]
  > {

    const payload =
      await this.fetchJson<
        SofascoreIncidentResponse
      >(
        `/api/v1/event/${eventId}/incidents`,

        /*
         * Cache corto.
         */
        10_000,

        /*
         * Si falla momentáneamente,
         * conservamos 30 segundos.
         */
        30_000
      );

    return Array.isArray(
      payload.incidents
    )
      ? payload.incidents
      : [];
  }

  public async stop():
    Promise<void> {

    await this.context
      ?.close()
      .catch(
        () => undefined
      );

    this.page =
      null;

    this.context =
      null;

    this.startPromise =
      null;
  }

  /*
   * ========================================
   * FETCH CENTRAL
   * ========================================
   */
private async fetchJson<T>(
  apiPath:
    string,

  ttlMs:
    number,

  staleIfErrorMs:
    number,

  priority:
    "live" |
    "enrichment" =
      "enrichment"
): Promise<T> {

    const now =
      Date.now();

    const cached =
      this.responseCache.get(
        apiPath
      );

    /*
     * ========================================
     * CACHE HIT
     * ========================================
     */
    if (
      cached &&
      cached.expiresAt >
        now
    ) {
      return cached.value as T;
    }

    /*
     * ========================================
     * CIRCUIT BREAKER
     * ========================================
     */
    if (
      this.circuitOpenUntil >
      now
    ) {

      /*
       * Si tenemos datos anteriores,
       * los preferimos antes que volver
       * a atacar el proveedor.
       */
      if (
        cached &&
        cached.staleUntil >
          now
      ) {
        console.warn(
          "[Sofascore STALE]",
          apiPath
        );

        return cached.value as T;
      }

      const seconds =
        Math.ceil(
          (
            this.circuitOpenUntil -
            now
          ) /
          1000
        );

      throw new Error(
        `Sofascore circuit open (${seconds}s remaining)`
      );
    }

    /*
     * ========================================
     * INFLIGHT DEDUPE
     * ========================================
     */
    const existing =
      this.inflight.get(
        apiPath
      );

    if (
      existing
    ) {
      return existing as
        Promise<T>;
    }

    const promise =
      (
        async (): Promise<T> => {

          try {

            /*
             * Todas las peticiones reales
             * pasan por UNA cola.
             */
const performRequest =
  async (): Promise<
    BrowserFetchResult
  > => {

    if (
      this.circuitOpenUntil >
      Date.now()
    ) {
      throw new Error(
        "Sofascore circuit opened before request"
      );
    }

    const page =
      await this.getPage();

    console.log(
      priority ===
        "live"
        ? "[Sofascore LIVE NET]"
        : "[Sofascore NET]",

      apiPath
    );

    return page.evaluate(
      async (
        path
      ): Promise<
        BrowserFetchResult
      > => {

        const response =
          await fetch(
            path,
            {
              credentials:
                "include",

              headers: {
                accept:
                  "application/json",
              },
            }
          );

        return {
          status:
            response.status,

          body:
            await response.text(),
        };
      },

      apiPath
    );
  };

const result =
  priority ===
    "live"
    ? await performRequest()
    : await this
        .enqueueNetworkRequest(
          performRequest
        );

            /*
             * ========================================
             * PROTECCIÓN
             * ========================================
             */
            if (
              result.status ===
                403 ||
              result.status ===
                429
            ) {

              this.openCircuit(
                result.status,
                apiPath
              );

              throw new Error(
                `Sofascore HTTP ${result.status}: ${apiPath}`
              );
            }

            if (
              result.status <
                200 ||
              result.status >=
                300
            ) {
              throw new Error(
                `Sofascore HTTP ${result.status}: ${apiPath}`
              );
            }

            const value =
              JSON.parse(
                result.body
              ) as T;

            const storedAt =
              Date.now();

            /*
             * ========================================
             * CACHE GLOBAL
             * ========================================
             */
            this.responseCache.set(
              apiPath,
              {
                value,

                expiresAt:
                  storedAt +
                  ttlMs,

                staleUntil:
                  storedAt +
                  ttlMs +
                  staleIfErrorMs,
              }
            );

            return value;
          } catch (
            error
          ) {

            /*
             * Si la petición falló pero todavía
             * tenemos información reciente,
             * usamos stale.
             */
            const fallback =
              this.responseCache.get(
                apiPath
              );

            if (
              fallback &&
              fallback.staleUntil >
                Date.now()
            ) {
              console.warn(
                "[Sofascore STALE]",
                apiPath
              );

              return fallback.value as T;
            }

            throw error;
          } finally {

            this.inflight.delete(
              apiPath
            );
          }
        }
      )();

    this.inflight.set(
      apiPath,
      promise
    );

    return promise;
  }

  /*
   * ========================================
   * COLA GLOBAL SOFASCORE
   * ========================================
   */
  private enqueueNetworkRequest<T>(
    factory:
      () => Promise<T>
  ): Promise<T> {

    const run =
      this.networkQueue
        .then(
          async () => {

            const elapsed =
              Date.now() -
              this.lastNetworkRequestAt;

            const waitMs =
              Math.max(
                0,

                this.minRequestGapMs -
                elapsed
              );

            if (
              waitMs >
              0
            ) {
              await new Promise<
                void
              >(
                resolve => {
                  setTimeout(
                    resolve,
                    waitMs
                  );
                }
              );
            }

            this.lastNetworkRequestAt =
              Date.now();

            return factory();
          }
        );

    /*
     * Una petición fallida no rompe
     * permanentemente la cola.
     */
    this.networkQueue =
      run.then(
        () => undefined,
        () => undefined
      );

    return run;
  }

  /*
   * ========================================
   * CIRCUIT BREAKER
   * ========================================
   */
  private openCircuit(
    status:
      number,

    apiPath:
      string
  ): void {

    const until =
      Date.now() +
      this.circuitCooldownMs;

    this.circuitOpenUntil =
      Math.max(
        this.circuitOpenUntil,
        until
      );

    console.error(
      "[Sofascore CIRCUIT OPEN]",
      `HTTP ${status}`,
      apiPath,
      `cooldown=${Math.round(
        this.circuitCooldownMs /
        60_000
      )}min`
    );
  }

  private async getPage():
    Promise<Page> {

    await this.start();

    if (
      !this.page
    ) {
      throw new Error(
        "Sofascore session page unavailable"
      );
    }

    return this.page;
  }

  private async start():
    Promise<void> {

    if (
      this.context &&
      this.page
    ) {
      return;
    }

    if (
      this.startPromise
    ) {
      return this.startPromise;
    }

    this.startPromise =
      this.startInternal();

    try {
      await this.startPromise;
    } finally {
      this.startPromise =
        null;
    }
  }

  private async startInternal():
    Promise<void> {

    const headless =
      process.env
        .SOFASCORE_HEADLESS ===
      "true";

    this.context =
      await chromium
        .launchPersistentContext(
          this.profileDir,
          {
            headless,

            locale:
              "es-ES",

            timezoneId:
              "America/La_Paz",

            viewport: {
              width:
                1365,

              height:
                900,
            },
          }
        );

    this.page =
      this.context.pages()[0] ??
      await this.context
        .newPage();

    const response =
      await this.page.goto(
        "https://www.sofascore.com/es/",
        {
          waitUntil:
            "domcontentloaded",

          timeout:
            30_000,
        }
      );

    /*
     * Si incluso la portada devuelve
     * prohibición, tampoco continuamos.
     */
    if (
      response?.status() ===
        403 ||
      response?.status() ===
        429
    ) {

      this.openCircuit(
        response.status(),
        "homepage"
      );

      throw new Error(
        `Sofascore homepage HTTP ${response.status()}`
      );
    }

    await this.page.waitForTimeout(
      1000
    );

    if (
      this.page.url()
        .includes(
          "/captcha"
        )
    ) {

      this.openCircuit(
        403,
        "captcha"
      );

      throw new Error(
        "Sofascore persistent session is blocked by CAPTCHA"
      );
    }

    console.log(
      "[SofascoreSessionClient] ready"
    );
  }
}
