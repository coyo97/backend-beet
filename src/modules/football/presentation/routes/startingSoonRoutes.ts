import {
  Router,
} from "express";

import {
  GetStartingSoonMatches,
} from "../../application/use-cases/GetStartingSoonMatches";

import {
  oneXBetLiveClient,
} from "../../footballModule";

import {
  OneXBetLiveCompetitionCatalog,
} from "../../infrastructure/providers/onexbet/OneXBetLiveCompetitionCatalog";

import {
  OneXBetLiveProvider,
} from "../../infrastructure/providers/onexbet/OneXBetLiveProvider";

import {
  OneXBetLiveHtmlParser,
} from "../../infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

import {
  searchOneXBetMatches,
  type OneXBetSearchItem,
} from "../../infrastructure/providers/onexbet/OneXBetMatchSearch";

import {
  FlashscoreMultiDayUpcomingProvider,
} from "../../infrastructure/providers/flashscore/FlashscoreMultiDayUpcomingProvider";

import {
  OneXBetPrematchClient,
} from "../../infrastructure/providers/onexbet/OneXBetPrematchClient";

import {
  GetUpcomingMatches,
} from "../../application/use-cases/GetUpcomingMatches";

import {
  flashscoreUpcomingShared,
} from "../../infrastructure/providers/flashscore/flashscoreUpcomingShared";

/*
 * Endpoint independiente.
 *
 * No modifica:
 *
 * - /football/live
 * - /radar/red-cards
 * - GetLiveMatches
 * - RedCardDetectedScheduler
 * - Notificaciones push
 */
