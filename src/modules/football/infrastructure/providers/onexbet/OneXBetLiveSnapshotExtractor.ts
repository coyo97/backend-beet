import type {
  OneXBetLiveSnapshot,
} from "./OneXBetLiveSnapshot";

type Primitive =
  string |
  number |
  boolean |
  null;

export class OneXBetLiveSnapshotExtractor {
  public extract(
    html:
      string,

    externalId:
      string
  ): OneXBetLiveSnapshot | null {

    const normalized =
      this.normalizeHtml(
        html
      );

    const fragment =
      this.findGameFragment(
        normalized,
        externalId
      );

    if (!fragment) {
      return null;
    }

    const fields =
      this.extractPrimitiveFields(
        fragment
      );

    const homeScore =
      this.firstNumber(
        fields,
        [
          "firstOpponentScore",
          "firstTeamScore",
          "firstScore",
          "score1",
          "homeScore",
        ]
      );

    const awayScore =
      this.firstNumber(
        fields,
        [
          "secondOpponentScore",
          "secondTeamScore",
          "secondScore",
          "score2",
          "awayScore",
        ]
      );

    /*
     * Solo nombres bastante explícitos.
     *
     * NO intentamos interpretar cualquier
     * número relacionado con "card".
     */
    const homeRedCards =
      this.firstNumber(
        fields,
        [
          "firstOpponentRedCards",
          "firstOpponentRedCard",
          "firstTeamRedCards",
          "homeRedCards",
          "redCards1",
          "redCard1",
        ]
      );

    const awayRedCards =
      this.firstNumber(
        fields,
        [
          "secondOpponentRedCards",
          "secondOpponentRedCard",
          "secondTeamRedCards",
          "awayRedCards",
          "redCards2",
          "redCard2",
        ]
      );

    const clock =
      this.firstString(
        fields,
        [
          "timeFormatted",
          "timer",
          "gameTime",
          "time",
        ]
      );

    return {
      externalId,

      clock,

      homeScore,

      awayScore,

      homeRedCards,

      awayRedCards,

      redLikeFields:
        this.filterFields(
          fields,
          (
            key
          ) =>
            key
              .toLowerCase()
              .includes(
                "red"
              )
        ),

      cardLikeFields:
        this.filterFields(
          fields,
          (
            key
          ) =>
            key
              .toLowerCase()
              .includes(
                "card"
              )
        ),

      statLikeFields:
        this.filterFields(
          fields,
          (
            key
          ) => {

            const value =
              key.toLowerCase();

            return (
              value.includes(
                "corner"
              ) ||
              value.includes(
                "stat"
              ) ||
              value.includes(
                "yellow"
              ) ||
              value.includes(
                "possession"
              ) ||
              value.includes(
                "shot"
              )
            );
          }
        ),

		      capabilityLikeFields:
        this.filterFields(
          fields,
          (
            key
          ) => {

            const value =
              key.toLowerCase();

            return (
              value.includes(
                "head"
              ) ||
              value.includes(
                "h2h"
              ) ||
              value.includes(
                "lineup"
              ) ||
              value.includes(
                "timeline"
              ) ||
              value.includes(
                "history"
              ) ||
              value.includes(
                "recent"
              ) ||
              value.includes(
                "last"
              ) ||
              value.includes(
                "form"
              ) ||
              value.includes(
                "rating"
              ) ||
              value.includes(
                "table"
              )
            );
          }
        ),
		      debugPrimitiveFields:
        fields,
    };
  }

