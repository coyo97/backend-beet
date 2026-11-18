import "dotenv/config";

import {
  flashscoreUpcomingShared,
} from "../src/modules/football/infrastructure/providers/flashscore/flashscoreUpcomingShared";

import {
  GetStartingSoonMatches,
} from "../src/modules/football/application/use-cases/GetStartingSoonMatches";

async function main(): Promise<void> {

  const now = Date.now();

  console.log(
    "\n========== STARTING SOON DIAGNOSTIC =========="
  );

  console.log(
    "Hora UTC:",
    new Date(now).toISOString()
  );

  console.log(
    "Hora local:",
    new Date(now).toString()
  );

  /*
   * Una consulta al proveedor.
   *
   * La segunda llamada reutiliza
   * su caché compartida.
   *
   * No consulta incidentes.
   * No envía notificaciones.
   */
  const matches =
    await flashscoreUpcomingShared
      .getUpcomingMatches();

  const useCase =
    new GetStartingSoonMatches(
      flashscoreUpcomingShared
    );

  const startingSoon =
    await useCase.execute(now);

  const minutesUntil = (
    kickoffAt: string
  ): number =>
    (Date.parse(kickoffAt) - now) / 60_000;

  const valid =
    matches.filter(
      match =>
        Number.isFinite(
          Date.parse(match.kickoffAt)
        )
    );

  const countBetween = (
    from: number,
    to: number
  ): number =>
    valid.filter(match => {
      const minutes =
        minutesUntil(match.kickoffAt);

      return (
        minutes >= from &&
        minutes <= to
      );
    }).length;

  console.log(
    "\n--- RESUMEN ---"
  );

  console.log(
    "Total programados del proveedor:",
    matches.length
  );

  console.log(
    "Horarios válidos:",
    valid.length
  );

  console.log(
    "Próximos 15 minutos:",
    countBetween(0, 15)
  );

  console.log(
    "Entre 15 y 60 minutos:",
    countBetween(15, 60)
  );

  console.log(
    "Entre 60 y 180 minutos:",
    countBetween(60, 180)
  );

  console.log(
    "Entre 0 y 24 horas:",
    countBetween(0, 1440)
  );

  console.log(
    "Ventana de gracia (-10 a 0 min):",
    countBetween(-10, 0)
  );

  console.log(
    "Resultado GetStartingSoonMatches:",
    startingSoon.length
  );

  /*
   * Mostramos los encuentros
   * cronológicamente más cercanos
   * a la hora actual.
   */
  const nearest =
    [...valid]
      .sort(
        (a, b) =>
          Math.abs(
            minutesUntil(a.kickoffAt)
          ) -
          Math.abs(
            minutesUntil(b.kickoffAt)
          )
      )
      .slice(0, 15);

  console.log(
    "\n--- PARTIDOS MÁS CERCANOS ---"
  );

  nearest.forEach((match, index) => {

    console.log(
      JSON.stringify({
        number: index + 1,
        home: match.home.name,
        away: match.away.name,
        competition:
          match.competition.name,
        country:
          match.competition.country,
        kickoffAt:
          match.kickoffAt,
        minutesUntilKickoff:
          Math.round(
            minutesUntil(
              match.kickoffAt
            )
          ),
        status:
          match.status.short,
        sources:
          match.sources,
      }, null, 2)
    );
  });

  console.log(
    "\n========== FIN DEL DIAGNÓSTICO =========="
  );
}

main().catch(error => {
  console.error(
    "[StartingSoonDiagnostic] ERROR",
    error
  );

  process.exitCode = 1;
});