export function createStartingSoonRouter():
  Router {

  const router =
    Router();

  const oneXBetPrematch =
  new OneXBetPrematchClient();

  const getStartingSoon =
    new GetStartingSoonMatches(
      flashscoreUpcomingShared
    );

const getUpcoming =
  new GetUpcomingMatches(
    new FlashscoreMultiDayUpcomingProvider()
  );
/*
 * Comparte el cliente HTTP Live existente.
 * No crea una nueva sesión ni una caché HTML.
 */
const oneXBetLiveSearch =
  new OneXBetLiveProvider(
    oneXBetLiveClient,
    new OneXBetLiveHtmlParser()
  );

  const oneXBetLiveCompetitionCatalog =
  new OneXBetLiveCompetitionCatalog([
    "67487-argentina-reserve-league",
    "1808063-brazil-campeonato-potiguar-2nd-division",
  ]);

  router.get(
    "/starting-soon",

    async (req, res) => {

      try {

        const country =
          typeof req.query.country ===
          "string"
            ? req.query.country.trim()
            : "";

        const matches =
          await getStartingSoon.execute();

        /*
         * Filtrar por país sin
         * realizar nuevas consultas.
         */
        const normalize =
          (value: string) =>
            value
              .normalize("NFD")
              .replace(
                /[\u0300-\u036f]/g,
                ""
              )
              .trim()
              .toLowerCase();

        const filtered =
          country
            ? matches.filter(
                match =>
                  normalize(
                    match.competition.country
                  ) === normalize(country)
              )
            : matches;

        return res.status(200).json({
          count: filtered.length,

          filters: {
            country: country || null,
          },

          matches: filtered,
        });

      } catch (error) {

        console.error(
          "[StartingSoon]",
          error
        );

        return res.status(502).json({
          message:
            "Could not retrieve starting soon matches",
        });
      }
    }
  );

  /*
 * Calendario de próximos partidos.
 *
 * Reutiliza Flashscore Upcoming compartido.
 * No modifica Starting Soon ni Live.
 */
router.get(
  "/upcoming",

  async (req, res) => {
    try {
      const parseInteger = (
        value: unknown,
        fallback: number,
        min: number,
        max: number
      ): number | null => {
        if (value === undefined) {
          return fallback;
        }

        if (
          typeof value !== "string" ||
          !/^\d+$/.test(value)
        ) {
          return null;
        }

        const number = Number(value);

        return (
          Number.isSafeInteger(number) &&
          number >= min &&
          number <= max
        )
          ? number
          : null;
      };

      const hours = parseInteger(
        req.query.hours,
        48,
        1,
        168
      );

      const limit = parseInteger(
        req.query.limit,
        1000,
        1,
        5000
      );

      if (hours === null || limit === null) {
        return res.status(400).json({
          message:
            "Invalid hours or limit",
        });
      }

      const matches =
        await getUpcoming.execute({
          hours,
          limit,
        });

      return res.status(200).json({
        count: matches.length,

        filters: {
          hours,
          limit,
        },

        matches,
      });

    } catch (error) {
      console.error(
        "[UpcomingCalendar]",
        error
      );

      return res.status(502).json({
        message:
          "Could not retrieve upcoming matches",
      });
    }
  }
);


/*
 * Catálogo de Radar Prematch.
 *
 * Usa el proveedor multifecha ya existente.
 * Filtra y pagina sin nuevas peticiones
 * individuales por partido.
 */
router.get("/upcoming/catalog", async (req, res) => {
  try {
    const parseNumber = (
      value: unknown,
      fallback: number,
      max: number
    ): number | null => {
      if (value === undefined) return fallback;

      if (
        typeof value !== "string" ||
        !/^[0-9]+$/.test(value)
      ) {
        return null;
      }

      const number = Number(value);

      return Number.isSafeInteger(number) &&
        number >= 1 &&
        number <= max
        ? number
        : null;
    };

    const page = parseNumber(
      req.query.page, 1, 1000
    );

    const limit = parseNumber(
      req.query.limit, 50, 100
    );

    if (page === null || limit === null) {
      return res.status(400).json({
        message: "Invalid page or limit",
      });
    }

    const day =
      typeof req.query.day === "string"
        ? req.query.day.trim()
        : "";

    if (day) {
      const parsed = new Date(
        `${day}T00:00:00.000Z`
      );

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== day
      ) {
        return res.status(400).json({
          message: "Invalid day. Use YYYY-MM-DD",
        });
      }
    }

    const q =
      typeof req.query.q === "string"
        ? req.query.q.trim().slice(0, 100)
        : "";

    const country =
      typeof req.query.country === "string"
        ? req.query.country.trim().slice(0, 100)
        : "";

    const competition =
      typeof req.query.competition === "string"
        ? req.query.competition.trim().slice(0, 100)
        : "";

    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const dateFormatter =
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/La_Paz",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

    const localDay = (iso: string) => {
      const parts = dateFormatter.formatToParts(
        new Date(iso)
      );

      const value = (type: string) =>
        parts.find(part => part.type === type)
          ?.value ?? "";

      return (
        `${value("year")}-` +
        `${value("month")}-` +
        `${value("day")}`
      );
    };

    /*
     * Recupera el calendario completo
     * desde la caché multifecha.
     */
    const all = await getUpcoming.execute({
      hours: 168,
      limit: 5000,
    });

    /*
     * Filtrar por equipo, país o liga.
     */
    const filtered = all.filter(match => {
      const searchable = normalize([
        match.home.name,
        match.away.name,
        match.competition.name,
      ].join(" "));

      if (q && !searchable.includes(normalize(q))) {
        return false;
      }

      if (
        country &&
        normalize(match.competition.country) !==
          normalize(country)
      ) {
        return false;
      }

      if (
        competition &&
        !normalize(match.competition.name)
          .includes(normalize(competition))
      ) {
        return false;
      }

      return true;
    });

    /*
     * Contadores por fecha antes de
     * aplicar el filtro de día.
     */
    const counts = new Map<string, number>();

    for (const match of filtered) {
      const date = localDay(match.kickoffAt);

      counts.set(
        date,
        (counts.get(date) ?? 0) + 1
      );
    }

    const availableDays = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date,
        count,
      }));

    const selected = day
      ? filtered.filter(
          match => localDay(match.kickoffAt) === day
        )
      : filtered;

    const total = selected.length;

    const offset = (page - 1) * limit;

    const matches = selected.slice(
      offset,
      offset + limit
    );

    return res.status(200).json({
      total,
      count: matches.length,
      page,
      limit,
      pages: Math.ceil(total / limit),
      timezone: "America/La_Paz",
      filters: {
        day: day || null,
        q: q || null,
        country: country || null,
        competition: competition || null,
      },
      availableDays,
      matches,
    });

  } catch (error) {
    console.error("[UpcomingCatalog]", error);

    return res.status(502).json({
      message:
        "Could not retrieve upcoming catalog",
    });
  }
});



/*
 * Resolver un partido de Football Radar
 * dentro del catálogo prematch conocido
 * de 1xBet.
 *
 * Búsqueda bajo demanda.
 * Nunca se ejecuta desde un scheduler.
 */