  private findGameFragment(
    source:
      string,

    externalId:
      string
  ): string | null {

    const markers = [
      `"gameId":${externalId}`,
      `"gameId":"${externalId}"`,
      `"gameNameForUrl":"${externalId}-`,
      `/${externalId}-`,
    ];

    let index =
      -1;

    for (
      const marker
      of markers
    ) {

      index =
        source.indexOf(
          marker
        );

      if (
        index !==
        -1
      ) {
        break;
      }
    }

    if (
      index ===
      -1
    ) {
      return null;
    }

    /*
     * Los objetos de partido que vimos
     * comienzan normalmente cerca de:
     *
     * "sportId":1
     *
     * Intentamos aislar solo un evento.
     */
    const gameStart =
      source.lastIndexOf(
        '"sportId":1',
        index
      );

    const nextGame =
      source.indexOf(
        '"sportId":1',
        index +
        1
      );

    if (
      gameStart !==
      -1
    ) {

      const start =
        Math.max(
          0,
          gameStart -
            500
        );

      const end =
        nextGame !==
          -1
          ? Math.min(
              source.length,
              nextGame
            )
          : Math.min(
              source.length,
              index +
                15_000
            );

      return source.slice(
        start,
        end
      );
    }

    /*
     * Fallback.
     */
    return source.slice(
      Math.max(
        0,
        index -
          6_000
      ),

      Math.min(
        source.length,
        index +
          12_000
      )
    );
  }

  private extractPrimitiveFields(
    fragment:
      string
  ): Record<
    string,
    Primitive
  > {

    const result:
      Record<
        string,
        Primitive
      > =
        {};

    /*
     * Strings.
     */
    const stringRegex =
      /"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;

    for (
      const match
      of fragment.matchAll(
        stringRegex
      )
    ) {

      const key =
        match[1];

      if (
        result[
          key
        ] !==
        undefined
      ) {
        continue;
      }

      result[
        key
      ] =
        this.decodeString(
          match[2]
        );
    }

    /*
     * Numbers.
     */
    const numberRegex =
      /"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*(-?\d+(?:\.\d+)?)(?=\s*[,}])/g;

    for (
      const match
      of fragment.matchAll(
        numberRegex
      )
    ) {

      const key =
        match[1];

      if (
        result[
          key
        ] !==
        undefined
      ) {
        continue;
      }

      const value =
        Number(
          match[2]
        );

      if (
        Number.isFinite(
          value
        )
      ) {
        result[
          key
        ] =
          value;
      }
    }

    /*
     * Boolean / null.
     */
    const primitiveRegex =
      /"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*(true|false|null)(?=\s*[,}])/g;

    for (
      const match
      of fragment.matchAll(
        primitiveRegex
      )
    ) {

      const key =
        match[1];

      if (
        result[
          key
        ] !==
        undefined
      ) {
        continue;
      }

      switch (
        match[2]
      ) {

        case "true":
          result[
            key
          ] =
            true;
          break;

        case "false":
          result[
            key
          ] =
            false;
          break;

        default:
          result[
            key
          ] =
            null;
      }
    }

    return result;
  }

  private firstNumber(
    fields:
      Record<
        string,
        Primitive
      >,

    keys:
      string[]
  ): number | null {

    for (
      const key
      of keys
    ) {

      const value =
        fields[
          key
        ];

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
    }

    return null;
  }

  private firstString(
    fields:
      Record<
        string,
        Primitive
      >,

    keys:
      string[]
  ): string | null {

    for (
      const key
      of keys
    ) {

      const value =
        fields[
          key
        ];

      if (
        typeof value ===
          "string" &&
        value.trim()
      ) {
        return value;
      }
    }

    return null;
  }

  private filterFields(
    fields:
      Record<
        string,
        Primitive
      >,

    predicate:
      (
        key:
          string
      ) => boolean
  ): Record<
    string,
    Primitive
  > {

    const result:
      Record<
        string,
        Primitive
      > =
        {};

    for (
      const [
        key,
        value,
      ]
      of Object.entries(
        fields
      )
    ) {

      if (
        predicate(
          key
        )
      ) {
        result[
          key
        ] =
          value;
      }
    }

    return result;
  }

  private normalizeHtml(
    html:
      string
  ): string {

    return html
      .replace(
        /&quot;/gi,
        '"'
      )
      .replace(
        /&#34;/gi,
        '"'
      )
      .replace(
        /\\u0022/gi,
        '"'
      )
      .replace(
        /\\"/g,
        '"'
      )
      .replace(
        /\\u0026/gi,
        "&"
      );
  }

  private decodeString(
    value:
      string
  ): string {

    try {
      return JSON.parse(
        `"${value}"`
      );
    } catch {

      return value
        .replace(
          /\\\//g,
          "/"
        )
        .replace(
          /\\\\/g,
          "\\"
        );
    }
  }
}
