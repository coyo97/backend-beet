import type {
  MatchOpportunity,
} from "../../../opportunity-filter/domain/entities/MatchOpportunity";

import type {
  AlertRule,
} from "../../domain/AlertRule";

import {
  BuildFavoriteAlertFacts,
} from "./BuildFavoriteAlertFacts";

import {
  EvaluateAlertRule,
} from "./EvaluateAlertRule";

export interface FavoriteRulePreviewHit {
  ruleId: string;
  ownerId: string;

  homeName: string;
  awayName: string;

  minute: number | null;
}

export interface FavoriteRulePreviewResult {
  opportunitiesReceived: number;

  eligibleOpportunities: number;

  eligibleRules: number;

  evaluations: number;

  matches: FavoriteRulePreviewHit[];
}

/*
 * Evalúa reglas de favoritos usando
 * únicamente MatchOpportunity existentes.
 *
 * IMPORTANTE:
 *
 * - No realiza peticiones HTTP.
 * - No realiza consultas a MongoDB.
 * - No envía notificaciones push.
 * - No modifica registros.
 *
 * El llamador proporciona las reglas
 * y oportunidades ya obtenidas.
 */
export class PreviewFavoriteAlertRules {

  private readonly factsBuilder =
    new BuildFavoriteAlertFacts();

  private readonly evaluator =
    new EvaluateAlertRule();

  public execute(
    opportunities: readonly MatchOpportunity[],
    rules: readonly AlertRule[]
  ): FavoriteRulePreviewResult {

    /*
     * Primera versión:
     *
     * Solo reglas globales en vivo
     * con métricas compatibles.
     *
     * Watchlist necesita comprobar
     * la pertenencia del partido
     * al usuario antes de evaluarse.
     */
    const eligibleRules =
      rules.filter(rule =>
        rule.enabled &&
        rule.phase === "live" &&
        rule.scope === "all" &&
        this.factsBuilder.supports(
          rule.when
        )
      );

    const matches:
      FavoriteRulePreviewHit[] = [];

    let eligibleOpportunities = 0;

    let evaluations = 0;

    for (const opportunity of opportunities) {

      /*
       * Aprovechamos la lógica que
       * ya identifica favoritos fiables.
       */
      const facts =
        this.factsBuilder.build(
          opportunity
        );

      if (!facts) {
        continue;
      }

      eligibleOpportunities++;

      for (const rule of eligibleRules) {

        if (
          !this.matchesFilters(
            rule,
            opportunity
          )
        ) {
          continue;
        }

        evaluations++;

        const matched =
          this.evaluator.execute(
            rule.when,
            facts
          );

        if (!matched) {
          continue;
        }

        matches.push({
          ruleId: rule.id,
          ownerId: rule.ownerId,

          homeName:
            opportunity.match.home.name,

          awayName:
            opportunity.match.away.name,

		  minute:
  typeof facts.minute === "number" &&
  Number.isFinite(facts.minute)
    ? facts.minute
    : null,
        });
      }
    }

    return {
      opportunitiesReceived:
        opportunities.length,

      eligibleOpportunities,

      eligibleRules:
        eligibleRules.length,

      evaluations,

      matches,
    };
  }

  private normalize(
    value: string
  ): string {

    return value
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /*
   * Aplicar los filtros personales
   * antes de evaluar condiciones.
   */
  private matchesFilters(
    rule: AlertRule,
    opportunity: MatchOpportunity
  ): boolean {

    const country =
      this.normalize(
        opportunity.match.competition.country ?? ""
      );

    const competition =
      this.normalize(
        opportunity.match.competition.name ?? ""
      );

    const countries =
      rule.filters.countries ?? [];

    const competitions =
      rule.filters.competitions ?? [];

    const excluded =
      rule.filters.excludedCompetitions ?? [];

    if (
      countries.length > 0 &&
      !countries.some(
        value =>
          this.normalize(value) === country
      )
    ) {
      return false;
    }

    if (
      competitions.length > 0 &&
      !competitions.some(
        value =>
          this.normalize(value) === competition
      )
    ) {
      return false;
    }

    if (
      excluded.some(
        value =>
          this.normalize(value) === competition
      )
    ) {
      return false;
    }

    return true;
  }
}
