
import type {
  ConfirmedUpcomingOpportunity,
} from "../../application/services/UpcomingOpportunityReviewQueue";

import {
  UpcomingOpportunityModel,
} from "../database/models/UpcomingOpportunityModel";

export class MongooseUpcomingOpportunityRepository {

  /*
   * Persistencia después de confirmar
   * el partido con los dos evaluadores.
   *
   * No guardar candidatos
   * preliminares como confirmados.
   */
  public async saveMany(
    opportunities: ConfirmedUpcomingOpportunity[]
  ): Promise<number> {

    let saved = 0;

    for (const opportunity of opportunities) {

      const result =
        await this.saveOne(opportunity);

      if (result) {
        saved++;
      }
    }

    return saved;
  }

  public async saveOne(
    opportunity: ConfirmedUpcomingOpportunity
  ): Promise<boolean> {

    const match = opportunity.match;

    const source =
      match.sources.find(
        item =>
          `${item.provider}:${item.externalId}` ===
          opportunity.key
      );

    if (!source) {
      throw new Error(
        "Upcoming opportunity source mismatch"
      );
    }

    const kickoffMs =
      Date.parse(match.kickoffAt);

    const now = Date.now();

    /*
     * No almacenar un encuentro que
     * comenzó o que tiene fecha inválida.
     */
    if (
      !Number.isFinite(kickoffMs) ||
      kickoffMs <= now
    ) {
      return false;
    }

    const reviewedAt =
      new Date(opportunity.reviewedAt);

    if (
      !Number.isFinite(
        reviewedAt.getTime()
      )
    ) {
      throw new Error(
        "Invalid opportunity reviewedAt"
      );
    }

    /*
     * Conservar hasta 48 horas
     * después del inicio.
     */
    const expiresAt =
      new Date(
        kickoffMs + 48 * 60 * 60 * 1000
      );

    const evaluation =
      opportunity.evaluation;

    /*
     * Al reanalizar:
     * actualizamos estadísticas,
     * pero conservamos la fecha
     * del primer descubrimiento.
     */
    await UpcomingOpportunityModel
      .updateOne(
        {
          matchKey: opportunity.key,
        },
        {
          $set: {
            provider:
              source.provider,

            externalId:
              source.externalId,

            competitionId:
              match.competition.id,

            competitionName:
              match.competition.name,

            competitionCountry:
              match.competition.country,

            homeName:
              match.home.name,

            awayName:
              match.away.name,

            kickoffAt:
              new Date(kickoffMs),

            level:
              evaluation.level,

            leadingSide:
              evaluation.leadingSide,

            leadingTeam:
              evaluation.leadingTeam,

            opponentTeam:
              evaluation.opponentTeam,

            
homePosition:
  opportunity.standings.homePosition,

awayPosition:
  opportunity.standings.awayPosition,

homePoints:
  opportunity.standings.homePoints,

awayPoints:
  opportunity.standings.awayPoints,


            pointsGap:
              evaluation.pointsGap,

            positionGap:
              evaluation.positionGap,

            profile:
              opportunity.profile,

            adjustedGap:
              opportunity.adjustedGap,

            dataQuality:
              evaluation.dataQuality,

            reasons:
              evaluation.reasons,

            warnings:
              evaluation.warnings,

            reviewedAt,

            expiresAt,
          },

          $setOnInsert: {
            firstDetectedAt:
              new Date(),
          },
        },
        {
          upsert: true,
        }
      )
      .exec();

    return true;
  }
}

/*
 * El evaluador actual devuelve
 * la diferencia, pero no las
 * posiciones absolutas.
 *
 * Para no inventarlas, por ahora
 * dejamos estos campos explícitos
 * como no disponibles.
 *
 * En el siguiente ajuste se
 * conservarán los snapshots
 * del scorer en la confirmación.
 */
function matchSidePosition(
  _evaluation: ConfirmedUpcomingOpportunity["evaluation"],
  _side: "home" | "away"
): number {
  return 0;
}

function matchSidePoints(
  _evaluation: ConfirmedUpcomingOpportunity["evaluation"],
  _side: "home" | "away"
): number {
  return 0;
}

