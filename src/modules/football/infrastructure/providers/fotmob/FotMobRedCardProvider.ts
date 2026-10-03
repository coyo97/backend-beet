import {
  FotMobClient,
} from "./FotMobClient";

import {
  FotMobRedCardExtractor,
} from "./FotMobRedCardExtractor";

import type {
  FotMobRedCardSnapshot,
} from "./FotMobRedCardSnapshot";

export class FotMobRedCardProvider {
  constructor(
    private readonly client:
      FotMobClient,

    private readonly extractor:
      FotMobRedCardExtractor
  ) {}

  public supports(
    provider:
      string
  ): boolean {

    return provider ===
      "fotmob";
  }

  public async getSnapshot(
    externalId:
      string
  ): Promise<
    FotMobRedCardSnapshot
  > {

    const details =
      await this.client
        .getMatchDetails(
          externalId
        );

    return this.extractor
      .extract(
        details
      );
  }
}
