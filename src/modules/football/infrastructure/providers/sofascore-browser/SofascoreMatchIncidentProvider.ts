import type {
  MatchSource,
} from "../../../domain/entities/LiveMatch";

import type {
  MatchIncident,
} from "../../../domain/entities/MatchIncident";

import type {
  MatchIncidentProvider,
} from "../../../domain/providers/MatchIncidentProvider";

import {
  SofascoreSessionClient,
  type SofascoreIncident,
} from "./SofascoreSessionClient";

export class SofascoreMatchIncidentProvider
  implements MatchIncidentProvider
{
  constructor(
    private readonly client:
      SofascoreSessionClient
  ) {}

  public supports(
    source:
      MatchSource
  ): boolean {

    return (
      source.provider ===
      "sofascore"
    );
  }

  public async getIncidents(
    source:
      MatchSource
  ): Promise<
    MatchIncident[]
  > {

    if (
      !this.supports(
        source
      )
    ) {
      return [];
    }

    const eventId =
      Number(
        source.externalId
      );

    if (
      !Number.isFinite(
        eventId
      )
    ) {
      return [];
    }

    const incidents =
      await this.client
        .getIncidents(
          eventId
        );

    return incidents
      .map(
        incident =>
          this.mapIncident(
            incident
          )
      );
  }

  private mapIncident(
    incident:
      SofascoreIncident
  ): MatchIncident {

    const minuteNumber =
      typeof incident.time ===
        "number"
        ? incident.time
        : null;

    const addedTime =
      typeof incident.addedTime ===
        "number" &&
      incident.addedTime >
        0
        ? incident.addedTime
        : null;

    const minute =
      minuteNumber ===
      null
        ? null
        : addedTime
          ? `${minuteNumber}+${addedTime}`
          : String(
              minuteNumber
            );

    return {
      id:
        typeof incident.id ===
          "number"
          ? String(
              incident.id
            )
          : null,

      side:
        typeof incident.isHome ===
          "boolean"
          ? incident.isHome
            ? "home"
            : "away"
          : null,

      minute,

      /*
       * Usamos el minuto base que
       * expone SofaScore.
       *
       * Más adelante, para análisis
       * de tiempo añadido, podemos
       * conservar addedTime también
       * como campo canónico.
       */
      minuteNumber,

      type:
        incident.incidentType ??
        null,

      reason:
        incident.incidentClass ??
        null,

      description:
        this.buildDescription(
          incident
        ),

      player:
        incident.player
          ? {
              id:
                typeof incident
                  .player.id ===
                  "number"
                  ? String(
                      incident
                        .player.id
                    )
                  : null,

              name:
                incident
                  .player
                  .name ??
                null,
            }
          : null,

      /*
       * El payload de incidentes
       * SofaScore que tenemos
       * tipado actualmente no
       * expone marcador.
       *
       * No lo inventamos.
       */
      homeScore:
        null,

      awayScore:
        null,
    };
  }

  private buildDescription(
    incident:
      SofascoreIncident
  ): string |
    null {

    const parts =
      [
        incident.incidentType,
        incident.incidentClass,
      ]
        .filter(
          (
            value
          ): value is string =>
            Boolean(
              value
            )
        );

    if (
      parts.length ===
      0
    ) {
      return null;
    }

    return parts.join(
      " · "
    );
  }
}