router.get("/onexbet/resolve", async (req, res) => {
  const home =
    typeof req.query.home === "string"
      ? req.query.home.trim()
      : "";

  const away =
    typeof req.query.away === "string"
      ? req.query.away.trim()
      : "";

  const kickoffAt =
    typeof req.query.kickoffAt === "string"
      ? req.query.kickoffAt.trim()
      : "";

  const kickoff = Date.parse(kickoffAt);

  if (
    !home ||
    !away ||
    home.length > 120 ||
    away.length > 120 ||
    !Number.isFinite(kickoff)
  ) {
    return res.status(400).json({
      message: "Invalid match information",
    });
  }

  /*
   * Solo las competiciones que
   * verificamos realmente.
   *
   * Después las reemplazaremos con
   * un catálogo dinámico.
   */
  const competitionSlugs = [
    "1268397-brazil-campeonato-brasileiro-serie-a",
    "34275-uefa-champions-league-women",
  ];

  const normalizeTeam = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(
        /\b(women|woman|w|femenina|femenino)\b/g,
        "women"
      )
      .replace(
        /\b(fc|cf|sc|club|clube|esporte|sport|de|do|da)\b/g,
        " "
      )
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const results = await Promise.allSettled(
    competitionSlugs.map(slug =>
      oneXBetPrematch.getCompetition(slug)
    )
  );

  const matched: {
    id: string;
    home: string;
    away: string;
    kickoffAt: string;
    url: string;
  }[] = [];

  let successfulCompetitions = 0;

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.warn(
        "[OneXBetResolve] Competition unavailable",
        result.reason
      );
      continue;
    }

    successfulCompetitions++;

    for (const game of result.value.games) {
      const gameKickoff =
        Date.parse(game.kickoffAt);

      /*
       * Máximo 45 minutos de diferencia.
       * Evita confundir partidos de
       * fechas distintas.
       */
      if (
        !Number.isFinite(gameKickoff) ||
        Math.abs(gameKickoff - kickoff) >
          45 * 60 * 1000
      ) {
        continue;
      }

      /*
       * Coincidencia conservadora:
       * mismo local y mismo visitante.
       *
       * No invertimos equipos ni usamos
       * coincidencias ambiguas.
       */
      if (
        normalizeTeam(home) !==
          normalizeTeam(game.homeName) ||
        normalizeTeam(away) !==
          normalizeTeam(game.awayName)
      ) {
        continue;
      }

      const url =
        oneXBetPrematch.buildMatchUrl(game);

      if (!url) continue;

      matched.push({
        id: game.id,
        home: game.homeName,
        away: game.awayName,
        kickoffAt: game.kickoffAt,
        url,
      });
    }
  }

  if (matched.length === 1) {
    return res.status(200).json({
      found: true,
      match: matched[0],
      searchedCompetitions:
        successfulCompetitions,
      partial:
        successfulCompetitions <
        competitionSlugs.length,
    });
  }

  return res.status(200).json({
    found: false,
    match: null,
    reason:
      matched.length > 1
        ? "ambiguous"
        : successfulCompetitions === 0
          ? "unavailable"
          : "not_found",
    searchedCompetitions:
      successfulCompetitions,
    partial:
      successfulCompetitions <
      competitionSlugs.length,
  });
});


/*
 * Búsqueda flexible en 1xBet.
 *
 * - Directos
 * - Competiciones Prematch conocidas
 * - Coincidencias por ambos equipos
 * - Coincidencias por un equipo
 * - Encuentros de otras fechas
 *
 * Devuelve candidatos; no abre
 * automáticamente ningún partido.
 */
