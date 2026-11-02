
import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import {
  normalizeTeamName,
} from "../../../team-memory/domain/services/normalizeTeamName";

import {
  TeamMemoryEventModel,
} from "../../../team-memory/infrastructure/database/models/TeamMemoryEventModel";

import {
  DetectTeamMemoryLiveAlerts,
  type TeamMemoryLiveMatch,
  type TeamMemoryAlertEvent,
  type TeamMemoryLiveAlert,
} from "./DetectTeamMemoryLiveAlerts";

export interface OwnerTeamMemoryLiveAlert
  extends TeamMemoryLiveAlert {
  ownerId: string;
}

export class FindTeamMemoryLiveAlerts {

  private readonly detector =
    new DetectTeamMemoryLiveAlerts();

  /*
   * Excluir estados finalizados,
   * suspendidos y no iniciados.
   *
   * Para el aviso de comienzo
   * aceptamos el primer tiempo
   * y los estados LIVE genéricos.
   */
  private isFirstHalfLive(
    match: LiveMatch
  ): boolean {

    const short =
      match.status.short
        .trim()
        .toUpperCase();

    const long =
      match.status.long
        .trim()
        .toLowerCase();

    return (
      [
        "1H",
        "H1",
        "LIVE",
        "INPLAY",
        "IN_PLAY",
        "FIRST_HALF",
      ].includes(short) ||
      long.includes("first half") ||
      long.includes("primer tiempo")
    );
  }

  private isJustStarted(
    match: LiveMatch,
    now: Date
  ): boolean {

    if (!this.isFirstHalfLive(match)) {
      return false;
    }

    const minute =
      match.status.minute;

    if (
      typeof minute === "number" &&
      Number.isFinite(minute)
    ) {
      return minute >= 0 &&
        minute <= 10;
    }

    const kickoff =
      Date.parse(match.kickoffAt);

    if (!Number.isFinite(kickoff)) {
      return false;
    }

    const age =
      now.getTime() - kickoff;

    return age >= 0 &&
      age <= 10 * 60_000;
  }

  /*
   * Identidad relativamente estable
   * incluso si cambia el proveedor
   * principal de un partido.
   *
   * No contiene datos del usuario.
   */
  private matchKey(
    match: LiveMatch
  ): string {

    const competition =
      normalizeTeamName(
        [
          match.competition.country,
          match.competition.name,
        ].join(" ")
      );

    const home =
      normalizeTeamName(
        match.home.name
      );

    const away =
      normalizeTeamName(
        match.away.name
      );

    const kickoffDay =
      match.kickoffAt.slice(0, 10);

    return [
      "team-memory-live",
      competition,
      home,
      away,
      kickoffDay,
    ].join(":");
  }

  public async execute(
    matches: readonly LiveMatch[],
    now = new Date()
  ): Promise<OwnerTeamMemoryLiveAlert[]> {

    /*
     * Filtrar antes de consultar
     * la memoria personal.
     *
     * Solo interesan partidos
     * en sus primeros minutos.
     */
    const earlyMatches =
      matches.filter(
        match =>
          this.isJustStarted(
            match,
            now
          )
      );

    if (earlyMatches.length === 0) {
      return [];
    }

    const candidates:
      TeamMemoryLiveMatch[] =
        earlyMatches.map(
          match => ({
            matchKey:
              this.matchKey(match),

            homeName:
              match.home.name,

            awayName:
              match.away.name,

            isLive: true,

            minute:
              match.status.minute,

            kickoffAt:
              match.kickoffAt,
          })
        );

    /*
     * Consultar solo equipos
     * presentes en estos partidos.
     */
    const teamKeys =
      new Set<string>();

    for (const match of earlyMatches) {

      teamKeys.add(
        normalizeTeamName(
          match.home.name
        )
      );

      teamKeys.add(
        normalizeTeamName(
          match.away.name
        )
      );
    }

    teamKeys.delete("");

    if (teamKeys.size === 0) {
      return [];
    }

    const documents =
      await TeamMemoryEventModel
        .find({
          teamKey: {
            $in:
              [...teamKeys],
          },
        })
        .select({
          ownerId: 1,
          teamName: 1,
          outcome: 1,
          opponentName: 1,
          createdAt: 1,
        })
        .lean()
        .exec();

    if (documents.length === 0) {
      return [];
    }

    /*
     * Separar la memoria de
     * cada usuario ANTES de
     * llamar al detector.
     */
    const byOwner =
      new Map<
        string,
        TeamMemoryAlertEvent[]
      >();

    for (const document of documents) {

      const ownerId =
        document.ownerId?.trim();

      if (!ownerId) {
        continue;
      }

      const events =
        byOwner.get(ownerId) ?? [];

      events.push({
        ownerId,

        teamName:
          document.teamName,

        outcome:
          document.outcome,

        opponentName:
          document.opponentName,

        createdAt:
          document.createdAt,
      });

      byOwner.set(
        ownerId,
        events
      );
    }

    const result:
      OwnerTeamMemoryLiveAlert[] = [];

    for (const [ownerId, events] of byOwner) {

      const alerts =
        this.detector.execute({
          ownerId,
          matches:
            candidates,
          events,
          now,
        });

      for (const alert of alerts) {
        result.push({
          ...alert,
          ownerId,
        });
      }
    }

    return result;
  }
}

