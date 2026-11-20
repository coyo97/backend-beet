
export type OneXBetSection =
  "live" | "prematch";

export type OneXBetMatchType =
  | "same_match"
  | "same_teams_other_date"
  | "same_teams_unverified"
  | "home_team"
  | "away_team";

export interface OneXBetSearchItem {
  id: string;
  home: string;
  away: string;
  competition: string;
  kickoffAt: string | null;
  section: OneXBetSection;
  url: string;
}

export interface OneXBetSearchQuery {
  home?: string;
  away?: string;
  kickoffAt?: string | null;
  preferredSection?: OneXBetSection;
}

export interface OneXBetSearchCandidate
  extends OneXBetSearchItem {
  matchType: OneXBetMatchType;
  score: number;
}

function clean(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface TeamName {
  tokens: string[];
  category: string;
}

/*
 * Normaliza nombres sin confundir:
 *
 * Belgrano 2 = Belgrano II
 *
 * Pero:
 * Barcelona != Barcelona W
 * Barcelona != Barcelona U19
 */
function parseTeam(value: string): TeamName {
  let name = clean(value);

  let category = "senior";

  const youth = name.match(
    /\b(?:u|sub)\s?(\d{2})\b/
  );

  if (youth) {
    category = `u${youth[1]}`;

    name = name.replace(
      /\b(?:u|sub)\s?\d{2}\b/g,
      " "
    );
  } else if (
    /\b(?:women|woman|femenina|femenino|fem|w)$/.test(
      name
    )
  ) {
    category = "women";

    name = name.replace(
      /\b(?:women|woman|femenina|femenino|fem|w)$/,
      " "
    );
  } else if (
    /\b(?:ii|ll|2|reserve|reserves|reserva|reservas)$/.test(
      name
    )
  ) {
    category = "reserve";

    name = name.replace(
      /\b(?:ii|ll|2|reserve|reserves|reserva|reservas)$/,
      " "
    );
  } else if (/\bb$/.test(name)) {
    category = "b";

    name = name.replace(/\bb$/, " ");
  }

  const ignored = new Set([
    "fc", "cf", "sc", "ac", "ca",
    "cd", "afc", "club", "clube",
    "de", "del", "da", "do",
    "the", "el", "la",
  ]);

  const tokens = name
    .split(/\s+/)
    .filter(
      token =>
        token.length > 0 &&
        !ignored.has(token)
    );

  return {
    tokens: [...new Set(tokens)],
    category,
  };
}

function similarity(
  searched: string,
  candidate: string
): number {
  if (!searched.trim()) return 0;

  const a = parseTeam(searched);
  const b = parseTeam(candidate);

  if (!a.tokens.length || !b.tokens.length) {
    return 0;
  }

  const aSet = new Set(a.tokens);
  const bSet = new Set(b.tokens);

  const shared = [...aSet].filter(
    token => bSet.has(token)
  ).length;

  if (!shared) return 0;

  /*
   * Combinamos cobertura de la búsqueda
   * y semejanza global.
   *
   * "Independiente" podrá coincidir con
   * "CA Independiente Avellaneda".
   */
  const coverage =
    shared / Math.min(
      aSet.size,
      bSet.size
    );

  const global =
    shared / Math.max(
      aSet.size,
      bSet.size
    );

  return (
    coverage * 0.78 +
    global * 0.22
  );
}

function incompatibleCategory(
  searched: string,
  candidate: string
): boolean {
  if (!searched.trim()) return false;

  return (
    parseTeam(searched).category !==
    parseTeam(candidate).category
  );
}

function validUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "1xbet.com" ||
        url.hostname.endsWith(".1xbet.com")
      ) &&
      /^\/(?:es|en)\/(?:live|line)\/football\/.+/.test(
        url.pathname
      )
    );
  } catch {
    return false;
  }
}

export function searchOneXBetMatches(
  query: OneXBetSearchQuery,
  items: OneXBetSearchItem[],
  limit = 30
): OneXBetSearchCandidate[] {
  const searchHome = query.home?.trim() ?? "";
  const searchAway = query.away?.trim() ?? "";

  if (!searchHome && !searchAway) {
    return [];
  }

  const queryTime = query.kickoffAt
    ? Date.parse(query.kickoffAt)
    : NaN;

  const results: OneXBetSearchCandidate[] = [];

  for (const item of items) {
    if (!validUrl(item.url)) continue;

    /*
     * Comparar los tres escenarios:
     * local, visitante y ambos equipos.
     */
    const directHome = similarity(
      searchHome,
      item.home
    );

    const directAway = similarity(
      searchAway,
      item.away
    );

    const homeAny = Math.max(
      directHome,
      similarity(searchHome, item.away)
    );

    const awayAny = Math.max(
      directAway,
      similarity(searchAway, item.home)
    );

    if (
      homeAny < 0.65 &&
      awayAny < 0.65
    ) {
      continue;
    }

    const categoryConflict =
      incompatibleCategory(
        searchHome,
        item.home
      ) ||
      incompatibleCategory(
        searchAway,
        item.away
      );

    const itemTime = item.kickoffAt
      ? Date.parse(item.kickoffAt)
      : NaN;

    const timeDifference =
      Number.isFinite(queryTime) &&
      Number.isFinite(itemTime)
        ? Math.abs(itemTime - queryTime)
        : null;

    const bothTeams =
      !!searchHome &&
      !!searchAway &&
      directHome >= 0.72 &&
      directAway >= 0.72 &&
      !categoryConflict;

    let matchType: OneXBetMatchType;
    let score: number;

    if (bothTeams) {
      if (timeDifference === null) {
        matchType =
          "same_teams_unverified";
        score = 75;
      } else if (
        timeDifference <=
        120 * 60 * 1000
      ) {
        matchType = "same_match";
        score = 100;
      } else {
        matchType =
          "same_teams_other_date";
        score = 80;
      }

      score += (
        directHome + directAway
      ) * 10;

    } else if (
      homeAny >= awayAny
    ) {
      matchType = "home_team";
      score = 40 + homeAny * 20;

    } else {
      matchType = "away_team";
      score = 38 + awayAny * 20;
    }

    if (categoryConflict) {
      score -= 20;
    }

    if (
      query.preferredSection ===
      item.section
    ) {
      score += 8;
    }

    results.push({
      ...item,
      matchType,
      score: Math.round(score),
    });
  }

  /*
   * Evitar mostrar el mismo enlace
   * varias veces.
   */
  const unique =
    new Map<string, OneXBetSearchCandidate>();

  for (const item of results) {
    const previous = unique.get(item.url);

    if (
      !previous ||
      item.score > previous.score
    ) {
      unique.set(item.url, item);
    }
  }

  return [...unique.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.home.localeCompare(b.home) ||
        a.away.localeCompare(b.away)
    )
    .slice(0, Math.max(1, Math.min(50, limit)));
}

