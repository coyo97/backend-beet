
import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  MatchContext,
} from "../../../match-context/domain/entities/MatchContext";

import type {
  MatchOpportunityProfile,
} from "../../domain/entities/MatchOpportunity";

import {
  MatchOpportunityScorer,
} from "../../domain/services/MatchOpportunityScorer";

import {
  UpcomingMatchEvaluator,
  type UpcomingMatchEvaluation,
} from "../../domain/services/UpcomingMatchEvaluator";

import type {
  UpcomingLeagueCandidate,
} from "./UpcomingLeagueCandidateScanner";

interface ContextReader {
  getOrWarmContext(
    match: LiveMatch
  ): Promise<MatchContext | null>;
}

interface PendingReview {
  key: string;
  candidate: UpcomingLeagueCandidate;
  attempts: number;
  nextAttemptAt: number;
}


export interface ConfirmedUpcomingOpportunity {
  key: string;

  match: LiveMatch;

  evaluation: UpcomingMatchEvaluation;

  profile: MatchOpportunityProfile;

  adjustedGap: number;

  standings: {
    homePosition: number;
    awayPosition: number;

    homePoints: number;
    awayPoints: number;
  };

  reviewedAt: string;
}

export interface ReviewBatchResult {
  attempted: number;
  confirmed: ConfirmedUpcomingOpportunity[];
  rejected: number;
  deferred: number;
  pending: number;
}

export class UpcomingOpportunityReviewQueue {

  private readonly pending =
    new Map<string, PendingReview>();

  private readonly reviewedUntil =
    new Map<string, number>();

  private readonly retryMs =
    5 * 60 * 1000;

  private readonly reviewCooldownMs =
    30 * 60 * 1000;

  private readonly maxPending = 2000;

  constructor(
    private readonly contextReader: ContextReader,

    private readonly scorer =
      new MatchOpportunityScorer(),

    private readonly evaluator =
      new UpcomingMatchEvaluator()
  ) {}

  public add(
    candidates: UpcomingLeagueCandidate[]
  ): number {

    const now = Date.now();

    this.cleanup(now);

    let added = 0;

    for (const candidate of candidates) {

      const key =
        this.matchKey(candidate.match);

      const kickoff =
        Date.parse(
          candidate.match.kickoffAt
        );

      if (
        !key ||
        !Number.isFinite(kickoff) ||
        kickoff <= now ||
        candidate.match.status.short !== "NS"
      ) {
        continue;
      }

      if (
        (this.reviewedUntil.get(key) ?? 0) >
        now
      ) {
        continue;
      }

      const existing =
        this.pending.get(key);

      if (existing) {

        /*
         * Actualizamos el candidato,
         * pero conservamos su turno
         * y el tiempo de reintento.
         */
        existing.candidate = candidate;
        continue;
      }

      if (
        this.pending.size >= this.maxPending
      ) {
        break;
      }

      this.pending.set(key, {
        key,
        candidate,
        attempts: 0,
        nextAttemptAt: now,
      });

      added++;
    }

    return added;
  }

