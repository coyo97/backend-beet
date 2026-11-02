
import type {
  LiveMatch,
  LiveTeam,
} from "../../../football/domain/entities/LiveMatch";

import type {
  GetUpcomingMatches,
} from "../../../football/application/use-cases/GetUpcomingMatches";


import {
  UpcomingLeagueScanPlanner,
} from "./UpcomingLeagueScanPlanner";


import {
  FlashscoreMatchContextClient,
  type FlashscoreStandingRow,
} from "../../../match-context/infrastructure/flashscore/FlashscoreMatchContextClient";

export interface UpcomingLeagueCandidate {
  match: LiveMatch;

  priority: "high" | "watch";
  leadingSide: "home" | "away";

  pointsGap: number;
  positionGap: number;
  ppgGap: number | null;

  homePosition: number;
  awayPosition: number;

  homePoints: number;
  awayPoints: number;
}

export interface UpcomingLeagueScanResult {
  totalUpcoming: number;
  totalLeagues: number;
  scannedLeagues: number;

  matchedMatches: number;
  missingMatches: number;

  standingsRequests: number;

  candidates: UpcomingLeagueCandidate[];
}

interface LeagueGroup {
  key: string;
  matches: LiveMatch[];
}

interface CachedTable {
  rows: FlashscoreStandingRow[];
  expiresAt: number;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isLeague(name: string): boolean {
  const included =
    /league|liga|ligue|serie|division|primera|bundesliga|oberliga|tercera/i;

  const excluded =
    /cup|copa|qualif|friendly|amistoso|playoff|champions|confederation/i;

  return (
    included.test(name) &&
    !excluded.test(name)
  );
}

function findTeam(
  rows: FlashscoreStandingRow[],
  team: LiveTeam
): FlashscoreStandingRow | null {

  const byId = team.id
    ? rows.filter(
        row =>
          row.team.id !== null &&
          String(row.team.id) ===
            String(team.id)
      )
    : [];

  if (byId.length === 1) {
    return byId[0];
  }

  if (byId.length > 1) {
    return null;
  }

  const byName =
    rows.filter(
      row =>
        normalize(row.team.name) ===
        normalize(team.name)
    );

  return byName.length === 1
    ? byName[0]
    : null;
}

function groupKey(
  match: LiveMatch
): string {

  /*
   * Evita mezclar grupos cuando
   * el proveedor informa una
   * zona o grupo explícito.
   */
  const pool =
    match.competition.round
      ?.match(
        /\b(?:group|grupo|zone|zona)\s+[a-z0-9-]+/i
      )?.[0] ?? "";

  return [
    normalize(match.competition.country),
    match.competition.id ?? "",
    normalize(match.competition.name),
    match.competition.season ?? "",
    normalize(pool),
  ].join("::");
}

function compare(
  match: LiveMatch,
  rows: FlashscoreStandingRow[]
): UpcomingLeagueCandidate | null {

  const home =
    findTeam(rows, match.home);

  const away =
    findTeam(rows, match.away);

  if (!home || !away || home === away) {
    return null;
  }

  if (
    home.points === null ||
    away.points === null ||
    !Number.isFinite(home.points) ||
    !Number.isFinite(away.points) ||
    home.points < 0 ||
    away.points < 0 ||
    !Number.isInteger(home.rank) ||
    !Number.isInteger(away.rank) ||
    home.rank < 1 ||
    away.rank < 1 ||
    home.points === away.points
  ) {
    return null;
  }

  const leadingSide =
    home.points > away.points
      ? "home" as const
      : "away" as const;

  const leader =
    leadingSide === "home"
      ? home
      : away;

  const opponent =
    leadingSide === "home"
      ? away
      : home;

  if (leader.rank >= opponent.rank) {
    return null;
  }

  const pointsGap =
    leader.points! -
    opponent.points!;

  const positionGap =
    opponent.rank -
    leader.rank;

  if (
    pointsGap < 10 ||
    positionGap < 3
  ) {
    return null;
  }

  const playedA =
    leader.matches_played;

  const playedB =
    opponent.matches_played;

  const hasPlayed =
    typeof playedA === "number" &&
    typeof playedB === "number" &&
    playedA > 0 &&
    playedB > 0;

  const ppgGap = hasPlayed
    ? leader.points! / playedA -
      opponent.points! / playedB
    : null;

  const playedGap = hasPlayed
    ? Math.abs(playedA - playedB)
    : null;

  /*
   * Si el supuesto líder tiene
   * peor PPG, no seleccionarlo.
   */
  if (
    ppgGap !== null &&
    ppgGap < -0.05
  ) {
    return null;
  }

  /*
   * Diferencia por calendarios
   * desequilibrados.
   */
  if (
    playedGap !== null &&
    playedGap > 2 &&
    (
      ppgGap === null ||
      ppgGap < 0.15
    )
  ) {
    return null;
  }

  const high =
    pointsGap >= 15 &&
    positionGap >= 5 &&
    ppgGap !== null &&
    ppgGap >= 0.15 &&
    playedGap !== null &&
    playedGap <= 2;

  return {
    match,

    priority:
      high ? "high" : "watch",

    leadingSide,

    pointsGap,
    positionGap,

    ppgGap:
      ppgGap === null
        ? null
        : Number(ppgGap.toFixed(2)),

    homePosition: home.rank,
    awayPosition: away.rank,

    homePoints: home.points!,
    awayPoints: away.points!,
  };
}


export class UpcomingLeagueCandidateScanner {

