import type {
  OneXBetLiveGame,
} from "./OneXBetLiveGame";

type JsonRecord =
  Record<
    string,
    unknown
  >;

export class OneXBetLiveHtmlParser {
  public parse(
    html:
      string
  ): OneXBetLiveGame[] {

    /*
     * 1xBet incorpora en el HTML un
     * estado serializado con un array:
     *
     * normalizedDataItems-
     * betting/home/live/
     * dashboardStore-games
     *
     * Antes buscábamos campos dentro
     * de ventanas de texto muy grandes.
     * Eso permitía mezclar dos partidos.
     *
     * Ahora extraemos cada objeto JSON
     * completo antes de mapearlo.
     */
    const normalized =
      this.normalizeEmbeddedJson(
        html
      );

    const rawGames =
      this.extractRawGames(
        normalized
      );

    const games =
      new Map<
        string,
        OneXBetLiveGame
      >();

    for (
      const rawGame
      of rawGames
    ) {
      const game =
        this.toLiveGame(
          rawGame
        );

      if (!game) {
        continue;
      }

      games.set(
        game.id,
        game
      );
    }

    return Array.from(
      games.values()
    );
  }

  private extractRawGames(
    source:
      string
  ): JsonRecord[] {

    /*
     * La URL puede aparecer como:
     *
     * betting/home/live/...
     *
     * o:
     *
     * betting\u002Fhome\u002Flive...
     */
    const pattern =
      /"normalizedDataItems-betting(?:\\u002F|\/)home(?:\\u002F|\/)live(?:\\u002F|\/)dashboardStore-games"\s*:\s*\[/g;

    const result:
      JsonRecord[] =
      [];

    let match:
      RegExpExecArray |
      null;

    while (
      (
        match =
          pattern.exec(
            source
          )
      )
    ) {
      const relativeArrayStart =
        match[0]
          .lastIndexOf(
            "["
          );

      if (
        relativeArrayStart ===
        -1
      ) {
        continue;
      }

      const arrayStart =
        match.index +
        relativeArrayStart;

      const jsonArray =
        this.extractBalancedArray(
          source,
          arrayStart
        );

      if (!jsonArray) {
        continue;
      }

      try {
        const parsed:
          unknown =
          JSON.parse(
            jsonArray
          );

        if (
          !Array.isArray(
            parsed
          )
        ) {
          continue;
        }

        for (
          const item
          of parsed
        ) {
          const record =
            this.asRecord(
              item
            );

          if (record) {
            result.push(
              record
            );
          }
        }
      } catch (
        error
      ) {
        console.warn(
          "[OneXBetParser] could not parse dashboard games JSON",
          error
        );
      }
    }

    return result;
  }

  private extractBalancedArray(
    source:
      string,

    start:
      number
  ): string | null {

    if (
      source[start] !==
      "["
    ) {
      return null;
    }

    let depth =
      0;

    let inString =
      false;

    let escaped =
      false;

    for (
      let index =
        start;

      index <
      source.length;

      index +=
        1
    ) {
      const char =
        source[index];

      if (inString) {
        if (escaped) {
          escaped =
            false;

          continue;
        }

        if (
          char ===
          "\\"
        ) {
          escaped =
            true;

          continue;
        }

        if (
          char ===
          '"'
        ) {
          inString =
            false;
        }

        continue;
      }

      if (
        char ===
        '"'
      ) {
        inString =
          true;

        continue;
      }

      if (
        char ===
        "["
      ) {
        depth +=
          1;

        continue;
      }

      if (
        char ===
        "]"
      ) {
        depth -=
          1;

        if (
          depth ===
          0
        ) {
          return source.slice(
            start,
            index +
              1
          );
        }
      }
    }

    return null;
  }

  private toLiveGame(
    raw:
      JsonRecord
  ): OneXBetLiveGame |
    null {

    const sportId =
      this.numberValue(
        raw.sportId
      );

    /*
     * 1 = Football
     */
    if (
      sportId !==
        null &&
      sportId !==
        1
    ) {
      return null;
    }

    const id =
      this.resolveGameId(
        raw
      );

    const competitionName =
      this.stringValue(
        raw.champName
      );

    const homeName =
      this.stringValue(
        raw.firstOpponentName
      );

    const awayName =
      this.stringValue(
        raw.secondOpponentName
      );

    if (
      !id ||
      !competitionName ||
      !homeName ||
      !awayName
    ) {
      return null;
    }

    const scores =
      this.asRecord(
        raw.unparsedScoresData
      );

    const timer =
      this.asRecord(
        scores?.timer
      );

    const homeScore =
      this.firstNumberValue(
        [
          raw.firstOpponentFullScore,
          scores?.scoreOpp1,
          raw.firstOpponentScoreLabel,
        ]
      );

    const awayScore =
      this.firstNumberValue(
        [
          raw.secondOpponentFullScore,
          scores?.scoreOpp2,
          raw.secondOpponentScoreLabel,
        ]
      );

    const clock =
      this.stringValue(
        raw.timeFormatted
      ) ??
      this.clockFromSeconds(
        this.numberValue(
          raw.timeInSeconds
        )
      ) ??
      this.clockFromSeconds(
        this.numberValue(
          timer?.timeSec
        )
      ) ??
      this.clockFromStatus(
        this.stringValue(
          raw.gameTimeStatus
        )
      );

    const period =
      this.firstStringValue(
        [
          raw.currentPeriodLabel,
          scores?.currentPeriodName,
          raw.gamePeriodName,
          raw.periodName,
        ]
      );

    return {
      id,

      championshipId:
        this.stringValue(
          raw.champId
        ),

      competitionName,

      countryName:
        this.stringValue(
          raw.countryName
        ) ??
        "World",

      homeId:
        this.stringValue(
          raw.firstOpponentId
        ),

      homeName,

      awayId:
        this.stringValue(
          raw.secondOpponentId
        ),

      awayName,

      homeScore,

      awayScore,

      clock,

      period,

      startAt:
        this.resolveStartAt(
          raw
        ),
		      gameIdForUrl:
        this.stringValue(
          raw.gameIdForUrl
        ),

      gameNameForUrl:
        this.stringValue(
          raw.gameNameForUrl
        ),

      hasHeadToHead:
        raw.hasHeadToHead ===
          true,

      hasLineups:
        raw.hasLineups ===
          true,

      hasTimeline:
        raw.hasTimeline ===
          true,
    };
  }

  private resolveGameId(
    raw:
      JsonRecord
  ): string | null {

    const explicit =
      this.stringValue(
        raw.id
      );

    if (explicit) {
      return explicit;
    }

    const gameIdForUrl =
      this.stringValue(
        raw.gameIdForUrl
      );

    if (gameIdForUrl) {
      return gameIdForUrl;
    }

    const gameName =
      this.stringValue(
        raw.gameNameForUrl
      );

    const match =
      gameName?.match(
        /^(\d+)/
      );

    return match?.[1] ??
      null;
  }

  private resolveStartAt(
    raw:
      JsonRecord
  ): string | null {

    /*
     * En el HTML observado tenemos:
     *
     * startTimestamp:
     * 1790654400000
     *
     * startUnixTimestamp:
     * 1790654400
     */
    const candidates =
      [
        raw.startTimestamp,
        raw.startUnixTimestamp,
        raw.startTime,
        raw.dateStart,
      ];

    for (
      const candidate
      of candidates
    ) {
      const numeric =
        this.numberValue(
          candidate
        );

      if (
        numeric !==
        null
      ) {
        const millis =
          numeric <
          10_000_000_000
            ? numeric *
              1000
            : numeric;

        const date =
          new Date(
            millis
          );

        if (
          !Number.isNaN(
            date.getTime()
          )
        ) {
          return date
            .toISOString();
        }
      }

      const text =
        this.stringValue(
          candidate
        );

      if (!text) {
        continue;
      }

      const date =
        new Date(
          text
        );

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        return date
          .toISOString();
      }
    }

    return null;
  }

