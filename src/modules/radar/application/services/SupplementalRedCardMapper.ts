import type {
  MultiSourceRedCardDetection,
} from "../../domain/entities/MultiSourceRedCardDetection";

import type {
  SupplementalRedCardDto,
} from "../dto/SupplementalRedCardDto";

export class SupplementalRedCardMapper {
  public toDto(
    detection:
      MultiSourceRedCardDetection
  ): SupplementalRedCardDto {

    return {
      match: {
        kickoffAt:
          detection.match
            .kickoffAt,

        status: {
          long:
            detection.match
              .status
              .long,

          short:
            detection.match
              .status
              .short,

          minute:
            detection.match
              .status
              .minute,
        },

        competition: {
          name:
            detection.match
              .competition
              .name,

          country:
            detection.match
              .competition
              .country,
        },

        home: {
          name:
            detection.match
              .home
              .name,

          goals:
            detection.match
              .home
              .goals,

          redCards:
            detection
              .homeRedCards,
        },

        away: {
          name:
            detection.match
              .away
              .name,

          goals:
            detection.match
              .away
              .goals,

          redCards:
            detection
              .awayRedCards,
        },

        sources:
          detection.match
            .sources
            .map(
              (
                source
              ) => ({
                provider:
                  source.provider,

                externalId:
                  source.externalId,
              })
            ),
      },

      detection: {
        totalRedCards:
          detection
            .totalRedCards,

        confidence:
          detection
            .confidence,

        providers:
          detection
            .sources,

        events:
          detection.events.map(
            (
              event
            ) => ({
              provider:
                event.provider,

              side:
                event.side,

              minute:
                event.minute,

              addedTime:
                event.addedTime,

              playerName:
                event.playerName,

              type:
                event.type,
            })
          ),
      },
    };
  }
}
