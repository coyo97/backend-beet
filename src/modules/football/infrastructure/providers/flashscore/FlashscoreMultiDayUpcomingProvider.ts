
import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import type {
  UpcomingMatchProvider,
} from "../../../domain/providers/UpcomingMatchProvider";

import {
  FlashscoreClient,
} from "./FlashscoreClient";

import {
  FlashscoreUpcomingMatchesProvider,
} from "./FlashscoreUpcomingMatchesProvider";

/*
 * Proveedor exclusivo para Radar Prematch.
 *
 * No reemplaza flashscoreUpcomingShared.
 * No modifica los schedulers.
 *
 * Consulta los días UTC que cubren
 * las próximas 168 horas.
 */
export class FlashscoreMultiDayUpcomingProvider
  implements UpcomingMatchProvider {

  private readonly client =
    new FlashscoreClient();

  private readonly byDate =
    new Map<
      string,
      FlashscoreUpcomingMatchesProvider
    >();

  private readonly failedUntil =
    new Map<string, number>();

  /*
   * Una hora de caché por fecha.
   * Starting Soon conserva sus 3 minutos.
   */
  private readonly ttlMs =
    60 * 60 * 1000;

  private readonly retryAfterMs =
    5 * 60 * 1000;

  public async getUpcomingMatches():
    Promise<LiveMatch[]> {

    /*
     * Ocho fechas UTC cubren la
     * ventana móvil de 168 horas:
     * hoy y los siete días siguientes.
     */
    const dates =
      this.getDates();

    /*
     * Limpiar fechas que ya salieron
     * de la ventana.
     */
    for (const date of this.byDate.keys()) {
      if (!dates.includes(date)) {
        this.byDate.delete(date);
        this.failedUntil.delete(date);
      }
    }

    const availableDates =
      dates.filter(date =>
        Date.now() >=
        (this.failedUntil.get(date) ?? 0)
      );

    const collected: LiveMatch[] = [];

    let successfulDates = 0;
    const failedDates: string[] = [];

    /*
     * Máximo dos solicitudes simultáneas.
     * Cada fecha dispone de su propia
     * caché y petición compartida.
     */
    for (
      let index = 0;
      index < availableDates.length;
      index += 2
    ) {
      const batch =
        availableDates.slice(
          index,
          index + 2
        );

      const responses =
        await Promise.allSettled(
          batch.map(date =>
            this.getDateProvider(date)
              .getUpcomingMatches()
          )
        );

      for (
        let i = 0;
        i < responses.length;
        i++
      ) {
        const date = batch[i];
        const response = responses[i];

        if (response.status === "fulfilled") {
          successfulDates++;

          this.failedUntil.delete(date);

          collected.push(
            ...response.value
          );

          continue;
        }

        failedDates.push(date);

        this.failedUntil.set(
          date,
          Date.now() + this.retryAfterMs
        );

        console.warn(
          `[FlashscoreWeek] Failed date=${date}`,
          response.reason
        );
      }
    }

    if (successfulDates === 0) {
      throw new Error(
        "[FlashscoreWeek] No dates available"
      );
    }

    /*
     * El mismo partido puede aparecer
     * en respuestas de varias fechas.
     * Deducimos por ID original.
     */
    const unique =
      new Map<string, LiveMatch>();

    for (const match of collected) {
      const externalId =
        match.sources.find(
          source =>
            source.provider === "flashscore"
        )?.externalId;

      const key =
        externalId ??
        [
          match.kickoffAt,
          match.home.name,
          match.away.name,
        ].join("|");

      if (!unique.has(key)) {
        unique.set(key, match);
      }
    }

    console.log(
      `[FlashscoreWeek] loadedDates=${successfulDates}/${dates.length}` +
      ` matches=${unique.size}` +
      ` failed=${failedDates.length}`
    );

    return [...unique.values()];
  }

  private getDateProvider(
    date: string
  ): FlashscoreUpcomingMatchesProvider {

    const existing =
      this.byDate.get(date);

    if (existing) {
      return existing;
    }

    const provider =
      new FlashscoreUpcomingMatchesProvider(
        this.client,
        this.ttlMs,
        date
      );

    this.byDate.set(
      date,
      provider
    );

    return provider;
  }

  private getDates(): string[] {
    const start = new Date();

    start.setUTCHours(0, 0, 0, 0);

    return Array.from(
      { length: 8 },
      (_, offset) => {
        const date = new Date(start);

        date.setUTCDate(
          date.getUTCDate() + offset
        );

        return date
          .toISOString()
          .slice(0, 10);
      }
    );
  }
}

