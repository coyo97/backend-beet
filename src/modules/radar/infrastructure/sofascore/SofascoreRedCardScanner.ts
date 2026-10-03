import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import {
  SofascoreSessionClient,
  type SofascoreIncident,
} from "../../../football/infrastructure/providers/sofascore-browser/SofascoreSessionClient";

export type SofascoreRedCardType =
  | "red"
  | "second-yellow-red"
  | "unknown-red";

export interface SofascoreRedCardEvent {
  eventId:
    string | null;

  side:
    "home"
    | "away"
    | null;

  minute:
    number | null;

  addedTime:
    number | null;

  playerId:
    string | null;

  playerName:
    string | null;

  type:
    SofascoreRedCardType;
}

export interface SofascoreScannedRedCardMatch {
  match:
    LiveMatch;

  sofascoreExternalId:
    string;

  homeRedCards:
    number;

  awayRedCards:
    number;

  events:
    SofascoreRedCardEvent[];
}

interface CacheEntry {
  value:
    SofascoreScannedRedCardMatch | null;

  expiresAt:
    number;
}

export class SofascoreRedCardScanner {
  private readonly cache =
    new Map<
      string,
      CacheEntry
    >();

  constructor(
    private readonly client:
      SofascoreSessionClient,

    private readonly cacheMs =
      10_000,

    private readonly concurrency =
      4
  ) {}

  public async scan(
    matches:
      LiveMatch[]
  ): Promise<
    SofascoreScannedRedCardMatch[]
  > {

    const candidates =
      this.getCandidates(
        matches
      );

    if (
      candidates.length ===
      0
    ) {
      return [];
    }

    const results:
      SofascoreScannedRedCardMatch[] =
        [];

    let cursor =
      0;

    const worker =
      async () => {

        while (
          cursor <
          candidates.length
        ) {

          const index =
            cursor++;

          const candidate =
            candidates[
              index
            ];

          try {
            const detection =
              await this.scanOne(
                candidate.match,
                candidate.externalId
              );

            if (!detection) {
              continue;
            }

            results.push(
              detection
            );
          } catch (
            error
          ) {
            /*
             * Fail-soft:
             *
             * SofaScore nunca debe romper
             * el Radar completo.
             */
            console.warn(
              "[SofascoreRedCardScanner] failed",
              candidate.externalId,
              error instanceof Error
                ? error.message
                : error
            );
          }
        }
      };

    const workerCount =
      Math.min(
        this.concurrency,
        candidates.length
      );

    await Promise.all(
      Array.from(
        {
          length:
            workerCount,
        },

        () =>
          worker()
      )
    );

    return results;
  }

  private getCandidates(
    matches:
      LiveMatch[]
  ): Array<{
    match:
      LiveMatch;

    externalId:
      string;
  }> {

    const seen =
      new Set<
        string
      >();

    const result:
      Array<{
        match:
          LiveMatch;

        externalId:
          string;
      }> =
        [];

    for (
      const match
      of matches
    ) {

      const source =
        match.sources.find(
          item =>
            item.provider ===
            "sofascore"
        );

      if (!source) {
        continue;
      }

      if (
        seen.has(
          source.externalId
        )
      ) {
        continue;
      }

      seen.add(
        source.externalId
      );

      result.push({
        match,

        externalId:
          source.externalId,
      });
    }

    return result;
  }

  private async scanOne(
    match:
      LiveMatch,

    externalId:
      string
  ): Promise<
    SofascoreScannedRedCardMatch | null
  > {

    const cached =
      this.cache.get(
        externalId
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return cached.value;
    }

    const numericId =
      Number(
        externalId
      );

    if (
      !Number.isFinite(
        numericId
      )
    ) {
      return null;
    }

    const incidents =
      await this.client
        .getIncidents(
          numericId
        );

    const redEvents =
      incidents
        .map(
          incident =>
            this.mapRedCard(
              incident
            )
        )
        .filter(
          (
            event
          ): event is
            SofascoreRedCardEvent =>
              event !==
              null
        );

    if (
      redEvents.length ===
      0
    ) {

      this.cache.set(
        externalId,
        {
          value:
            null,

          expiresAt:
            Date.now() +
            this.cacheMs,
        }
      );

      return null;
    }

    const homeRedCards =
      redEvents.filter(
        event =>
          event.side ===
          "home"
      ).length;

    const awayRedCards =
      redEvents.filter(
        event =>
          event.side ===
          "away"
      ).length;

    const result:
      SofascoreScannedRedCardMatch =
        {
          match,

          sofascoreExternalId:
            externalId,

          homeRedCards,

          awayRedCards,

          events:
            redEvents,
        };

    this.cache.set(
      externalId,
      {
        value:
          result,

        expiresAt:
          Date.now() +
          this.cacheMs,
      }
    );

    return result;
  }

  private mapRedCard(
    incident:
      SofascoreIncident
  ): SofascoreRedCardEvent | null {

    if (
      incident.incidentType !==
      "card"
    ) {
      return null;
    }

    const cardClass =
      String(
        incident.incidentClass ??
        ""
      )
        .toLowerCase()
        .replace(
          /[^a-z]/g,
          ""
        );

    /*
     * Ejemplos que queremos soportar:
     *
     * red
     * redCard
     * yellowRed
     * yellowRedCard
     */
    if (
      !cardClass.includes(
        "red"
      )
    ) {
      return null;
    }

    let type:
      SofascoreRedCardType =
        "unknown-red";

    if (
      cardClass.includes(
        "yellow"
      )
    ) {
      type =
        "second-yellow-red";
    } else if (
      cardClass.includes(
        "red"
      )
    ) {
      type =
        "red";
    }

    return {
      eventId:
        typeof incident.id ===
          "number"
          ? String(
              incident.id
            )
          : null,

      side:
        incident.isHome ===
        true
          ? "home"
          : incident.isHome ===
            false
          ? "away"
          : null,

      minute:
        typeof incident.time ===
          "number"
          ? incident.time
          : null,

      addedTime:
        typeof incident.addedTime ===
          "number"
          ? incident.addedTime
          : null,

      playerId:
        typeof incident.player
          ?.id ===
          "number"
          ? String(
              incident.player.id
            )
          : null,

      playerName:
        incident.player
          ?.name ??
        null,

      type,
    };
  }
}