  private clockFromSeconds(
    seconds:
      number | null
  ): string | null {

    if (
      seconds ===
        null ||
      seconds <
        0
    ) {
      return null;
    }

    const wholeSeconds =
      Math.floor(
        seconds
      );

    const minutes =
      Math.floor(
        wholeSeconds /
        60
      );

    const remainder =
      wholeSeconds %
      60;

    return [
      minutes,
      remainder
        .toString()
        .padStart(
          2,
          "0"
        ),
    ].join(
      ":"
    );
  }

  private clockFromStatus(
    status:
      string | null
  ): string | null {

    if (!status) {
      return null;
    }

    const match =
      status.match(
        /(\d{1,3})\s*minutes?/i
      );

    if (!match) {
      return null;
    }

    return `${match[1]}:00`;
  }

  private firstNumberValue(
    values:
      unknown[]
  ): number | null {

    for (
      const value
      of values
    ) {
      const parsed =
        this.numberValue(
          value
        );

      if (
        parsed !==
        null
      ) {
        return parsed;
      }
    }

    return null;
  }

  private firstStringValue(
    values:
      unknown[]
  ): string | null {

    for (
      const value
      of values
    ) {
      const parsed =
        this.stringValue(
          value
        );

      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private stringValue(
    value:
      unknown
  ): string | null {

    if (
      typeof value ===
      "string"
    ) {
      const trimmed =
        value.trim();

      return trimmed ||
        null;
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

  private numberValue(
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
      const trimmed =
        value.trim();

      if (!trimmed) {
        return null;
      }

      const parsed =
        Number(
          trimmed
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

  private asRecord(
    value:
      unknown
  ): JsonRecord | null {

    if (
      !value ||
      typeof value !==
        "object" ||
      Array.isArray(
        value
      )
    ) {
      return null;
    }

    return value as
      JsonRecord;
  }

  private normalizeEmbeddedJson(
    html:
      string
  ): string {

    /*
     * El estado de 1xBet aparece
     * serializado dentro del HTML.
     *
     * Convertimos las comillas externas
     * escapadas para recuperar el JSON.
     *
     * No convertimos \u002F porque es
     * perfectamente válido dentro de JSON.
     */
    return html
      .replace(
        /&quot;/g,
        '"'
      )
      .replace(
        /&#34;/g,
        '"'
      )
      .replace(
        /\\"/g,
        '"'
      );
  }
}
