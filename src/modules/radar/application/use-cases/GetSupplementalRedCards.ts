import type {
  GetLiveMatches,
} from "../../../football/application/use-cases/GetLiveMatches";

import type {
  SupplementalRedCardDto,
} from "../dto/SupplementalRedCardDto";

import {
  MultiSourceRedCardAggregator,
} from "../services/MultiSourceRedCardAggregator";

import {
  SupplementalRedCardMapper,
} from "../services/SupplementalRedCardMapper";

export class GetSupplementalRedCards {
  constructor(
    private readonly getLiveMatches:
      GetLiveMatches,

    private readonly aggregator:
      MultiSourceRedCardAggregator,

    private readonly mapper:
      SupplementalRedCardMapper
  ) {}

  public async execute():
    Promise<
      SupplementalRedCardDto[]
    > {

    const matches =
      await this
        .getLiveMatches
        .execute();

    if (
      matches.length ===
      0
    ) {
      return [];
    }

    const detections =
      await this
        .aggregator
        .scan(
          matches
        );

    return detections.map(
      (
        detection
      ) =>
        this.mapper
          .toDto(
            detection
          )
    );
  }
}