  /*
   * ==========================================
   * PLANIFICADOR INTELIGENTE
   * ==========================================
   *
   * Selecciona:
   *
   * - Ligas con encuentros cercanos a 60 min.
   * - Ligas con encuentros cercanos a 24 h.
   * - Otras ligas mediante rotación mundial.
   *
   * Conserva el cursor y los cooldowns
   * entre ejecuciones del scheduler.
   */
  private readonly planner =
    new UpcomingLeagueScanPlanner();

  /*
   * ==========================================
   * CACHÉ DE CLASIFICACIONES
   * ==========================================
   */
  private readonly tableCache =
    new Map<string, CachedTable>();

  /*
   * Clasificaciones válidas:
   * reutilizar durante 30 minutos.
   */
  private readonly ttlMs =
    30 * 60 * 1000;

  /*
   * Clasificaciones no disponibles:
   * reintentar después de 2 minutos.
   */
  private readonly negativeTtlMs =
    2 * 60 * 1000;

  constructor(
    private readonly upcoming:
      GetUpcomingMatches,

    private readonly contextClient =
      new FlashscoreMatchContextClient()
  ) {}

  public async execute(
    options: {
      hours?: number;
      maxLeagues?: number;
    } = {}
  ): Promise<UpcomingLeagueScanResult> {

    /*
     * ==========================================
     * 1. OBTENER PARTIDOS FUTUROS
     * ==========================================
     */
    const matches =
      await this.upcoming.execute({
        hours: options.hours ?? 48,
        limit: 5000,
      });

    /*
     * ==========================================
     * 2. AGRUPAR PARTIDOS POR LIGA
     * ==========================================
     */
    const groups =
      new Map<string, LeagueGroup>();

    for (const match of matches) {

      if (
        !isLeague(
          match.competition.name
        )
      ) {
        continue;
      }

      if (
        !match.sources.some(
          source =>
            source.provider ===
              "flashscore"
        )
      ) {
        continue;
      }

      const key =
        groupKey(match);

      const group =
        groups.get(key) ?? {
          key,
          matches: [],
        };

      group.matches.push(match);

      groups.set(
        key,
        group
      );
    }

    /*
     * ==========================================
     * 3. ORDENAR LIGAS
     * ==========================================
     *
     * Cada liga queda ordenada
     * según su primer encuentro.
     */
    const leagues =
      [...groups.values()]
        .sort(
          (a, b) =>
            Date.parse(
              a.matches[0].kickoffAt
            ) -
            Date.parse(
              b.matches[0].kickoffAt
            )
        );

    /*
     * ==========================================
     * 4. SELECCIÓN INTELIGENTE
     * ==========================================
     *
     * Sustituye la rotación anterior
     * basada en this.cursor.
     *
     * El planificador selecciona
     * hasta cinco ligas:
     *
     * - hasta dos prioritarias
     * - restantes por rotación mundial
     *
     * También respeta cooldowns.
     */
    const selected =
      this.planner.select(
        leagues,
        options.maxLeagues ?? 5
      );

    /*
     * ==========================================
     * 5. RESULTADOS
     * ==========================================
     */
    const candidates:
      UpcomingLeagueCandidate[] = [];

    let matchedMatches = 0;
    let missingMatches = 0;
    let standingsRequests = 0;

    /*
     * ==========================================
     * 6. ANALIZAR LIGAS SELECCIONADAS
     * ==========================================
     */
    for (const league of selected) {

      const first =
        league.matches[0];

      const source =
        first.sources.find(
          item =>
            item.provider ===
              "flashscore"
        );

      if (!source) {

        /*
         * Permitir reintento.
         */
        this.planner.markCompleted(
          league.key,
          false
        );

        continue;
      }

      let rows:
        FlashscoreStandingRow[];

      /*
       * ========================================
       * 7. REUTILIZAR CACHÉ
       * ========================================
       */
      const cached =
        this.tableCache.get(
          league.key
        );

      if (
        cached &&
        cached.expiresAt >
          Date.now()
      ) {

        rows = cached.rows;

      } else {

        /*
         * Solo contamos consultas
         * realizadas realmente.
         */
        standingsRequests++;

        try {

          const standings =
            await this.contextClient
              .getStandings(
                source.externalId
              );

          rows =
            standings?.standings ?? [];

          /*
           * Guardar tabla en caché.
           */
          this.tableCache.set(
            league.key,
            {
              rows,

              expiresAt:
                Date.now() +
                (
                  rows.length > 0
                    ? this.ttlMs
                    : this.negativeTtlMs
                ),
            }
          );

        } catch (error) {

          console.warn(
            "[UpcomingScanner] standings failed",
            league.key,
            error instanceof Error
              ? error.message
              : error
          );

          rows = [];

          /*
           * Fallo temporal:
           * no consultar otra vez
           * inmediatamente.
           */
          this.tableCache.set(
            league.key,
            {
              rows,

              expiresAt:
                Date.now() +
                this.negativeTtlMs,
            }
          );
        }
      }

      /*
       * ========================================
       * 8. COMPARAR ENFRENTAMIENTOS
       * ========================================
       *
       * Contamos cuántos partidos
       * tienen ambos equipos
       * correctamente localizados
       * en la clasificación.
       */
      let matchedPairs = 0;

      for (
        const match
        of league.matches
      ) {

        const home =
          findTeam(
            rows,
            match.home
          );

        const away =
          findTeam(
            rows,
            match.away
          );

        /*
         * Si algún equipo no está
         * en la tabla, no inventamos
         * datos.
         */
        if (
          !home ||
          !away
        ) {

          missingMatches++;
          continue;
        }

        matchedMatches++;
        matchedPairs++;

        /*
         * ====================================
         * 9. EVALUAR DIFERENCIA DE RIVALES
         * ====================================
         *
         * Reutilizar la función compare
         * que ya tenemos:
         *
         * - puntos
         * - posiciones
         * - puntos por partido
         * - partidos disputados
         * - prioridad high/watch
         */
        const candidate =
          compare(
            match,
            rows
          );

        if (candidate) {

          candidates.push(
            candidate
          );
        }
      }

      /*
       * ========================================
       * 10. REGISTRAR RESULTADO EN PLANIFICADOR
       * ========================================
       *
       * Si pudimos comparar al menos
       * un encuentro:
       *
       * - análisis correcto
       * - cooldown de 20 minutos
       *
       * Si ninguno pudo compararse:
       *
       * - datos no disponibles
       * - cooldown de 5 minutos
       *
       * El planificador impide repetir
       * continuamente la misma liga.
       */
      this.planner.markCompleted(
        league.key,
        matchedPairs > 0
      );
    }

    /*
     * ==========================================
     * 11. LIMPIAR CACHÉ ANTIGUA
     * ==========================================
     */
    const cleanupBefore =
      Date.now() -
      this.ttlMs;

    for (
      const [key, entry]
      of this.tableCache
    ) {

      if (
        entry.expiresAt <
          cleanupBefore
      ) {

        this.tableCache.delete(
          key
        );
      }
    }

    /*
     * ==========================================
     * 12. ORDENAR CANDIDATOS
     * ==========================================
     *
     * Primero:
     * - alta prioridad
     *
     * Después:
     * - mayor diferencia de puntos
     * - mayor diferencia de posiciones
     */
    candidates.sort(
      (a, b) => {

        if (
          a.priority !==
          b.priority
        ) {

          return a.priority ===
            "high"
            ? -1
            : 1;
        }

        return (
          b.pointsGap -
            a.pointsGap ||
          b.positionGap -
            a.positionGap
        );
      }
    );

    /*
     * ==========================================
     * 13. RESULTADO DEL ESCANEO
     * ==========================================
     */
    return {
      totalUpcoming:
        matches.length,

      totalLeagues:
        leagues.length,

      scannedLeagues:
        selected.length,

      matchedMatches,

      missingMatches,

      standingsRequests,

      candidates,
    };
  }
}