router.get("/onexbet/search", async (req, res) => {
  const read = (value: unknown): string =>
    typeof value === "string"
      ? value.trim()
      : "";

  const home = read(req.query.home);
  const away = read(req.query.away);
  const kickoffAt = read(req.query.kickoffAt);

  const preferredSection =
    read(req.query.preferredSection) || "live";

  if (
    (!home && !away) ||
    home.length > 120 ||
    away.length > 120 ||
    (kickoffAt &&
      !Number.isFinite(Date.parse(kickoffAt))) ||
    !["live", "prematch"].includes(
      preferredSection
    )
  ) {
    return res.status(400).json({
      message: "Invalid search parameters",
    });
  }

  const competitionSlugs = [
    "1268397-brazil-campeonato-brasileiro-serie-a",
    "34275-uefa-champions-league-women",
  ];

  /*
   * Ambas consultas comienzan juntas.
   *
   * Live reutiliza oneXBetLiveClient,
   * incluyendo su caché e inflight.
   */
  const [liveResults, prematchResults] =
    await Promise.all([
      Promise.allSettled([
        oneXBetLiveSearch.getLiveMatches(),
      ]),
      Promise.allSettled(
        competitionSlugs.map(slug =>
          oneXBetPrematch.getCompetition(slug)
        )
      ),
    ]);

  const items: OneXBetSearchItem[] = [];

  let liveAvailable = false;
  let liveGames = 0;
  let prematchCompetitionsChecked = 0;

  /*
   * DIRECTOS
   */
  const liveResult = liveResults[0];

  if (liveResult.status === "fulfilled") {
    liveAvailable = true;
    liveGames = liveResult.value.length;

    for (const match of liveResult.value) {
      const source = match.sources.find(
        item => item.provider === "bookmaker"
      );

      const url = (
        source as
          | (typeof source & { url?: string })
          | undefined
      )?.url;

      if (!source || !url) {
        continue;
      }

      items.push({
        id: String(source.externalId),
        home: match.home.name,
        away: match.away.name,
        competition: match.competition.name,
        kickoffAt: match.kickoffAt,
        section: "live",
        url,
      });
    }
  } else {
    console.warn(
      "[OneXBetSearch] Live unavailable",
      liveResult.reason
    );
  }


/*
 * Ampliar Directos con páginas
 * específicas de competiciones.
 *
 * Independiente del proveedor Live
 * principal y de sus schedulers.
 */
const competitionSnapshot =
  await oneXBetLiveCompetitionCatalog.getAll();

for (const match of competitionSnapshot.matches) {
  const source = match.sources.find(
    item => item.provider === "bookmaker"
  );

  const url = (
    source as
      | (typeof source & { url?: string })
      | undefined
  )?.url;

  if (!source || !url) {
    continue;
  }

  items.push({
    id: String(source.externalId),
    home: match.home.name,
    away: match.away.name,
    competition: match.competition.name,
    kickoffAt: match.kickoffAt,
    section: "live",
    url,
  });
}

/*
 * Recalcular la cobertura Live
 * sin contar IDs duplicados.
 */
liveAvailable =
  liveAvailable ||
  competitionSnapshot.succeeded > 0;

liveGames = new Set(
  items
    .filter(item => item.section === "live")
    .map(item => item.id)
).size;

console.log(
  "[OneXBetSearch]",
  `liveGames=${liveGames}`,
  `competitionPages=${competitionSnapshot.succeeded}`,
  `failed=${competitionSnapshot.failed.length}`
);


  /*
   * PREMATCH
   */
  for (let index = 0;
    index < prematchResults.length;
    index++
  ) {
    const result = prematchResults[index];

    if (result.status !== "fulfilled") {
      console.warn(
        "[OneXBetSearch] Prematch unavailable",
        competitionSlugs[index],
        result.reason
      );
      continue;
    }

    prematchCompetitionsChecked++;

    for (const game of result.value.games) {
      const url =
        oneXBetPrematch.buildMatchUrl(game);

      if (!url) {
        continue;
      }

      items.push({
        id: String(game.id),
        home: game.homeName,
        away: game.awayName,
        competition: game.competitionName,
        kickoffAt: game.kickoffAt,
        section: "prematch",
        url,
      });
    }
  }

  if (
    !liveAvailable &&
    prematchCompetitionsChecked === 0
  ) {
    return res.status(502).json({
      message:
        "OneXBet search sources unavailable",
    });
  }

  /*
   * Una única comparación sobre
   * todos los datos recopilados.
   *
   * No realiza tres peticiones por
   * local, visitante y partido.
   */
  const candidates = searchOneXBetMatches(
    {
      home,
      away,
      kickoffAt: kickoffAt || null,
      preferredSection:
        preferredSection as "live" | "prematch",
    },
    items,
    30
  );

  return res.status(200).json({
    count: candidates.length,
    candidates,

    coverage: {
      liveAvailable,
      liveGames,
      prematchCompetitionsChecked,
      prematchCompetitionsRequested:
        competitionSlugs.length,
    },

    /*
     * La búsqueda todavía no cubre
     * todas las competiciones de 1xBet.
     */
    limitedCoverage: true,

    partial:
      !liveAvailable ||
      prematchCompetitionsChecked <
        competitionSlugs.length,
  });
});


  return router;
}

export const startingSoonRouter =
  createStartingSoonRouter();
