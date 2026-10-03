import {
  OneXBetLiveClient,
} from "./OneXBetLiveClient";

import {
  OneXBetLiveSnapshotExtractor,
} from "./OneXBetLiveSnapshotExtractor";

import type {
  OneXBetLiveSnapshot,
} from "./OneXBetLiveSnapshot";

export class OneXBetLiveSnapshotProvider {
  private htmlCache:
    string | null =
      null;

  private expiresAt =
    0;

  private loading:
    Promise<
      string
    > | null =
      null;

  constructor(
    private readonly client:
      OneXBetLiveClient,

    private readonly extractor:
      OneXBetLiveSnapshotExtractor,

    private readonly cacheMs =
      10_000
  ) {}

  public async getSnapshot(
    externalId:
      string
  ): Promise<
    OneXBetLiveSnapshot | null
  > {

    const html =
      await this.getHtml();

    return this.extractor
      .extract(
        html,
        externalId
      );
  }

  public async getSnapshots(
    externalIds:
      string[]
  ): Promise<
    OneXBetLiveSnapshot[]
  > {

    const html =
      await this.getHtml();

    const result:
      OneXBetLiveSnapshot[] =
        [];

    for (
      const externalId
      of externalIds
    ) {

      const snapshot =
        this.extractor
          .extract(
            html,
            externalId
          );

      if (snapshot) {
        result.push(
          snapshot
        );
      }
    }

    return result;
  }

  private async getHtml():
    Promise<
      string
    > {

    if (
      this.htmlCache &&
      this.expiresAt >
        Date.now()
    ) {
      return this.htmlCache;
    }

    if (
      this.loading
    ) {
      return this.loading;
    }

    this.loading =
      this.client
        .getLiveHtml();

    try {
      const html =
        await this.loading;

      this.htmlCache =
        html;

      this.expiresAt =
        Date.now() +
        this.cacheMs;

      return html;
    } finally {
      this.loading =
        null;
    }
  }
}