  public async review(
    maxReviews = 2
  ): Promise<ReviewBatchResult> {

    const now = Date.now();

    this.cleanup(now);

    const limit =
      Math.min(
        Math.max(
          Math.trunc(maxReviews) || 1,
          1
        ),
        2
      );

    const eligible =
      [...this.pending.values()]
        .filter(
          item =>
            item.nextAttemptAt <= now
        )
        .sort((a, b) => {

          const remainingA =
            Date.parse(
              a.candidate.match.kickoffAt
            ) - now;

          const remainingB =
            Date.parse(
              b.candidate.match.kickoffAt
            ) - now;

          /*
           * Primero encuentros que
           * comienzan pronto.
           */
          const urgentA =
            remainingA <= 2 * 60 * 60 * 1000
              ? 0
              : 1;

          const urgentB =
            remainingB <= 2 * 60 * 60 * 1000
              ? 0
              : 1;

          if (urgentA !== urgentB) {
            return urgentA - urgentB;
          }

          /*
           * Después prioridad alta.
           */
          if (
            a.candidate.priority !==
            b.candidate.priority
          ) {
            return a.candidate.priority === "high"
              ? -1
              : 1;
          }

          return (
            remainingA - remainingB ||
            b.candidate.pointsGap -
              a.candidate.pointsGap
          );
        })
        .slice(0, limit);

    const confirmed:
      ConfirmedUpcomingOpportunity[] = [];

    let rejected = 0;
    let deferred = 0;

    for (const entry of eligible) {

      const match =
        entry.candidate.match;

      try {

        /*
         * Compartimos el presupuesto
         * del analizador Live.
         */
        const context =
          await this.contextReader
            .getOrWarmContext(match);

        if (!context) {

          this.defer(entry);
          deferred++;
          continue;
        }

        /*
         * Verificación contra el
         * encuentro específico.
         *
         * Una tabla preliminar no
         * es suficiente para avisar.
         */
        if (
          !this.sameStandings(
            entry.candidate,
            context
          )
        ) {

          this.finish(entry, now);
          rejected++;
          continue;
        }

        const scored =
          this.scorer.score(
            match,
            context
          );

        const evaluation =
          this.evaluator.evaluate({
            match,

            home: scored.home,
            away: scored.away,

            hasTable: true,

            dataQuality:
              scored.dataQuality,

            favoredSide:
              scored.favoredSide,
          });

        if (!evaluation) {

          this.finish(entry, now);
          rejected++;
          continue;
        }


confirmed.push({
  key: entry.key,

  match,

  evaluation,

  profile:
    scored.profile,

  adjustedGap:
    scored.adjustedGap,

  /*
   * Son valores de la tabla
   * preliminar ya contrastados
   * contra el contexto real.
   */
  standings: {
    homePosition:
      entry.candidate.homePosition,

    awayPosition:
      entry.candidate.awayPosition,

    homePoints:
      entry.candidate.homePoints,

    awayPoints:
      entry.candidate.awayPoints,
  },

  reviewedAt:
    new Date().toISOString(),
});


        this.finish(entry, now);

      } catch (error) {

        console.warn(
          "[UpcomingReviewQueue]",
          entry.key,
          error instanceof Error
            ? error.message
            : error
        );

        this.defer(entry);
        deferred++;
      }
    }

    return {
      attempted: eligible.length,
      confirmed,
      rejected,
      deferred,
      pending: this.pending.size,
    };
  }

  public size(): number {
    return this.pending.size;
  }

  private sameStandings(
    candidate: UpcomingLeagueCandidate,
    context: MatchContext
  ): boolean {

    const source =
      candidate.match.sources.find(
        item =>
          item.provider === "flashscore"
      );

    return (
      source !== undefined &&
      context.source.provider === "flashscore" &&
      context.source.externalId ===
        source.externalId &&

      context.competition.tableAvailable &&
      context.competition.tableScope ===
        "competition" &&
      context.availability.standings &&

      context.home.position ===
        candidate.homePosition &&
      context.away.position ===
        candidate.awayPosition &&

      context.home.points ===
        candidate.homePoints &&
      context.away.points ===
        candidate.awayPoints
    );
  }

  private matchKey(
    match: LiveMatch
  ): string | null {

    const source =
      match.sources.find(
        item =>
          item.provider === "flashscore" &&
          item.externalId
      );

    return source
      ? `${source.provider}:${source.externalId}`
      : null;
  }

  private defer(
    entry: PendingReview
  ): void {

    entry.attempts++;

    entry.nextAttemptAt =
      Date.now() + this.retryMs;
  }

  private finish(
    entry: PendingReview,
    now: number
  ): void {

    this.pending.delete(entry.key);

    this.reviewedUntil.set(
      entry.key,
      now + this.reviewCooldownMs
    );
  }

  private cleanup(now: number): void {

    for (const [key, entry] of this.pending) {

      const kickoff =
        Date.parse(
          entry.candidate.match.kickoffAt
        );

      if (
        !Number.isFinite(kickoff) ||
        kickoff <= now
      ) {
        this.pending.delete(key);
      }
    }

    for (
      const [key, expiresAt]
      of this.reviewedUntil
    ) {

      if (expiresAt <= now) {
        this.reviewedUntil.delete(key);
      }
    }
  }
}

