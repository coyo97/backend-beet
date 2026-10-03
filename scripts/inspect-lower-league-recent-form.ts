interface RecentMatch {
  matchId:
    string;

  result:
    "W" |
    "D" |
    "L";

  homeAway:
    "home" |
    "away";

  opponentName:
    string;

  goalsFor:
    number;

  goalsAgainst:
    number;

  score:
    string;

  href:
    string;

  title:
    string;
}

interface TeamTarget {
  name:
    string;

  url:
    string;
}

const teams:
  TeamTarget[] = [
    {
      name:
        "Guangdong Chenxing Juli",

      url:
        "https://lowerleaguearchive.com/en/clubs/71/",
    },

    {
      name:
        "Wuhan Lianzhen",

      url:
        "https://lowerleaguearchive.com/en/clubs/28/",
    },
  ];

function decodeHtml(
  value:
    string
): string {

  return value
    .replace(
      /&#39;/g,
      "'"
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&nbsp;/g,
      " "
    )
    .replace(
      /&#(\d+);/g,
      (
        _match,
        code:
          string
      ) =>
        String.fromCodePoint(
          Number(
            code
          )
        )
    )
    .trim();
}

function parseForm(
  html:
    string
): RecentMatch[] {

  /*
   * Ejemplo real:
   *
   * <a
   *   href="/en/matches/244/"
   *   class="fs-cell fs-L ..."
   *   title="Lost 1–2 vs Wuhan Lianzhen (H)"
   * >
   */
  const regex =
    /<a\s+[^>]*href="\/en\/matches\/(\d+)\/"[^>]*class="[^"]*\bfs-cell\b[^"]*\bfs-([WDL])\b[^"]*"[^>]*title="([^"]+)"[^>]*>/gi;

  const matches:
    RecentMatch[] =
    [];

  for (
    const match
    of html.matchAll(
      regex
    )
  ) {

    const matchId =
      match[1];

    const result =
      match[2] as
        "W" |
        "D" |
        "L";

    const title =
      decodeHtml(
        match[3]
      );

    /*
     * Ejemplos:
     *
     * Won 5–2 vs Sichuan 318 Double Dragon (H)
     * Drew 0–0 vs Sichuan 318 Double Dragon (A)
     * Lost 1–3 vs Shenzhen Jixiang (A)
     */
    const parsed =
      title.match(
        /^(?:Won|Drew|Lost)\s+(\d+)[–-](\d+)\s+vs\s+(.+)\s+\(([HA])\)$/i
      );

    if (!parsed) {
      console.warn(
        "Could not parse:",
        title
      );

      continue;
    }

    const goalsFor =
      Number(
        parsed[1]
      );

    const goalsAgainst =
      Number(
        parsed[2]
      );

    const opponentName =
      parsed[3]
        .trim();

    const homeAway =
      parsed[4] ===
        "H"
        ? "home"
        : "away";

    matches.push({
      matchId,

      result,

      homeAway,

      opponentName,

      goalsFor,

      goalsAgainst,

      score:
        `${goalsFor}-${goalsAgainst}`,

      href:
        `/en/matches/${matchId}/`,

      title,
    });

    /*
     * Es justamente la barra de forma
     * "últimos cinco".
     */
    if (
      matches.length ===
      5
    ) {
      break;
    }
  }

  return matches;
}

async function inspect(
  team:
    TeamTarget
): Promise<void> {

  const response =
    await fetch(
      team.url,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0",
        },

        signal:
          AbortSignal.timeout(
            15_000
          ),
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Lower League Archive HTTP ${response.status}`
    );
  }

  const html =
    await response.text();

  const matches =
    parseForm(
      html
    );

  console.log(
    "\n================================"
  );

  console.log(
    team.name
  );

  console.log(
    team.url
  );

  console.log(
    "LAST FIVE COUNT:",
    matches.length
  );

  console.log(
    "FORM:",
    matches.map(
      (
        item
      ) =>
        item.result
    )
  );

  for (
    const match
    of matches
  ) {
    console.log(
      "\nMATCH:",
      match
    );
  }
}

async function main():
  Promise<void> {

  for (
    const team
    of teams
  ) {
    await inspect(
      team
    );
  }
}

void main();
