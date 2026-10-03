import type {
  FotMobMatchDetailsResponse,
} from "./FotMobTypes";

import type {
  FotMobRedCardEvent,
  FotMobRedCardSnapshot,
  FotMobRedCardType,
} from "./FotMobRedCardSnapshot";

type JsonObject =
  Record<
    string,
    any
  >;

export class FotMobRedCardExtractor {
  public extract(
    details:
      FotMobMatchDetailsResponse
  ): FotMobRedCardSnapshot {

    const header =
      this.asObject(
        details.header
      );

    const status =
      this.asObject(
        header.status
      );

    const headerHome =
      this.asNumber(
        status
          .numberOfHomeRedCards
      );

    const headerAway =
      this.asNumber(
        status
          .numberOfAwayRedCards
      );

    const events =
      this.extractEvents(
        details
      );

    const eventsHome =
      events.filter(
        (
          event
        ) =>
          event.side ===
          "home"
      ).length;

    const eventsAway =
      events.filter(
        (
          event
        ) =>
          event.side ===
          "away"
      ).length;

    /*
     * Header es nuestra fuente rápida.
     *
     * Los eventos nos sirven como
     * enriquecimiento y fallback.
     */
    const homeRedCards =
      headerHome !==
      null
        ? Math.max(
            headerHome,
            eventsHome
          )
        : eventsHome >
          0
          ? eventsHome
          : null;

    const awayRedCards =
      headerAway !==
      null
        ? Math.max(
            headerAway,
            eventsAway
          )
        : eventsAway >
          0
          ? eventsAway
          : null;

    const totalRedCards =
      (
        homeRedCards ??
        0
      ) +
      (
        awayRedCards ??
        0
      );

    let confidence:
      FotMobRedCardSnapshot[
        "confidence"
      ] =
        "unknown";

    if (
      headerHome !==
        null &&
      headerAway !==
        null
    ) {
      confidence =
        "high";
    } else if (
      events.length >
      0
    ) {
      confidence =
        "medium";
    }

    return {
      homeRedCards,

      awayRedCards,

      totalRedCards,

      hasRedCard:
        totalRedCards >
        0,

      events,

      confidence,

      fetchedAt:
        new Date()
          .toISOString(),
    };
  }

  private extractEvents(
    details:
      FotMobMatchDetailsResponse
  ): FotMobRedCardEvent[] {

    const content =
      this.asObject(
        details.content
      );

    const matchFacts =
      this.asObject(
        content.matchFacts
      );

    const eventsContainer =
      this.asObject(
        matchFacts.events
      );

    const rawEvents =
      Array.isArray(
        eventsContainer.events
      )
        ? eventsContainer.events
        : [];

    const results:
      FotMobRedCardEvent[] =
        [];

    for (
      const raw
      of rawEvents
    ) {

      const event =
        this.asObject(
          raw
        );

      const type =
        this.detectRedCardType(
          event
        );

      if (!type) {
        continue;
      }

      const player =
        this.asObject(
          event.player
        );

      results.push({
        eventId:
          this.asId(
            event.eventId ??
            event.id
          ),

        side:
          typeof event.isHome ===
          "boolean"
            ? (
                event.isHome
                  ? "home"
                  : "away"
              )
            : null,

        minute:
          this.firstNumber(
            event,
            [
              "time",
              "timeStr",
              "minute",
              "min",
            ]
          ),

        addedTime:
          this.firstNumber(
            event,
            [
              "addedTime",
              "timeAdded",
              "minAdded",
            ]
          ),

        playerId:
          this.asId(
            player.id ??
            event.playerId
          ),

        playerName:
          this.firstString(
            player,
            [
              "name",
              "fullName",
            ]
          ) ??
          this.firstString(
            event,
            [
              "nameStr",
              "playerName",
            ]
          ),

        type,
      });
    }

    return results;
  }

  private detectRedCardType(
    event:
      JsonObject
  ): FotMobRedCardType | null {

    const pieces = [
      event.type,
      event.eventType,
      event.card,
      event.cardType,
      event.cardDescription,
      event.description,
      event.name,
      event.nameStr,
    ]
      .filter(
        (
          value
        ) =>
          typeof value ===
          "string"
      )
      .map(
        (
          value
        ) =>
          String(
            value
          ).toLowerCase()
      );

    const value =
      pieces.join(
        " "
      );

    /*
     * Segunda amarilla que produce roja.
     */
    if (
      value.includes(
        "second yellow"
      ) ||
      value.includes(
        "second-yellow"
      ) ||
      value.includes(
        "yellow red"
      ) ||
      value.includes(
        "yellow-red"
      )
    ) {
      return "second-yellow-red";
    }

    if (
      value.includes(
        "red card"
      ) ||
      value ===
        "red" ||
      value.includes(
        "redcard"
      )
    ) {
      return "red";
    }

    /*
     * Algunas respuestas pueden traer:
     *
     * type: "Card"
     * card: "Red"
     */
    const type =
      this.asString(
        event.type
      )
        ?.toLowerCase();

    const card =
      this.firstString(
        event,
        [
          "card",
          "cardType",
        ]
      )
        ?.toLowerCase();

    if (
      type ===
        "card" &&
      card?.includes(
        "red"
      )
    ) {
      return "red";
    }

    return null;
  }

  private asObject(
    value:
      unknown
  ): JsonObject {

    return (
      value !==
        null &&
      typeof value ===
        "object" &&
      !Array.isArray(
        value
      )
    )
      ? value as
          JsonObject
      : {};
  }

  private asNumber(
    value:
      unknown
  ): number | null {

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      return value;
    }

    if (
      typeof value ===
      "string"
    ) {
      const parsed =
        Number(
          value
        );

      if (
        Number.isFinite(
          parsed
        )
      ) {
        return parsed;
      }
    }

    return null;
  }

  private asString(
    value:
      unknown
  ): string | null {

    return typeof value ===
      "string"
      ? value
      : null;
  }

  private asId(
    value:
      unknown
  ): string | null {

    if (
      typeof value ===
      "string"
    ) {
      return value;
    }

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      return String(
        value
      );
    }

    return null;
  }

  private firstNumber(
    object:
      JsonObject,

    keys:
      string[]
  ): number | null {

    for (
      const key
      of keys
    ) {
      const value =
        this.asNumber(
          object[
            key
          ]
        );

      if (
        value !==
        null
      ) {
        return value;
      }
    }

    return null;
  }

  private firstString(
    object:
      JsonObject,

    keys:
      string[]
  ): string | null {

    for (
      const key
      of keys
    ) {

      const value =
        this.asString(
          object[
            key
          ]
        );

      if (
        value &&
        value.trim()
      ) {
        return value;
      }
    }

    return null;
  }
}
