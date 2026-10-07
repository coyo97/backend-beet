import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import {
  FotMobRedCardProvider,
} from "../../../football/infrastructure/providers/fotmob/FotMobRedCardProvider";

import type {
  FotMobRedCardSnapshot,
} from "../../../football/infrastructure/providers/fotmob/FotMobRedCardSnapshot";

export interface FotMobScannedRedCardMatch {
  match:
    LiveMatch;

  fotmobExternalId:
    string;

  snapshot:
    FotMobRedCardSnapshot;
}

interface CacheEntry {
  snapshot:
    FotMobRedCardSnapshot;

  expiresAt:
    number;
}

export class FotMobRedCardScanner {
  private readonly cache =
    new Map<
      string,
      CacheEntry
    >();

  constructor(
    private readonly provider:
      FotMobRedCardProvider,

    private readonly cacheMs =
      10_000,

    private readonly concurrency =
      4
  ) {}

  public async scan(
    matches:
      LiveMatch[]
  ): Promise<
    FotMobScannedRedCardMatch[]
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
      FotMobScannedRedCardMatch[] =
        [];

	    let successful =
      0;

    let failed =
      0;

    let redDetections =
      0;

    /*
     * Worker pool.
     *
     * No hacemos 40 requests
     * simultáneos a FotMob.
     */
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
            const snapshot =
              await this.getSnapshot(
                candidate
                  .fotmobExternalId
              );

			              successful +=
              1;

            if (
              !snapshot.hasRedCard
            ) {
              continue;
            }

			            redDetections +=
              1;

            results.push({
              match:
                candidate.match,

              fotmobExternalId:
                candidate
                  .fotmobExternalId,

              snapshot,
            });
          } catch (
            error
          ) {

            /*
             * Fail-soft:
             * una consulta FotMob
             * nunca rompe todo el radar.
             */
			            failed +=
              1;
            console.warn(
              "[FotMobRedCardScanner] failed",
              candidate
                .fotmobExternalId,
              error instanceof
                Error
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

	    console.log(
      "[FotMobRedCardScanner]",
      `candidates=${candidates.length}`,
      `successful=${successful}`,
      `failed=${failed}`,
      `reds=${redDetections}`
    );

	return results;	

    return results;
  }

  private getCandidates(
    matches:
      LiveMatch[]
  ): Array<{
    match:
      LiveMatch;

    fotmobExternalId:
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

        fotmobExternalId:
          string;
      }> =
        [];

    for (
      const match
      of matches
    ) {

      const source =
        match.sources.find(
          (
            item
          ) =>
            item.provider ===
            "fotmob"
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

        fotmobExternalId:
          source.externalId,
      });
    }

    return result;
  }

  private async getSnapshot(
    externalId:
      string
  ): Promise<
    FotMobRedCardSnapshot
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
      return cached
        .snapshot;
    }

    const snapshot =
      await this.provider
        .getSnapshot(
          externalId
        );

    this.cache.set(
      externalId,
      {
        snapshot,

        expiresAt:
          Date.now() +
          this.cacheMs,
      }
    );

    return snapshot;
  }
}
