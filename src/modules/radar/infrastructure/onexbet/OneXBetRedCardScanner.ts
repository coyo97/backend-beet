import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import {
  OneXBetLiveSnapshotProvider,
} from "../../../football/infrastructure/providers/onexbet/OneXBetLiveSnapshotProvider";

import type {
  OneXBetLiveSnapshot,
} from "../../../football/infrastructure/providers/onexbet/OneXBetLiveSnapshot";

export interface OneXBetRedCardMatch {
  match:
    LiveMatch;

  snapshot:
    OneXBetLiveSnapshot;
}

export class OneXBetRedCardScanner {
  constructor(
    private readonly snapshots:
      OneXBetLiveSnapshotProvider
  ) {}

  public async scan(
    matches:
      LiveMatch[]
  ): Promise<
    OneXBetRedCardMatch[]
  > {

    const candidates =
      matches.flatMap(
        (
          match
        ) => {

          const source =
            match.sources.find(
              (
                item
              ) =>
                item.provider ===
                "bookmaker"
            );

          if (!source) {
            return [];
          }

          return [
            {
              match,
              externalId:
                source.externalId,
            },
          ];
        }
      );

    if (
      candidates.length ===
      0
    ) {
      return [];
    }

    /*
     * Una sola descarga del HTML.
     */
    const snapshots =
      await this.snapshots
        .getSnapshots(
          candidates.map(
            (
              item
            ) =>
              item.externalId
          )
        );

		    console.log(
      "[OneXBetRedCardScanner]",
      `candidates=${candidates.length}`,
      `snapshots=${snapshots.length}`
    );

    const byId =
      new Map(
        snapshots.map(
          (
            snapshot
          ) => [
            snapshot.externalId,
            snapshot,
          ]
        )
      );

    const result:
      OneXBetRedCardMatch[] =
        [];

    for (
      const candidate
      of candidates
    ) {

      const snapshot =
        byId.get(
          candidate.externalId
        );

      if (!snapshot) {
        continue;
      }

      const home =
        snapshot
          .homeRedCards ??
        0;

      const away =
        snapshot
          .awayRedCards ??
        0;

      if (
        home +
          away ===
        0
      ) {
        continue;
      }

      result.push({
        match:
          candidate.match,

        snapshot,
      });
    }

    return result;
  }
}
