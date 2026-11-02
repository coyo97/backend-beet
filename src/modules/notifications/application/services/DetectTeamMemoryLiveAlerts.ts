
import {
  normalizeTeamName,
} from "../../../team-memory/domain/services/normalizeTeamName";

import {
  scoreTeamMemoryLiveAlert,
} from "./ScoreTeamMemoryLiveAlert";

export interface TeamMemoryLiveMatch {
  matchKey: string;
  homeName: string;
  awayName: string;

  isLive: boolean;
  minute?: number | null;
  kickoffAt?: string | null;
}

export interface TeamMemoryAlertEvent {
  ownerId: string;
  teamName: string;
  outcome: "win" | "loss";

  opponentName?: string | null;
  createdAt?: string | Date | null;
}

export interface TeamMemoryLiveAlert {
  matchKey: string;
  type: "TEAM_MEMORY_LIVE";

  teamName: string;
  opponentName: string;

  wins: number;
  losses: number;

  previousOpponentWins: number;
  previousOpponentLosses: number;

  title: string;
  body: string;
}

interface MemoryCandidate {
  teamName: string;
  opponentName: string;

  wins: number;
  losses: number;

  opponentWins: number;
  opponentLosses: number;

  lastAgainstOpponent:
    "win" | "loss" | null;

  score: number;
}

function timestamp(
  value?: string | Date | null
): number {

  if (!value) {
    return 0;
  }

  const ms = new Date(value).getTime();

  return Number.isFinite(ms)
    ? ms
    : 0;
}

export class DetectTeamMemoryLiveAlerts {

  /*
   * Detectar únicamente partidos
   * que acaban de comenzar.
   *
   * Evita avisar por primera vez
   * cuando un encuentro ya lleva
   * 60 o 80 minutos jugándose.
   */
  private justStarted(
    match: TeamMemoryLiveMatch,
    now: Date
  ): boolean {

    if (!match.isLive) {
      return false;
    }

    if (
      typeof match.minute === "number" &&
      Number.isFinite(match.minute)
    ) {
      return (
        match.minute >= 0 &&
        match.minute <= 10
      );
    }

    if (!match.kickoffAt) {
      return false;
    }

    const kickoff =
      Date.parse(match.kickoffAt);

    const age =
      now.getTime() - kickoff;

    return (
      Number.isFinite(kickoff) &&
      age >= 0 &&
      age <= 10 * 60_000
    );
  }

  public execute(input: {
    ownerId: string;
    matches: readonly TeamMemoryLiveMatch[];
    events: readonly TeamMemoryAlertEvent[];
    now?: Date;
  }): TeamMemoryLiveAlert[] {

    const ownerId =
      input.ownerId.trim();

    if (!ownerId) {
      throw new Error(
        "ownerId is required"
      );
    }

    const now =
      input.now ?? new Date();

    /*
     * Defensa adicional:
     * nunca utilizar memoria
     * personal de otra cuenta.
     */
    const ownerEvents =
      input.events.filter(
        event =>
          event.ownerId === ownerId
      );

    const eventsByTeam =
      new Map<
        string,
        TeamMemoryAlertEvent[]
      >();

    for (const event of ownerEvents) {

      const key =
        normalizeTeamName(
          event.teamName
        );

      const items =
        eventsByTeam.get(key) ?? [];

      items.push(event);

      eventsByTeam.set(
        key,
        items
      );
    }

    const alerts:
      TeamMemoryLiveAlert[] = [];

    const seenMatches =
      new Set<string>();

    for (const match of input.matches) {

      if (
        !match.matchKey ||
        seenMatches.has(match.matchKey) ||
        !this.justStarted(match, now)
      ) {
        continue;
      }

      seenMatches.add(
        match.matchKey
      );

      const candidates:
        MemoryCandidate[] = [];

      for (const side of [
        {
          teamName: match.homeName,
          opponentName: match.awayName,
        },
        {
          teamName: match.awayName,
          opponentName: match.homeName,
        },
      ]) {

        const key =
          normalizeTeamName(
            side.teamName
          );

        const events =
          eventsByTeam.get(key) ?? [];

        if (events.length === 0) {
          continue;
        }

        const opponentKey =
          normalizeTeamName(
            side.opponentName
          );

        const sameOpponent =
          events
            .filter(
              event =>
                event.opponentName &&
                normalizeTeamName(
                  event.opponentName
                ) === opponentKey
            )
            .sort(
              (a, b) =>
                timestamp(b.createdAt) -
                timestamp(a.createdAt)
            );

        const wins =
          events.filter(
            event =>
              event.outcome === "win"
          ).length;

        const losses =
          events.filter(
            event =>
              event.outcome === "loss"
          ).length;

        const opponentWins =
          sameOpponent.filter(
            event =>
              event.outcome === "win"
          ).length;

        const opponentLosses =
          sameOpponent.filter(
            event =>
              event.outcome === "loss"
          ).length;

        candidates.push({
          ...side,

          wins,
          losses,

          opponentWins,
          opponentLosses,

          lastAgainstOpponent:
            sameOpponent[0]?.outcome ??
            null,

          /*
           * Priorizar:
           * 1. Rival repetido.
           * 2. Registros positivos.
           * 3. Historial restante.
           */
          score: scoreTeamMemoryLiveAlert({
  wins,
  losses,
  previousOpponentWins: opponentWins,
  previousOpponentLosses: opponentLosses,
}),
        });
      }

      if (candidates.length === 0) {
        continue;
      }

      /*
       * Un aviso por partido,
       * incluso si ambos equipos
       * aparecen en Team Memory.
       */
      candidates.sort(
        (a, b) =>
          b.score - a.score
      );

      const selected =
        candidates[0];

      const parts = [
        `${selected.teamName} vs ${selected.opponentName}.`,
        `En tu historial: ${selected.wins} veces te hizo ganar y ${selected.losses} perder.`,
      ];

      if (selected.lastAgainstOpponent) {
        parts.push(
          selected.lastAgainstOpponent === "win"
            ? `La última vez que lo registraste ante ${selected.opponentName}, te hizo ganar.`
            : `La última vez que lo registraste ante ${selected.opponentName}, te hizo perder.`
        );
      }

      alerts.push({
        matchKey:
          match.matchKey,

        type:
          "TEAM_MEMORY_LIVE",

        teamName:
          selected.teamName,

        opponentName:
          selected.opponentName,

        wins:
          selected.wins,

        losses:
          selected.losses,

        previousOpponentWins:
          selected.opponentWins,

        previousOpponentLosses:
          selected.opponentLosses,

        title:
          `🧠 ${selected.teamName} está jugando`,

        body:
          parts.join(" "),
      });
    }

    return alerts;
  }
}

