import "dotenv/config";

import {
  flashscoreUpcomingShared,
} from "../src/modules/football/infrastructure/providers/flashscore/flashscoreUpcomingShared";

import {
  GetUpcomingMatches,
} from "../src/modules/football/application/use-cases/GetUpcomingMatches";

function boliviaDate(
  iso: string
): string {
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));

  const get = (type: string) =>
    parts.find(p => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function main(): Promise<void> {
  const provider =
    flashscoreUpcomingShared;

  const useCase =
    new GetUpcomingMatches(provider);

  console.log(
    "\n========== FLASHscore UPCOMING =========="
  );

  const all =
    await provider.getUpcomingMatches();

  const now = Date.now();

  const future = all
    .filter(match => {
      const kickoff =
        Date.parse(match.kickoffAt);

      return (
        Number.isFinite(kickoff) &&
        kickoff > now &&
        match.status.short === "NS"
      );
    })
    .sort(
      (a, b) =>
        Date.parse(a.kickoffAt) -
        Date.parse(b.kickoffAt)
    );

  console.log(
    "Total recibidos:",
    all.length
  );

  console.log(
    "Partidos futuros:",
    future.length
  );

  console.log(
    "\n========== COBERTURA =========="
  );

  for (const hours of [24, 48, 168]) {
    const matches =
      await useCase.execute({
        hours,
        limit: 5000,
      });

    console.log(
      `Próximas ${hours} horas:`,
      matches.length
    );
  }

  console.log(
    "\n========== FECHAS DISPONIBLES =========="
  );

  const byDay =
    new Map<string, number>();

  for (const match of future) {
    const day =
      boliviaDate(match.kickoffAt);

    byDay.set(
      day,
      (byDay.get(day) ?? 0) + 1
    );
  }

  for (
    const [date, count]
    of [...byDay.entries()].sort(
      (a, b) =>
        a[0].localeCompare(b[0])
    )
  ) {
    console.log(
      `${date}: ${count} partidos`
    );
  }

  console.log(
    "\n========== PRIMER Y ÚLTIMO PARTIDO =========="
  );

  for (
    const match of [
      future[0],
      future[future.length - 1],
    ]
  ) {
    if (!match) continue;

    console.log({
      home: match.home.name,
      away: match.away.name,
      competition:
        match.competition.name,
      kickoffAt:
        match.kickoffAt,
    });
  }

  console.log(
    "\n========== EJEMPLOS =========="
  );

  for (const match of future.slice(0, 10)) {
    console.log({
      home: match.home.name,
      away: match.away.name,
      competition:
        match.competition.name,
      kickoffAt:
        match.kickoffAt,
    });
  }
}

main().catch(error => {
  console.error(
    "[UpcomingCalendar]",
    error
  );

  process.exitCode = 1;
});
