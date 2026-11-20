
import "dotenv/config";

import {
  OneXBetLiveClient,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

async function main(): Promise<void> {
  const url =
    process.env.ONEXBET_LIVE_URL ??
    "https://bol.1xbet.com/es/live/football";

  const client =
    new OneXBetLiveClient(url);

  const parser =
    new OneXBetLiveHtmlParser();

  const html =
    await client.getLiveHtml();

  const games =
    parser.parse(html);

  console.log("\n========== COBERTURA ==========");

  console.log("URL:", url);
  console.log("HTML bytes:", Buffer.byteLength(html));
  console.log("Partidos parseados:", games.length);

  const normalized =
    html
      .replace(/\\u002F/gi, "/")
      .replace(/\\u0022/gi, '"');

  const keys = [...new Set(
    [...normalized.matchAll(
      /normalizedDataItems-[a-zA-Z0-9/_-]+/g
    )].map(match => match[0])
  )];

  console.log("\n========== ALMACENES LIVE ==========");

  for (const key of keys.filter(
    value => value.includes("/live/")
  ).slice(0, 40)) {
    console.log(key);
  }

  console.log("\n========== COMPETICIONES ==========");

  const competitions = new Map<
    string,
    number
  >();

  for (const game of games) {
    const name = game.competitionName;

    competitions.set(
      name,
      (competitions.get(name) ?? 0) + 1
    );
  }

  for (const [name, count] of competitions) {
    console.log(count, name);
  }

  console.log("\n========== PARTIDOS ==========");

  for (const game of games) {
    console.log({
      home: game.homeName,
      away: game.awayName,
      competition: game.competitionName,
      championshipId: game.championshipId,
      id: game.id,
    });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

