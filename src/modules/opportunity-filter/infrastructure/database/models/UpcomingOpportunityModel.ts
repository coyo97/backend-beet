
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

import type {
  MatchOpportunityProfile,
} from "../../../domain/entities/MatchOpportunity";

export interface UpcomingOpportunityPersistence {
  matchKey: string;

  provider: string;
  externalId: string;

  competitionId: string | null;
  competitionName: string;
  competitionCountry: string;

  homeName: string;
  awayName: string;

  kickoffAt: Date;

  level: "high" | "watch";
  leadingSide: "home" | "away";
  leadingTeam: string;
  opponentTeam: string;

  homePosition: number;
  awayPosition: number;

  homePoints: number;
  awayPoints: number;

  pointsGap: number;
  positionGap: number;

  profile: MatchOpportunityProfile;
  adjustedGap: number;
  dataQuality: number;

  reasons: string[];
  warnings: string[];

  firstDetectedAt: Date;
  reviewedAt: Date;

  expiresAt: Date;
}

const upcomingOpportunitySchema =
  new Schema<UpcomingOpportunityPersistence>(
    {
      matchKey: {
        type: String,
        required: true,
      },

      provider: {
        type: String,
        required: true,
      },

      externalId: {
        type: String,
        required: true,
      },

      competitionId: {
        type: String,
        default: null,
      },

      competitionName: {
        type: String,
        required: true,
      },

      competitionCountry: {
        type: String,
        required: true,
      },

      homeName: {
        type: String,
        required: true,
      },

      awayName: {
        type: String,
        required: true,
      },

      kickoffAt: {
        type: Date,
        required: true,
      },

      level: {
        type: String,
        enum: ["high", "watch"],
        required: true,
      },

      leadingSide: {
        type: String,
        enum: ["home", "away"],
        required: true,
      },

      leadingTeam: {
        type: String,
        required: true,
      },

      opponentTeam: {
        type: String,
        required: true,
      },

      homePosition: {
        type: Number,
        required: true,
      },

      awayPosition: {
        type: Number,
        required: true,
      },

      homePoints: {
        type: Number,
        required: true,
      },

      awayPoints: {
        type: Number,
        required: true,
      },

      pointsGap: {
        type: Number,
        required: true,
      },

      positionGap: {
        type: Number,
        required: true,
      },

      profile: {
        type: String,
        required: true,
      },

      adjustedGap: {
        type: Number,
        required: true,
      },

      dataQuality: {
        type: Number,
        required: true,
      },

      reasons: {
        type: [String],
        default: [],
      },

      warnings: {
        type: [String],
        default: [],
      },

      firstDetectedAt: {
        type: Date,
        required: true,
      },

      reviewedAt: {
        type: Date,
        required: true,
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      collection: "upcoming_opportunities",
    }
  );

/*
 * Un documento por partido.
 * Nunca duplicar por escaneos.
 */
upcomingOpportunitySchema.index(
  { matchKey: 1 },
  { unique: true }
);

/*
 * Consultas futuras por inicio.
 */
upcomingOpportunitySchema.index({
  kickoffAt: 1,
  level: 1,
});

/*
 * Limpieza automática después
 * de que el partido termine.
 *
 * MongoDB ejecuta la limpieza
 * TTL de manera asíncrona.
 */
upcomingOpportunitySchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const existing =
  mongoose.models.UpcomingOpportunity as
    | Model<UpcomingOpportunityPersistence>
    | undefined;

export const UpcomingOpportunityModel =
  existing ??
  mongoose.model<UpcomingOpportunityPersistence>(
    "UpcomingOpportunity",
    upcomingOpportunitySchema
  );

