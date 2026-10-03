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
  id?: number;

  customId?: string;

  startTimestamp?: number;

  tournament?:
    SofascoreApiTournament;

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

  /*
   * =====================================================
   * LIVE CLOCK
   * =====================================================
   *
   * Estos campos fueron verificados directamente
   * en /api/v1/sport/football/events/live.
   *
   * Ejemplo:
   *
   * time: {
   *   periodLength: 2700,
   *   overtimeLength: 900,
   *   totalPeriodCount: 2,
   *   currentPeriodStartTimestamp: ...,
   *   initial: 0,
   *   max: 2700,
   *   extra: 540
   * }
   */
  time?:
    SofascoreApiTime;

  /*
   * En algunos partidos live SofaScore
   * proporciona además:
   *
   * statusTime: {
   *   prefix: "",
   *   initial: 0,
   *   max: 2700,
   *   timestamp: ...,
   *   extra: 540
   * }
   *
   * Esta es nuestra fuente preferida
   * para calcular el minuto.
   */
  statusTime?:
    SofascoreApiStatusTime;

  /*
   * Ejemplo observado:
   *
   * "period1"
   */
  lastPeriod?: string;

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

  public async getLiveEvents():
    Promise<
      SofascoreApiLiveEvent[]
    > {

    const payload =
      await this.fetchJson<
        SofascoreLiveResponse
      >(
        "/api/v1/sport/football/events/live"
      );

    return Array.isArray(
      payload.events
    )
      ? payload.events
      : [];
  }
  public async getEvent(
  eventId:
    number
): Promise<
  SofascoreApiLiveEvent
> {

  const payload =
    await this.fetchJson<
      SofascoreEventResponse
    >(
      `/api/v1/event/${eventId}`
    );

  if (!payload.event) {
    throw new Error(
      `Sofascore event ${eventId} not found`
    );
  }

  return payload.event;
}

public async getPregameForm(
  eventId:
    number
): Promise<
  SofascorePregameFormResponse
> {

  return this.fetchJson<
    SofascorePregameFormResponse
  >(
    `/api/v1/event/${eventId}/pregame-form`
  );
}
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
      `/api/v1/team/${teamId}/events/last/${page}`
    );

  return Array.isArray(
    payload.events
  )
    ? payload.events
    : [];
}

  public async getIncidents(
    eventId: number
  ): Promise<
    SofascoreIncident[]
  > {

    const payload =
      await this.fetchJson<
        SofascoreIncidentResponse
      >(
        `/api/v1/event/${eventId}/incidents`
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

  private async fetchJson<T>(
    apiPath: string
  ): Promise<T> {

    const page =
      await this.getPage();

    const result =
      await page.evaluate(
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

    return JSON.parse(
      result.body
    ) as T;
  }

  private async getPage():
    Promise<Page> {

    await this.start();

    if (!this.page) {
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
      return this
        .startPromise;
    }

    this.startPromise =
      this.startInternal();

    try {
      await this
        .startPromise;
    } finally {
      this.startPromise =
        null;
    }
  }

  private async startInternal():
    Promise<void> {

    /*
     * IMPORTANTE:
     *
     * Nuestras pruebas demostraron que
     * el contexto limpio recibe challenge,
     * mientras que el perfil persistente
     * permite los fetch internos.
     *
     * Por ahora dejamos headless=false
     * por defecto porque es el modo que
     * verificamos experimentalmente.
     */
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

    await this.page.goto(
      "https://www.sofascore.com/es/",
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          30_000,
      }
    );

    await this.page.waitForTimeout(
      1000
    );

    if (
      this.page.url()
        .includes(
          "/captcha"
        )
    ) {
      throw new Error(
        "Sofascore persistent session is blocked by CAPTCHA"
      );
    }

    console.log(
      "[SofascoreSessionClient] ready"
    );
  }
}
