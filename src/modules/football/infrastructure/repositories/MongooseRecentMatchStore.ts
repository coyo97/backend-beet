import type {
  LiveMatch,
  MatchSource,
} from "../../domain/entities/LiveMatch";

import type {
  RecentMatch,
} from "../../domain/entities/RecentMatch";

import type {
  ListRecentMatchesInput,
  RecentMatchStore,
} from "../../application/ports/RecentMatchStore";

import {
  RecentMatchSnapshotModel,
  type RecentMatchSnapshotDocument,
} from "../database/models/RecentMatchSnapshotModel";

const ACTIVE_LOOKBACK_MS =
  72 *
  60 *
  60 *
  1000;

/*
 * Un partido debe faltar durante
 * dos minutos antes de considerarlo
 * fuera del live.
 *
 * Evita que un pequeño fallo de una
 * fuente lo convierta inmediatamente
 * en "terminado".
 */
const MISSING_GRACE_MS =
  2 *
  60 *
  1000;

const EXPIRE_EARLY_MISSING_MS =
  15 *
  60 *
  1000;

export class MongooseRecentMatchStore
  implements RecentMatchStore
{
  /*
   * Serializamos las observaciones para
   * evitar carreras si distintos módulos
   * llaman getLiveMatches al mismo tiempo.
   */
  private writeQueue:
    Promise<void> =
    Promise.resolve();

  public observe(
    matches:
      LiveMatch[]
  ): Promise<void> {

    /*
     * Si TODAS las fuentes fallaron y el
     * composite devuelve cero, no declaramos
     * terminados todos los partidos.
     */
    if (
      matches.length ===
      0
    ) {
      return Promise.resolve();
    }

    const operation =
      this.writeQueue
        .then(
          () =>
            this.observeInternal(
              matches
            )
        );

    this.writeQueue =
      operation.catch(
        (
          error
        ) => {
          console.error(
            "[RecentMatchStore.observe]",
            error
          );
        }
      );

    return operation;
  }

public async listRecent(
  input:
    ListRecentMatchesInput
): Promise<
  RecentMatch[]
> {

  const requestedLimit =
    Math.min(
      Math.max(
        input.limit,
        1
      ),
      400
    );

  /*
   * No aplicamos limit() en Mongo todavía.
   *
   * La colección puede contener varios
   * snapshots correspondientes al mismo
   * partido.
   *
   * Primero obtenemos los partidos del
   * período, después deduplicamos y
   * finalmente aplicamos el límite.
   */
  const documents =
    await RecentMatchSnapshotModel
      .find({
        state:
          "recent",

        endedAt: {
          $gte:
            input.since,
        },
      })
      .sort({
        endedAt:
          -1,
      })
      .exec();

  const uniqueDocuments:
    RecentMatchSnapshotDocument[] =
    [];

  const seenSourceKeys =
    new Set<string>();

  const seenMatchKeys =
    new Set<string>();

  for (
    const document
    of documents
  ) {

    if (
      document.endedAt ===
      null
    ) {
      continue;
    }

    const match =
      document.snapshot as
        LiveMatch;

    if (
      !match ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    const sourceKeys =
      this.getSourceKeys(
        match
      );

    const matchKey =
      this.getMatchIdentityKey(
        match
      );

    const duplicatedBySource =
      sourceKeys.some(
        sourceKey =>
          seenSourceKeys.has(
            sourceKey
          )
      );

    const duplicatedByIdentity =
      seenMatchKeys.has(
        matchKey
      );

    if (
      duplicatedBySource ||
      duplicatedByIdentity
    ) {
      continue;
    }

    for (
      const sourceKey
      of sourceKeys
    ) {
      seenSourceKeys.add(
        sourceKey
      );
    }

    seenMatchKeys.add(
      matchKey
    );

    uniqueDocuments.push(
      document
    );

    if (
      uniqueDocuments.length >=
      requestedLimit
    ) {
      break;
    }
  }

  return uniqueDocuments
    .map(
      document => ({
        match:
          document.snapshot as
            LiveMatch,

        lastSeenAt:
          document.lastSeenAt
            .toISOString(),

        endedAt:
          document.endedAt!
            .toISOString(),

        resultConfirmed:
          document.resultConfirmed,
      })
    );
}

  private async observeInternal(
    matches:
      LiveMatch[]
  ): Promise<void> {

    const now =
      new Date();

    const cutoff =
      new Date(
        now.getTime() -
        ACTIVE_LOOKBACK_MS
      );

    /*
     * Cargamos los live y recent recientes.
     *
     * Esto permite que si un partido
     * reaparece después de una interrupción,
     * vuelva a LIVE en vez de duplicarse.
     */
    const documents =
      await RecentMatchSnapshotModel
        .find({
          state: {
            $in: [
              "live",
              "recent",
            ],
          },

          lastSeenAt: {
            $gte:
              cutoff,
          },
        })
        .exec();

    const sourceMap =
      new Map<
        string,
        RecentMatchSnapshotDocument
      >();

    const previouslyLive =
      new Set<string>();

    for (
      const document
      of documents
    ) {

      const documentId =
        String(
          document._id
        );

      if (
        document.state ===
        "live"
      ) {
        previouslyLive.add(
          documentId
        );
      }

      for (
        const sourceKey
        of document.sourceKeys
      ) {
        sourceMap.set(
          sourceKey,
          document
        );
      }
    }

    const touched =
      new Set<string>();

    const saves:
      Promise<unknown>[] =
      [];

    for (
      const match
      of matches
    ) {

      const sourceKeys =
        this.getSourceKeys(
          match
        );

      if (
        sourceKeys.length ===
        0
      ) {
        continue;
      }

      let document:
        RecentMatchSnapshotDocument |
        undefined;

      for (
        const sourceKey
        of sourceKeys
      ) {

        const candidate =
          sourceMap.get(
            sourceKey
          );

        if (
          candidate &&
          !touched.has(
            String(
              candidate._id
            )
          )
        ) {
          document =
            candidate;

          break;
        }
      }

      const confirmed =
        this.isConfirmedFinished(
          match
        );

      if (
        !document
      ) {

        document =
          new RecentMatchSnapshotModel({
            sourceKeys,

            state:
              confirmed
                ? "recent"
                : "live",

            snapshot:
              match,

            firstSeenAt:
              now,

            lastSeenAt:
              now,

            missingSince:
              null,

            endedAt:
              confirmed
                ? now
                : null,

            resultConfirmed:
              confirmed,
          });

        documents.push(
          document
        );
      } else {

        document.sourceKeys =
          Array.from(
            new Set([
              ...document
                .sourceKeys,

              ...sourceKeys,
            ])
          );

        document.snapshot =
          match;

        document.lastSeenAt =
          now;

        document.missingSince =
          null;

        if (
          confirmed
        ) {
          document.state =
            "recent";

          document.endedAt =
            document.endedAt ??
            now;

          document.resultConfirmed =
            true;
        } else {
          /*
           * Si había desaparecido unos
           * segundos y regresó, vuelve
           * normalmente a LIVE.
           */
          document.state =
            "live";

          document.endedAt =
            null;

          document.resultConfirmed =
            false;
        }
      }

      const documentId =
        String(
          document._id
        );

      touched.add(
        documentId
      );

      for (
        const sourceKey
        of document.sourceKeys
      ) {
        sourceMap.set(
          sourceKey,
          document
        );
      }

      saves.push(
        document.save()
      );
    }

    /*
     * Ahora buscamos los partidos que
     * estaban live anteriormente pero
     * ya no llegaron en esta observación.
     */
    for (
      const document
      of documents
    ) {

      const documentId =
        String(
          document._id
        );

      if (
        !previouslyLive.has(
          documentId
        ) ||
        touched.has(
          documentId
        )
      ) {
        continue;
      }

      if (
        !document.missingSince
      ) {
        document.missingSince =
          now;

        saves.push(
          document.save()
        );

        continue;
      }

      const missingFor =
        now.getTime() -
        document
          .missingSince
          .getTime();

      if (
        missingFor <
        MISSING_GRACE_MS
      ) {
        continue;
      }

      const match =
        document
          .snapshot as
          LiveMatch;

      /*
       * Solo convertimos a RECENT automáticamente
       * si el partido ya estaba razonablemente
       * avanzado.
       *
       * Un partido que desaparece en el minuto 20
       * probablemente sea problema de cobertura,
       * suspensión o fallo del provider.
       */
      if (
        this.isRecentCandidate(
          match
        )
      ) {

        document.state =
          "recent";

        document.endedAt =
          now;

        document.resultConfirmed =
          this.isConfirmedFinished(
            match
          );

        saves.push(
          document.save()
        );

        continue;
      }

      /*
       * Un partido temprano que desapareció
       * durante mucho tiempo no se muestra
       * como finalizado.
       */
      const sinceLastSeen =
        now.getTime() -
        document
          .lastSeenAt
          .getTime();

      if (
        sinceLastSeen >=
        EXPIRE_EARLY_MISSING_MS
      ) {
        document.state =
          "expired";

        saves.push(
          document.save()
        );
      }
    }

    await Promise.all(
      saves
    );
  }

  private getSourceKeys(
    match:
      LiveMatch
  ): string[] {

    return Array.from(
      new Set(
        match.sources
          .map(
            (
              source
            ) =>
              this.sourceKey(
                source
              )
          )
          .filter(
            Boolean
          )
      )
    );
  }
  private getMatchIdentityKey(
  match:
    LiveMatch
): string {

  const normalize =
    (
      value:
        string
    ) =>
      value
        .normalize(
          "NFD"
        )
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .trim()
        .toLowerCase()
        .replace(
          /\s+/g,
          " "
        );

  return [
    normalize(
      match.home.name
    ),

    normalize(
      match.away.name
    ),

    match.kickoffAt,
  ].join(
    "|"
  );
}

  private sourceKey(
    source:
      MatchSource
  ): string {

    return [
      source.provider,
      source.externalId,
    ].join(
      ":"
    );
  }

  private isConfirmedFinished(
    match:
      LiveMatch
  ): boolean {

    const short =
      match.status
        .short
        .trim()
        .toUpperCase();

    const long =
      match.status
        .long
        .trim()
        .toLowerCase();

    if (
      [
        "FT",
        "AET",
        "PEN",
      ].includes(
        short
      )
    ) {
      return true;
    }

    return (
      long.includes(
        "finished"
      ) ||
      long.includes(
        "full time"
      ) ||
      long.includes(
        "full-time"
      ) ||
      long.includes(
        "ended"
      ) ||
      long.includes(
        "after extra time"
      ) ||
      long.includes(
        "after penalties"
      )
    );
  }

  private isRecentCandidate(
    match:
      LiveMatch
  ): boolean {

    if (
      this.isConfirmedFinished(
        match
      )
    ) {
      return true;
    }

    if (
      (
        match.status
          .minute ??
        0
      ) >=
      60
    ) {
      return true;
    }

    const short =
      match.status
        .short
        .trim()
        .toUpperCase();

    if (
      [
        "2H",
        "ET",
        "AET",
        "PEN",
      ].includes(
        short
      )
    ) {
      return true;
    }

    const long =
      match.status
        .long
        .trim()
        .toLowerCase();

    return (
      long.includes(
        "second half"
      ) ||
      long.includes(
        "2nd half"
      ) ||
      long.includes(
        "extra time"
      ) ||
      long.includes(
        "penalt"
      )
    );
  }
}
