const BASE =
  "https://www.fotmob.com/api/data";

const headers = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

  accept:
    "application/json,text/plain,*/*",
};

async function getJson(
  path:
    string
) {

  const response =
    await fetch(
      `${BASE}/${path}`,
      {
        headers,

        signal:
          AbortSignal.timeout(
            15_000
          ),
      }
    );

  console.log(
    path,
    "HTTP",
    response.status
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function main() {

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )
      .replace(
        /-/g,
        ""
      );

  const matches:
    any =
      await getJson(
        `matches?date=${today}`
      );

  if (!matches) {
    return;
  }

  const all =
    (matches.leagues ?? [])
      .flatMap(
        (
          league:
            any
        ) =>
          (
            league.matches ??
            []
          ).map(
            (
              match:
                any
            ) => ({
              ...match,

              _league:
                league,
            })
          )
      );

  const live =
    all.filter(
      (
        match:
          any
      ) =>
        match
          ?.status
          ?.started ===
          true &&
        match
          ?.status
          ?.finished !==
          true &&
        match
          ?.status
          ?.cancelled !==
          true
    );

  console.log(
    "===================="
  );

  console.log(
    "TOTAL:",
    all.length
  );

  console.log(
    "LIVE:",
    live.length
  );

  for (
    const match
    of live.slice(
      0,
      15
    )
  ) {
    console.log({
      id:
        match.id,

      league:
        match._league
          ?.name,

      leagueId:
        match.leagueId ??
        match._league
          ?.id,

      home:
        match.home
          ?.name,

      away:
        match.away
          ?.name,

      score:
        match.status
          ?.scoreStr,

      status:
        match.status
          ?.reason,
    });
  }

  const candidate =
    live[0] ??
    all.find(
      (
        match:
          any
      ) =>
        match
          ?.status
          ?.finished ===
        true
    );

  if (!candidate) {
    return;
  }

  console.log(
    "\nDETAIL TEST:",
    candidate.id
  );

  const detail:
    any =
      await getJson(
        `matchDetails?matchId=${candidate.id}`
      );

  if (detail) {
    console.log(
      "DETAIL KEYS:",
      Object.keys(
        detail
      )
    );
  }

  const leagueId =
    candidate.leagueId ??
    candidate._league
      ?.id;

  if (leagueId) {
    console.log(
      "\nLEAGUE TEST:",
      leagueId
    );

    const league:
      any =
        await getJson(
          `leagues?id=${leagueId}`
        );

    if (league) {
      console.log(
        "LEAGUE KEYS:",
        Object.keys(
          league
        )
      );
    }
  }
}

void main();
