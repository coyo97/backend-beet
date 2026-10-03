export type ExternalCompetitionProvider =
  "sofascore-browser";

export interface ExternalCompetitionIdentity {
  provider:
    string;

  externalId:
    string;
}

export interface ExternalTeamAlias {
  provider:
    string;

  sourceName:
    string;

  targetName:
    string;
}

export interface ExternalTeamIdentity {
  provider:
    string;

  teamName:
    string;

  externalId:
    string;
}

export interface ExternalCompetitionSource {
  id:
    string;

  provider:
    ExternalCompetitionProvider;

  canonicalName:
    string;

  aliases:
    string[];

  country:
    string | null;

  url:
    string;

  /*
   * ID del unique tournament usado
   * en la URL de Sofascore.
   *
   * Ej:
   * CMCL = 35616
   */
  tournamentId:
    string | null;

  seasonId:
    string | null;

  /*
   * ID EXACTO de la fase/grupo cuya
   * tabla queremos leer.
   *
   * Ej:
   * Final Round South Group = 194069
   */
  standingsTournamentId:
    string | null;

  /*
   * Identidades exactas provenientes
   * de otras fuentes.
   */
  sourceCompetitions:
    ExternalCompetitionIdentity[];

  /*
   * Alias explícitos y verificados.
   * Nunca fuzzy automático.
   */
  teamAliases:
    ExternalTeamAlias[];

  teamIdentities:
    ExternalTeamIdentity[];
}

const SOURCES:
  ExternalCompetitionSource[] =
  [
    {
      id:
        "sofascore:sff-sibir:2026",

      provider:
        "sofascore-browser",

      canonicalName:
        "Championship SFF Sibir Gold",

      aliases: [
        "Championship SFF Sibir Gold",
        "Championship SFF Sibir",
      ],

      country:
        "Russia",

      url:
        "https://www.sofascore.com/es/football/tournament/russia-amateur/championship-sff-sibir/20768#id:90865",

      tournamentId:
        "20768",

      seasonId:
        "90865",

      standingsTournamentId:
        null,

      sourceCompetitions:
        [],

      teamAliases:
        [],
	    teamIdentities:
        [],
    },

    {
      id:
        "sofascore:cmcl-final-south:2026",

      provider:
        "sofascore-browser",

      canonicalName:
        "Chinese Champions League CMCL",

      aliases: [
        "Chinese Champions League CMCL",
        "China. Champions League",
      ],

      country:
        "China",

      url:
        "https://www.sofascore.com/football/tournament/china/cmcl-champions-league/35616#id:96779",

      tournamentId:
        "35616",

      seasonId:
        "96779",

      standingsTournamentId:
        "194069",

      sourceCompetitions: [
        {
          provider:
            "bookmaker",

          externalId:
            "1791926",
        },
      ],

      teamAliases: [
        {
          provider:
            "bookmaker",

          sourceName:
            "Guangdong Chenxing Chuangert",

          targetName:
            "Guangdong Chenxing Juli",
        },

        {
          provider:
            "bookmaker",

          sourceName:
            "Wuhan Lianzhen",

          targetName:
            "Wuhan Lianzhen FC",
        },
      ],
	        teamIdentities: [
        {
          provider:
            "elbotola",

          teamName:
            "Guangdong Chenxing Juli",

          externalId:
            "pxwrxlhvw1vryk0",
        },

        {
          provider:
            "elbotola",

          teamName:
            "Wuhan Lianzhen FC",

          externalId:
            "8yomo4h0nejq0j6",
        },
      ],

    },
  ];

export class CompetitionExternalSourceRegistry {
  public find(
    competitionName:
      string,

    country:
      string | null
  ): ExternalCompetitionSource |
    null {

    const normalizedName =
      this.normalize(
        competitionName
      );

    const normalizedCountry =
      country
        ? this.normalize(
            country
          )
        : null;

    return (
      SOURCES.find(
        (
          source
        ) => {

          if (
            normalizedCountry &&
            source.country &&
            this.normalize(
              source.country
            ) !==
              normalizedCountry
          ) {
            return false;
          }

          const names =
            [
              source
                .canonicalName,
              ...source.aliases,
            ];

          return names.some(
            (
              name
            ) =>
              this.normalize(
                name
              ) ===
                normalizedName
          );
        }
      ) ??
      null
    );
  }

  public findBySourceCompetition(
    provider:
      string,

    externalId:
      string
  ): ExternalCompetitionSource |
    null {

    const normalizedProvider =
      provider
        .trim()
        .toLowerCase();

    const normalizedId =
      externalId
        .trim();

    return (
      SOURCES.find(
        (
          source
        ) =>
          source
            .sourceCompetitions
            .some(
              (
                identity
              ) =>
                identity
                  .provider
                  .trim()
                  .toLowerCase() ===
                  normalizedProvider &&
                identity
                  .externalId
                  .trim() ===
                  normalizedId
            )
      ) ??
      null
    );
  }

  public resolveTeamName(
    source:
      ExternalCompetitionSource,

    provider:
      string,

    teamName:
      string
  ): string {

    const normalizedProvider =
      provider
        .trim()
        .toLowerCase();

    const normalizedTeam =
      this.normalize(
        teamName
      );

    const alias =
      source
        .teamAliases
        .find(
          (
            candidate
          ) =>
            candidate
              .provider
              .trim()
              .toLowerCase() ===
              normalizedProvider &&
            this.normalize(
              candidate
                .sourceName
            ) ===
              normalizedTeam
        );

    return (
      alias?.targetName ??
      teamName
    );
  }
    public findTeamIdentity(
    source:
      ExternalCompetitionSource,

    provider:
      string,

    teamName:
      string
  ): ExternalTeamIdentity |
    null {

    const normalizedProvider =
      provider
        .trim()
        .toLowerCase();

    const normalizedTeamName =
      this.normalize(
        teamName
      );

    return (
      source
        .teamIdentities
        .find(
          (
            identity
          ) =>
            identity
              .provider
              .trim()
              .toLowerCase() ===
              normalizedProvider &&
            this.normalize(
              identity.teamName
            ) ===
              normalizedTeamName
        ) ??
      null
    );
  }

  private normalize(
    value:
      string
  ): string {

    return value
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }
}
