import "dotenv/config";

import {
  OneXBetPrematchHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetPrematchHtmlParser";

async function main(): Promise<void> {
  const address = process.argv[2];

  if (!address) {
    throw new Error(
      "Indica la URL de una competición."
    );
  }

  const url = new URL(address);

  if (
    url.protocol !== "https:" ||
    !(
      url.hostname === "1xbet.com" ||
      url.hostname.endsWith(".1xbet.com")
    ) ||
    !url.pathname.startsWith(
      "/en/line/football/"
    )
  ) {
    throw new Error(
      "URL de competición no permitida"
    );
  }

  console.log(
    "\n========== COMPETICIÓN 1XBET =========="
  );

  console.log(
    "Consultando:",
    url.toString()
  );

  const response = await fetch(
    url,
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

        accept:
          "text/html",

        "accept-language":
          "en-US,en;q=0.9",
      },

      signal:
        AbortSignal.timeout(20_000),
    }
  );

  console.log("HTTP:", response.status);
  console.log("URL final:", response.url);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  const html = await response.text();

  console.log(
    "HTML bytes:",
    Buffer.byteLength(html)
  );

  const stores = [
    ...html.matchAll(
      /"([^"]*normalizedDataItems[^"]*)"\s*:\s*\[/g
    ),
  ].map(
    match =>
      match[1].replace(
        /\\u002f/gi,
        "/"
      )
  );

  console.log(
    "\nAlmacenes encontrados:"
  );

  for (const store of stores) {
    console.log("-", store);
  }

  const parser =
    new OneXBetPrematchHtmlParser();

  const games =
    parser.parse(html);

  console.log(
    "\nPartidos interpretados:",
    games.length
  );

  for (const game of games.slice(0, 30)) {
    console.log(
      JSON.stringify({
        id: game.id,
        home: game.homeName,
        away: game.awayName,
        competition:
          game.competitionName,
        kickoffAt:
          game.kickoffAt,
        championshipId:
          game.championshipId,
        champNameForUrl:
          game.champNameForUrl,
        gameNameForUrl:
          game.gameNameForUrl,
      })
    );
  }

  console.log(
    "\n========== FIN =========="
  );
}

main().catch(error => {
  console.error(
    "[OneXBetCompetition]",
    error
  );

  process.exitCode = 1;
});
