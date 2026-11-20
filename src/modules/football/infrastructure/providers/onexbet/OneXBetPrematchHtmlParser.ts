type JsonRecord =
  Record<string, unknown>;

export interface OneXBetPrematchGame {
  id: string;

  championshipId: string | null;
  competitionName: string;
  countryName: string;

  homeId: string | null;
  homeName: string;

  awayId: string | null;
  awayName: string;

  kickoffAt: string;

  gameIdForUrl: string | null;
  gameNameForUrl: string | null;

  champNameForUrl: string | null;
  sectionChampId: string | null;
}

export class OneXBetPrematchHtmlParser {

  public parse(
    html: string
  ): OneXBetPrematchGame[] {

    const rawGames =
      this.extractRawGames(html);

	if (
  process.env.ONEXBET_PREMATCH_DEBUG === "1"
) {
  console.log(
    "[OneXBetPrematchParser] Objetos JSON encontrados:",
    rawGames.length
  );

  console.log(
    "[OneXBetPrematchParser] Claves del primer objeto:",
    Object.keys(rawGames[0] ?? {}).slice(0, 30)
  );
}

    const games =
      new Map<string, OneXBetPrematchGame>();

    for (const raw of rawGames) {

      const game =
        this.toPrematchGame(raw);

      if (!game) {
        continue;
      }

      games.set(game.id, game);
    }

    return [...games.values()].sort(
      (a, b) =>
        Date.parse(a.kickoffAt) -
        Date.parse(b.kickoffAt)
    );
  }

  /*
   * Extraer exclusivamente el array
   * de partidos de Deportes.
   *
   * No utilizamos el almacén Live.
   */
  private extractRawGames(
    html: string
  ): JsonRecord[] {

   const source = html
  .replace(/&quot;/gi, '"')
  .replace(/&#34;/gi, '"')
  .replace(/\\u0022/gi, '"')
  .replace(/\\"/g, '"');

    const pattern =
      /"([^"]*normalizedDataItems[^"]*dashboardStore-games)"\s*:\s*\[/g;

    const result: JsonRecord[] = [];

    for (
      const found of source.matchAll(pattern)
    ) {

      const key = found[1]
        .replace(/\\u002f/gi, "/")
        .replace(/\\\//g, "/");

      if (
        key !==
        "normalizedDataItems-betting/home/line/dashboardStore-games"
      ) {
        continue;
      }

      const arrayStart =
        (found.index ?? 0) +
        found[0].lastIndexOf("[");

      const jsonArray =
        this.extractBalancedArray(
          source,
          arrayStart
        );

      if (!jsonArray) {
        continue;
      }

      try {

        const parsed: unknown =
          JSON.parse(jsonArray);

        if (!Array.isArray(parsed)) {
          continue;
        }

        for (const item of parsed) {

          const record =
            this.asRecord(item);

          if (record) {
            result.push(record);
          }
        }

      } catch (error) {

        console.warn(
          "[OneXBetPrematchParser] Invalid games JSON",
          error
        );
      }
    }

    return result;
  }

  /*
   * Extraemos el array JSON completo
   * respetando strings y escapes.
   *
   * Esto evita mezclar campos de
   * encuentros diferentes.
   */
  private extractBalancedArray(
    source: string,
    start: number
  ): string | null {

    if (source[start] !== "[") {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (
      let index = start;
      index < source.length;
      index += 1
    ) {

      const char = source[index];

      if (inString) {

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "[") {
        depth += 1;
      }

      if (char === "]") {

        depth -= 1;

        if (depth === 0) {

          return source.slice(
            start,
            index + 1
          );
        }
      }
    }

    return null;
  }

  private toPrematchGame(
    raw: JsonRecord
  ): OneXBetPrematchGame | null {

    const sportId =
      this.asNumber(raw.sportId);

    // 1 = fútbol.
    if (
      sportId !== null &&
      sportId !== 1
    ) {
      return null;
    }

    const gameIdForUrl =
      this.asString(raw.gameIdForUrl);

    const gameNameForUrl =
      this.asString(raw.gameNameForUrl);

    const id =
      gameIdForUrl ??
      this.asString(raw.id) ??
      gameNameForUrl?.match(
        /^(\d+)-/
      )?.[1] ??
      null;

    const homeName =
      this.asString(raw.firstOpponentName);

    const awayName =
      this.asString(raw.secondOpponentName);


    const competitionName =
      this.asString(raw.champName);

    const kickoffAt =
      this.resolveKickoffAt(raw);

	/*
 * Descartar objetos auxiliares
 * y partidos sin equipos reales.
 *
 * No afecta al parser Live.
 */
if (raw.isDummy === true) {
  return null;
}

if (
  homeName?.trim().toLowerCase() === "home" &&
  awayName?.trim().toLowerCase() === "away"
) {
  return null;
}

    if (
      !id ||
      !homeName ||
      !awayName ||
      !competitionName ||
      !kickoffAt
    ) {
      return null;
    }

    return {
      id,

      championshipId:
        this.asString(raw.champId),

      competitionName,

      countryName:
        this.asString(raw.countryName) ??
        "World",

      homeId:
        this.asString(raw.firstOpponentId),

      homeName,

      awayId:
        this.asString(raw.secondOpponentId),

      awayName,

      kickoffAt,

      gameIdForUrl,

      gameNameForUrl,

      champNameForUrl:
        this.asString(raw.champNameForUrl),

      sectionChampId:
        this.asString(raw.sectionChampId),
    };
  }

  private resolveKickoffAt(
    raw: JsonRecord
  ): string | null {

    const candidates = [
      raw.startTimestamp,
      raw.startUnixTimestamp,
      raw.startTime,
      raw.dateStart,
    ];

    for (const candidate of candidates) {

      const numeric =
        this.asNumber(candidate);

      if (
        numeric === null ||
        numeric < 1_000_000_000
      ) {
        continue;
      }

      const milliseconds =
        numeric < 10_000_000_000
          ? numeric * 1000
          : numeric;

      const date =
        new Date(milliseconds);

      if (
        Number.isFinite(
          date.getTime()
        )
      ) {
        return date.toISOString();
      }
    }

    return null;
  }

  private asRecord(
    value: unknown
  ): JsonRecord | null {

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return null;
    }

    return value as JsonRecord;
  }

  private asString(
    value: unknown
  ): string | null {

    if (
      typeof value === "string"
    ) {
      const normalized = value.trim();

      return normalized || null;
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return String(value);
    }

    return null;
  }

  private asNumber(
    value: unknown
  ): number | null {

    if (
      typeof value !== "number" &&
      typeof value !== "string"
    ) {
      return null;
    }

    const numeric = Number(value);

    return Number.isFinite(numeric)
      ? numeric
      : null;
  }
}
