import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  UpcomingMatchProvider,
} from "../../domain/providers/UpcomingMatchProvider";

/*
 * Partidos próximos al inicio.
 *
 * Este caso de uso:
 *
 * - No altera GetLiveMatches.
 * - No modifica el proveedor Live.
 * - No envía notificaciones.
 * - No realiza consultas adicionales
 *   fuera del proveedor inyectado.
 *
 * Reutiliza la caché propia del
 * proveedor Upcoming.
 */
export class GetStartingSoonMatches {

  /*
   * Mostrar partidos desde
   * 15 minutos antes del inicio.
   */
  private readonly beforeMs =
    15 * 60 * 1000;

  /*
   * Mantener partidos programados
   * durante 10 minutos después
   * de su hora de inicio.
   *
   * Esto NO confirma que el partido
   * ya comenzó.
   */
  private readonly graceMs =
    10 * 60 * 1000;

  constructor(
    private readonly provider:
      UpcomingMatchProvider
  ) {}

  public async execute(
    now: number = Date.now()
  ): Promise<LiveMatch[]> {

    const from =
      now - this.graceMs;

    const until =
      now + this.beforeMs;

    const matches =
      await this.provider
        .getUpcomingMatches();

    return matches
      .filter(match => {

        /*
         * Solamente encuentros
         * registrados como pendientes.
         *
         * Nunca crear artificialmente
         * un partido en vivo.
         */
        if (
          match.status.short !== "NS"
        ) {
          return false;
        }

        const kickoff =
          Date.parse(
            match.kickoffAt
          );

        if (
          !Number.isFinite(kickoff)
        ) {
          return false;
        }

        return (
          kickoff >= from &&
          kickoff <= until
        );
      })
      .sort(
        (a, b) =>
          Date.parse(a.kickoffAt) -
          Date.parse(b.kickoffAt)
      );
  }
}
