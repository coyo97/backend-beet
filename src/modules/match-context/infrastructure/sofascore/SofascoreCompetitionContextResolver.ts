import type {
  MatchContext,
  TeamMatchContext,
} from "../../domain/entities/MatchContext";

import type {
  MatchContextFallbackInput,
  MatchContextFallbackResolver,
} from "../../application/ports/MatchContextFallbackResolver";

import {
  CompetitionExternalSourceRegistry,
} from "../external-sources/CompetitionExternalSourceRegistry";

import {
  SofascoreStandingsBrowserProvider,
} from "../../../football/infrastructure/providers/sofascore-browser/SofascoreStandingsBrowserProvider";

import type {
  SofascoreStandingRow,
} from "../../../football/infrastructure/providers/sofascore-browser/SofascoreStandings";

import {
  SofascoreTeamStandingResolver,
} from "./SofascoreTeamStandingResolver";

export class SofascoreCompetitionContextResolver
  implements
    MatchContextFallbackResolver {

  constructor(
    private readonly registry:
      CompetitionExternalSourceRegistry,

    private readonly standingsProvider:
      SofascoreStandingsBrowserProvider,

    private readonly teamResolver =
      new SofascoreTeamStandingResolver()
  ) {}

  public async resolve(
    input:
      MatchContextFallbackInput
  ): Promise<
    MatchContext | null
  > {

    /*
     * Por ahora este fallback está pensado
     * para partidos descubiertos por 1xBet.
     *
     * No hacemos matching genérico con
     * cualquier provider.
     */
    if (
      input.provider !==
      "bookmaker"
    ) {
      return null;
    }

    /*
     * Prioridad:
     *
     * 1. Identidad exacta de competición
     *    provider + competitionId.
     *
     * 2. Compatibilidad anterior:
     *    nombre + país exactos.
     *
     * Nunca hacemos fuzzy matching
     * automático de competiciones.
     */
    const externalSource =
      (
        input.competitionId
          ? this.registry
              .findBySourceCompetition(
                input.provider,
                input.competitionId
              )
          : null
      ) ??
      this.registry.find(
        input.competitionName,
        input.country
      );

    if (
      !externalSource ||
      externalSource.provider !==
        "sofascore-browser"
    ) {
      return null;
    }

    /*
     * Algunas páginas de Sofascore contienen
     * varias tablas correspondientes a:
     *
     * - grupos
     * - fases
     * - playoffs
     * - rondas finales
     *
     * standingsTournamentId selecciona
     * exactamente la tabla correcta.
     */
    const standings =
      await this.standingsProvider
        .getStandings(
          externalSource.url,
          {
            tournamentId:
              externalSource
                .standingsTournamentId,
          }
        );

    /*
     * Algunos providers utilizan nombres
     * diferentes para el mismo equipo.
     *
     * Ejemplo verificado:
     *
     * 1xBet:
     * Guangdong Chenxing Chuangert
     *
     * Sofascore:
     * Guangdong Chenxing Juli
     *
     * Solo utilizamos aliases explícitos
     * registrados. No fuzzy automático.
     */
    const homeLookupName =
      this.registry
        .resolveTeamName(
          externalSource,
          input.provider,
          input.homeName
        );

    const awayLookupName =
      this.registry
        .resolveTeamName(
          externalSource,
          input.provider,
          input.awayName
        );

    const homeRow =
      this.teamResolver.find(
        homeLookupName,
        standings.rows
      );

    const awayRow =
      this.teamResolver.find(
        awayLookupName,
        standings.rows
      );

    /*
     * Una tabla válida pero ningún equipo
     * reconocido no debe producir contexto.
     *
     * Preferimos no mostrar información
     * antes que asociar una tabla incorrecta.
     */
    if (
      !homeRow &&
      !awayRow
    ) {
      return null;
    }

    const missingTeams:
      string[] =
      [];

    if (!homeRow) {
      missingTeams.push(
        input.homeName
      );
    }

    if (!awayRow) {
      missingTeams.push(
        input.awayName
      );
    }

    const note =
      missingTeams.length >
      0
        ? `Clasificación Sofascore encontrada, pero sin asociación segura para: ${missingTeams.join(
            ", "
          )}`
        : "Clasificación de la competición obtenida de Sofascore.";

    return {
      source: {
        provider:
          "sofascore",

        externalId:
          externalSource
            .seasonId ??
          externalSource
            .tournamentId ??
          input.externalId,
      },

      competition: {
        /*
         * Si seleccionamos una fase concreta,
         * standings.tournamentName puede ser:
         *
         * CMCL, Final Round South Group
         *
         * que es más preciso que el nombre
         * general del unique tournament.
         */
        name:
          standings
            .tournamentName ??
          externalSource
            .canonicalName,

        country:
          externalSource
            .country ??
          input.country ??
          "",

        format:
          "table",

        tableAvailable:
          true,

        tableScope:
          "competition",

        annualDomesticTableAvailable:
          false,

        note,
      },

      home:
        this.toTeamContext(
          input.homeName,
          homeRow
        ),

      away:
        this.toTeamContext(
          input.awayName,
          awayRow
        ),

      lineups: {
        status:
          "unavailable",

        homeFormation:
          null,

        awayFormation:
          null,

        homeStarters:
          null,

        awayStarters:
          null,
      },

      availability: {
        details:
          false,

        standings:
          true,

        recentForm:
          false,

        lineups:
          false,
      },

      fetchedAt:
        standings.fetchedAt,
    };
  }

  private toTeamContext(
    fallbackName:
      string,

    row:
      SofascoreStandingRow |
      null
  ): TeamMatchContext {

    if (!row) {
      return {
        id:
          null,

        name:
          fallbackName,

        position:
          null,

        points:
          null,

        played:
          null,

        wins:
          null,

        draws:
          null,

        losses:
          null,

        goalsFor:
          null,

        goalsAgainst:
          null,

        goalDifference:
          null,

        goalsPerMatch:
          null,

        concededPerMatch:
          null,

        form:
          [],

        recentMatches:
          [],
      };
    }

    const goalsPerMatch =
      row.matches !==
        null &&
      row.matches >
        0 &&
      row.scoresFor !==
        null
        ? row.scoresFor /
          row.matches
        : null;

    const concededPerMatch =
      row.matches !==
        null &&
      row.matches >
        0 &&
      row.scoresAgainst !==
        null
        ? row.scoresAgainst /
          row.matches
        : null;

    const goalDifference =
      row.scoresFor !==
        null &&
      row.scoresAgainst !==
        null
        ? row.scoresFor -
          row.scoresAgainst
        : null;

    return {
      id:
        row.team.id,

      /*
       * Si encontramos el equipo correctamente,
       * mostramos el nombre canónico de Sofascore.
       */
      name:
        row.team.name,

      position:
        row.position,

      points:
        row.points,

      played:
        row.matches,

      wins:
        row.wins,

      draws:
        row.draws,

      losses:
        row.losses,

      goalsFor:
        row.scoresFor,

      goalsAgainst:
        row.scoresAgainst,

      goalDifference,

      goalsPerMatch,

      concededPerMatch,

      /*
       * Todavía no extraemos los últimos
       * partidos desde Sofascore.
       */
      form:
        [],

      recentMatches:
        [],
    };
  }
}
