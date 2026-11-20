
import "dotenv/config";

import {
  FlashscoreClient,
} from "../src/modules/football/infrastructure/providers/flashscore/FlashscoreClient";

interface Match {
  id?: string;
  status?: string;
  start_time?: string;
  home?: { name?: string };
  away?: { name?: string };
}

interface Feed {
  competitions?: {
    competition?: {
      name?: string;
    };
    matches?: Match[];
  }[];
}

async function main(): Promise<void> {
  const date =
    process.argv[2] ?? "2026-11-19";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Fecha inválida");
  }

  const client = new FlashscoreClient();

  console.log("Fecha solicitada:", date);

  // Una sola petición HTTP.
  const data = await client.get<Feed>(
    "/matches",
    {
      sport: "football",
      date,
    }
  );

  const matches = (data.competitions ?? [])
    .flatMap(group =>
      (group.matches ?? []).map(match => ({
        ...match,
        competition:
          group.competition?.name ?? "",
      }))
    )
    .filter(match =>
      match.status === "scheduled" &&
      match.start_time
    );

  const byDay = new Map<string, number>();

  for (const match of matches) {
    const timestamp = Date.parse(
      match.start_time!
    );

    if (!Number.isFinite(timestamp)) {
      continue;
    }

    const parts = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "America/La_Paz",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(timestamp);

    const get = (type: string) =>
      parts.find(p => p.type === type)?.value;

    const day =
      `${get("year")}-${get("month")}-${get("day")}`;

    byDay.set(
      day,
      (byDay.get(day) ?? 0) + 1
    );
  }

  console.log(
    "Partidos programados:",
    matches.length
  );

  console.log(
    "Fechas encontradas:",
    [...byDay.entries()].sort()
  );

  console.log("\nEjemplos:");

  for (const match of matches.slice(0, 8)) {
    console.log({
      home: match.home?.name,
      away: match.away?.name,
      competition: match.competition,
      kickoffAt: match.start_time,
    });
  }
}

main().catch(error => {
  console.error(
    "[FlashscoreDateTest]",
    error
  );
  process.exitCode = 1;
});

