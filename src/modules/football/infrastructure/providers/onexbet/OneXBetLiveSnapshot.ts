export interface OneXBetLiveSnapshot {
  externalId:
    string;

  clock:
    string | null;

  homeScore:
    number | null;

  awayScore:
    number | null;

  homeRedCards:
    number | null;

  awayRedCards:
    number | null;

  /*
   * Durante desarrollo guardamos los
   * campos encontrados para descubrir
   * cómo llama 1xBet realmente a:
   *
   * rojas
   * tarjetas
   * corners
   * periodos
   * estadísticas
   */
  redLikeFields:
    Record<
      string,
      string | number | boolean | null
    >;

  cardLikeFields:
    Record<
      string,
      string | number | boolean | null
    >;

  statLikeFields:
    Record<
      string,
      string | number | boolean | null
    >;
	
	  capabilityLikeFields:
    Record<
      string,
      string | number | boolean | null
    >;
	  debugPrimitiveFields:
    Record<
      string,
      string | number | boolean | null
    >;
}
