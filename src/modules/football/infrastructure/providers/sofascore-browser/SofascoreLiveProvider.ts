import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import type {
  FootballProvider,
} from "../../../domain/providers/FootballProvider";

import {
  SofascoreSessionClient,
  type SofascoreApiLiveEvent,
} from "./SofascoreSessionClient";

export class SofascoreLiveProvider
  implements FootballProvider
{
  constructor(
    private readonly client:
      SofascoreSessionClient
  ) {}

  public async getLiveMatches():
    Promise<LiveMatch[]> {

    const events =
      await this.client
        .getLiveEvents();

    const matches =
      events
        .map(
          event =>
            this.mapEvent(
              event
            )
        )
        .filter(
          (
            match
          ): match is
            LiveMatch =>
              match !==
              null
        );

    console.log(
      `[SofascoreLiveProvider] live=${matches.length}`
    );

    return matches;
  }

  private mapEvent(
    event:
      SofascoreApiLiveEvent
  ): LiveMatch | null {

    if (
      typeof event.id !==
        "number" ||
      !event.homeTeam
        ?.name ||
      !event.awayTeam
        ?.name
    ) {
      return null;
    }

    const tournament =
      event.tournament;

    const uniqueTournament =
      tournament
        ?.uniqueTournament;

    const homeGoals =
      this.numberOrNull(
        event.homeScore
          ?.current
      );

    const awayGoals =
      this.numberOrNull(
        event.awayScore
          ?.current
      );

    const kickoffAt =
      typeof event
        .startTimestamp ===
        "number"
        ? new Date(
            event.startTimestamp *
            1000
          ).toISOString()
        : new Date()
            .toISOString();

    const country =
      tournament
        ?.category
        ?.country
        ?.name ??
      tournament
        ?.category
        ?.name ??
      "";

    const competitionId =
      uniqueTournament
        ?.id ??
      tournament
        ?.id ??
      null;

    return {
      sources: [
        {
          provider:
            "sofascore",

          externalId:
            String(
              event.id
            ),
        },
      ],

      kickoffAt,

      status: {
        long:
          event.status
            ?.description ??
          event.status
            ?.type ??
          "Live",

        short:
          event.status
            ?.type ??
          "inprogress",

        /*
         * Minuto live calculado únicamente
         * con el reloj real que entrega
         * SofaScore.
         *
         * Si SofaScore no proporciona
         * suficiente información temporal,
         * devolvemos null en vez de inventar.
         */
        minute:
          this.resolveMinute(
            event
          ),
      },

      competition: {
        id:
          competitionId ===
          null
            ? null
            : String(
                competitionId
              ),

        name:
          tournament
            ?.name ??
          uniqueTournament
            ?.name ??
          "",

        country,

        logo:
          null,

        flag:
          null,

        season:
          null,

        round:
          null,
      },

      home: {
        id:
          typeof event
            .homeTeam
            ?.id ===
          "number"
            ? String(
                event
                  .homeTeam
                  .id
              )
            : null,

        name:
          event.homeTeam
            .name,

        logo:
          null,

        goals:
          homeGoals,

        winner:
          null,
      },

      away: {
        id:
          typeof event
            .awayTeam
            ?.id ===
          "number"
            ? String(
                event
                  .awayTeam
                  .id
              )
            : null,

        name:
          event.awayTeam
            .name,

        logo:
          null,

        goals:
          awayGoals,

        winner:
          null,
      },

      dataAvailability: {
        score:
          homeGoals !==
            null &&
          awayGoals !==
            null,

        /*
         * Ya comprobamos /incidents.
         */
        events:
          true,

        /*
         * El Radar maneja las rojas
         * mediante SofascoreRedCardScanner.
         *
         * Mantenemos false aquí para no
         * cambiar la semántica existente
         * del LiveMatch básico.
         */
        redCards:
          false,

        statistics:
          false,

        possession:
          false,

        shots:
          false,

        corners:
          false,

        lineups:
          false,

        odds:
          false,
      },
    };
  }

  /*
   * =====================================================
   * SOFASCORE LIVE CLOCK
   * =====================================================
   *
   * Datos verificados experimentalmente:
   *
   * 1st half:
   *
   * statusTime: {
   *   initial: 0,
   *   max: 2700,
   *   timestamp: ...,
   *   extra: 540
   * }
   *
   * Halftime:
   *
   * time: {
   *   periodLength: 2700,
   *   currentPeriodStartTimestamp: ...,
   *   lastPeriodEndTimestamp: ...
   * }
   *
   * Algunos partidos solamente tienen:
   *
   * time: {}
   *
   * En esos casos NO calculamos un
   * minuto artificial.
   */
  private resolveMinute(
    event:
      SofascoreApiLiveEvent
  ): number | null {

    if (
      event.status?.type !==
      "inprogress"
    ) {
      return null;
    }

    const description =
      (
        event.status
          ?.description ??
        ""
      )
        .trim()
        .toLowerCase();

    /*
     * ==========================================
     * DESCANSO
     * ==========================================
     *
     * En Halftime el reloj ya no debe
     * continuar avanzando.
     */
    if (
      event.status
        ?.code ===
        31 ||
      description ===
        "halftime" ||
      description ===
        "half time"
    ) {

      const periodLength =
        this.numberOrNull(
          event.time
            ?.periodLength
        );

      if (
        periodLength !==
          null &&
        periodLength >
          0
      ) {
        return Math.round(
          periodLength /
            60
        );
      }

      /*
       * En fútbol convencional el
       * descanso ocurre en el 45.
       *
       * Solo usamos este fallback cuando
       * SofaScore dice explícitamente
       * Halftime pero omite periodLength.
       */
      return 45;
    }

    /*
     * ==========================================
     * PARTIDO EN CURSO
     * ==========================================
     *
     * statusTime es nuestra primera opción
     * porque SofaScore lo utiliza como reloj
     * dinámico del estado live.
     */
    const timestamp =
      this.firstNumber(
        event.statusTime
          ?.timestamp,

        event.time
          ?.currentPeriodStartTimestamp
      );

    /*
     * initial indica desde qué segundo
     * absoluto del partido comienza
     * este período.
     *
     * Ejemplo esperado para 2.º tiempo:
     *
     * initial = 2700
     *
     * De esta forma:
     *
     * 2700 + segundos transcurridos
     *
     * produce 46', 47', 48', etc.
     */
    const initial =
      this.firstNumber(
        event.statusTime
          ?.initial,

        event.time
          ?.initial
      );

    if (
      timestamp ===
        null ||
      initial ===
        null
    ) {
      /*
       * Casos reales observados:
       *
       * status = Started
       * time = {}
       *
       * También existen partidos donde
       * SofaScore indica 1st/2nd half
       * pero no publica un reloj usable.
       *
       * Preferimos null a un minuto falso.
       */
      return null;
    }

    const now =
      Math.floor(
        Date.now() /
          1000
      );

    /*
     * Por seguridad nunca permitimos
     * tiempo negativo si existe alguna
     * pequeña diferencia de reloj.
     */
    const elapsedSeconds =
      Math.max(
        0,
        now -
          timestamp
      );

    let totalSeconds =
      initial +
      elapsedSeconds;

    /*
     * max representa el final normal
     * del período.
     *
     * Ejemplos:
     *
     * primer tiempo:
     * max = 2700
     *
     * segundo tiempo:
     * normalmente max = 5400
     *
     * extra permite el añadido.
     */
    const max =
      this.firstNumber(
        event.statusTime
          ?.max,

        event.time
          ?.max
      );

    const extra =
      this.firstNumber(
        event.statusTime
          ?.extra,

        event.time
          ?.extra
      ) ??
      0;

    /*
     * Evitamos que un timestamp viejo
     * haga crecer el minuto indefinidamente
     * si SofaScore todavía no ha actualizado
     * el estado del período.
     */
    if (
      max !==
        null &&
      max >
        0
    ) {

      const upperLimit =
        max +
        Math.max(
          0,
          extra
        );

      totalSeconds =
        Math.min(
          totalSeconds,
          upperLimit
        );
    }

    if (
      !Number.isFinite(
        totalSeconds
      ) ||
      totalSeconds <
        0
    ) {
      return null;
    }

    /*
     * Convención visual:
     *
     * 00:01 -> 1'
     * 05:01 -> 6'
     * 44:59 -> 45'
     * 45:01 -> 46'
     *
     * Math.ceil coincide con la forma
     * habitual de mostrar el minuto
     * futbolístico transcurrido.
     */
    return Math.max(
      1,
      Math.ceil(
        totalSeconds /
          60
      )
    );
  }

  /*
   * Devuelve el primer número válido
   * entre varias alternativas.
   *
   * Nos permite preferir statusTime
   * y utilizar time como fallback.
   */
  private firstNumber(
    ...values:
      unknown[]
  ): number | null {

    for (
      const value
      of values
    ) {

      const number =
        this.numberOrNull(
          value
        );

      if (
        number !==
        null
      ) {
        return number;
      }
    }

    return null;
  }

  private numberOrNull(
    value:
      unknown
  ): number | null {

    return (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    )
      ? value
      : null;
  }
}
