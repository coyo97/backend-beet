interface TeamTarget {
  id:
    string;

  name:
    string;
}

interface RawLastFive {
  href:
    string;

  id:
    string;

  awayLogoUrl:
    string;

  homeLogoUrl:
    string;

  label:
    string;

  tone:
    string;
}

const BASE_URL =
  "https://m.elbotola.com";

const teams:
  TeamTarget[] =
[
  {
    id:
      "8yomo4h0nejq0j6",

    name:
      "Wuhan Lianzhen",
  },

  {
    id:
      "pxwrxlhvw1vryk0",

    name:
      "Guangdong Chenxingjuli",
  },
];

function extractTeamIdFromLogo(
  value:
    string
): string | null {

  const match =
    value.match(
      /\/logos\/([A-Za-z0-9]+)\.(?:png|webp|jpg|jpeg)/
    );

  return (
    match?.[1] ??
    null
  );
}

function extractLastFive(
  html:
    string
): RawLastFive[] {

  /*
   * Los datos están dentro de
   * self.__next_f.push() escapados.
   */
  const normalized =
    html
      .replace(
        /\\"/g,
        '"'
      )
      .replace(
        /\\u002F/g,
        "/"
      );

  const match =
    normalized.match(
      /"lastFive":(\[[\s\S]*?\]),"lastFiveTitle"/
    );

  if (!match) {
    return [];
  }

  try {
    return JSON.parse(
      match[1]
    ) as RawLastFive[];
  } catch (error) {

    console.error(
      "Could not parse lastFive:",
      error
    );

    return [];
  }
}

function decodeHtml(
  value:
    string
): string {

  return value
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&#39;/g,
      "'"
    )
    .replace(
      /&#x27;/gi,
      "'"
    )
    .replace(
      /&nbsp;/g,
      " "
    );
}

function extractTitle(
  html:
    string
): string | null {

  const match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  if (!match) {
    return null;
  }

  return decodeHtml(
    match[1]
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function parseScore(
  value:
    string
): {
  home:
    number;

  away:
    number;
} | null {

  const match =
    value.match(
      /(\d+)\s*[-–]\s*(\d+)/
    );

  if (!match) {
    return null;
  }

  return {
    home:
      Number(
        match[1]
      ),

    away:
      Number(
        match[2]
      ),
  };
}

function resultFromScore(
  goalsFor:
    number,

  goalsAgainst:
    number
):
  "W" |
  "D" |
  "L" {

  if (
    goalsFor >
    goalsAgainst
  ) {
    return "W";
  }

  if (
    goalsFor <
    goalsAgainst
  ) {
    return "L";
  }

  return "D";
}

function namesFromTitle(
  title:
    string | null,

  score:
    string
): {
  home:
    string | null;

  away:
    string | null;
} {

  if (!title) {
    return {
      home:
        null,

      away:
        null,
    };
  }

  const marker =
    ` ${score} `;

  const index =
    title.indexOf(
      marker
    );

  if (
    index ===
    -1
  ) {
    return {
      home:
        null,

      away:
        null,
    };
  }

  const home =
    title
      .slice(
        0,
        index
      )
      .trim();

  const rest =
    title
      .slice(
        index +
        marker.length
      );

  const away =
    rest
      .split(
        /\s+\|\s+|\s+-\s+Elbotola/i
      )[0]
      .trim();

  return {
    home,
    away,
  };
}

async function fetchHtml(
  url:
    string
): Promise<string> {

  const response =
    await fetch(
      url,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

          accept:
            "text/html,application/xhtml+xml",

          "accept-language":
            "en-US,en;q=0.9",
        },

        signal:
          AbortSignal.timeout(
            15_000
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `${url} HTTP ${response.status}`
    );
  }

  return response.text();
}

async function inspectTeam(
  team:
    TeamTarget
): Promise<void> {

  const url =
    `${BASE_URL}/en/analytics/team/${team.id}/`;

  console.log(
    "\n================================"
  );

  console.log(
    team.name
  );

  console.log(
    "ID:",
    team.id
  );

  console.log(
    "URL:",
    url
  );

  const html =
    await fetchHtml(
      url
    );

  const lastFive =
    extractLastFive(
      html
    );

  console.log(
    "LAST FIVE COUNT:",
    lastFive.length
  );

  for (
    const item
    of lastFive
  ) {

    const homeId =
      extractTeamIdFromLogo(
        item.homeLogoUrl
      );

    const awayId =
      extractTeamIdFromLogo(
        item.awayLogoUrl
      );

    const score =
      parseScore(
        item.label
      );

    const isHome =
      homeId ===
      team.id;

    const isAway =
      awayId ===
      team.id;

    const detailUrl =
      new URL(
        item.href,
        BASE_URL
      )
        .toString();

    const detailHtml =
      await fetchHtml(
        detailUrl
      );

    const title =
      extractTitle(
        detailHtml
      );

    const names =
      namesFromTitle(
        title,
        item.label
      );

    let goalsFor:
      number | null =
      null;

    let goalsAgainst:
      number | null =
      null;

    if (score) {

      if (isHome) {
        goalsFor =
          score.home;

        goalsAgainst =
          score.away;
      } else if (
        isAway
      ) {
        goalsFor =
          score.away;

        goalsAgainst =
          score.home;
      }
    }

    const result =
      goalsFor !==
        null &&
      goalsAgainst !==
        null
        ? resultFromScore(
            goalsFor,
            goalsAgainst
          )
        : null;

    const opponentName =
      isHome
        ? names.away
        : isAway
          ? names.home
          : null;

    const opponentId =
      isHome
        ? awayId
        : isAway
          ? homeId
          : null;

    console.log(
      "\nMATCH:",
      {
        matchId:
          item.id,

        result,

        homeAway:
          isHome
            ? "home"
            : isAway
              ? "away"
              : "unknown",

        opponentId,

        opponentName,

        goalsFor,

        goalsAgainst,

        score:
          item.label,

        tone:
          item.tone,

        href:
          item.href,

        title,
      }
    );
  }
}

async function main():
  Promise<void> {

  for (
    const team
    of teams
  ) {

    try {

      await inspectTeam(
        team
      );

    } catch (error) {

      console.error(
        "\nFAILED:",
        team.name,
        error
      );
    }
  }
}

void main();
