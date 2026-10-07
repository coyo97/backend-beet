import fs from "node:fs";

import {
  FotMobClient,
} from "../src/modules/football/infrastructure/providers/fotmob/FotMobClient";

import {
  FotMobFixtureCatalog,
} from "../src/modules/football/infrastructure/providers/fotmob/FotMobFixtureCatalog";

import type {
  LiveMatch,
} from "../src/modules/football/domain/entities/LiveMatch";

import type {
  FotMobFixtureCandidate,
} from "../src/modules/football/infrastructure/providers/fotmob/FotMobFixtureCatalog";

interface AuditItem {
  source:
    string;

  candidate:
    string;

  score:
    number;

  home:
    number;

  away:
    number;

  competition:
    number;

  time:
    number;
}

function normalize(
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
      /\b(fc|cf|sc|afc|club)\b/g,
      " "
    )
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

function nameSimilarity(
  left:
    string,

  right:
    string
): number {

  const a =
    normalize(
      left
    );

  const b =
    normalize(
      right
    );

  if (
    !a ||
    !b
  ) {
    return 0;
  }

  if (
    a ===
    b
  ) {
    return 1;
  }

  if (
    a.includes(
      b
    ) ||
    b.includes(
      a
    )
  ) {
    return 0.90;
  }

  const tokensA =
    new Set(
      a.split(" ")
    );

  const tokensB =
    new Set(
      b.split(" ")
    );

  let intersection =
    0;

  for (
    const token
    of tokensA
  ) {

    if (
      tokensB.has(
        token
      )
    ) {
      intersection +=
        1;
    }
  }

  const union =
    new Set([
      ...tokensA,
      ...tokensB,
    ]).size;

  return union ===
    0
    ? 0
    : intersection /
        union;
}

function timeSimilarity(
  source:
    LiveMatch,

  candidate:
    FotMobFixtureCandidate
): number {

  const sourceTime =
    new Date(
      source.kickoffAt
    ).getTime();

  const utcTime =
    candidate.match
      .status
      ?.utcTime;

  if (!utcTime) {
    return 0.5;
  }

  const candidateTime =
    new Date(
      utcTime
    ).getTime();

  if (
    !Number.isFinite(
      sourceTime
    ) ||
    !Number.isFinite(
      candidateTime
    )
  ) {
    return 0.5;
  }

  const minutes =
    Math.abs(
      sourceTime -
      candidateTime
    ) /
    60_000;

  if (
    minutes <=
    20
  ) {
    return 1;
  }

  if (
    minutes <=
    60
  ) {
    return 0.8;
  }

  if (
    minutes <=
    180
  ) {
    return 0.5;
  }

  return 0.2;
}

function score(
  source:
    LiveMatch,

  candidate:
    FotMobFixtureCandidate
): AuditItem {

  const candidateHome =
    candidate.match
      .home
      ?.name ??
    "";

  const candidateAway =
    candidate.match
      .away
      ?.name ??
    "";

  const home =
    nameSimilarity(
      source.home.name,
      candidateHome
    );

  const away =
    nameSimilarity(
      source.away.name,
      candidateAway
    );

  const competition =
    nameSimilarity(
      source.competition.name,
      candidate.league.name
    );

  const time =
    timeSimilarity(
      source,
      candidate
    );

  const finalScore =
    home <
      0.55 ||
    away <
      0.55
      ? 0
      : home *
          0.40 +
        away *
          0.40 +
        competition *
          0.10 +
        time *
          0.10;

  return {
    source:
      `${source.home.name} - ${source.away.name}`,

    candidate:
      `${candidateHome} - ${candidateAway}`,

    score:
      Number(
        finalScore.toFixed(
          3
        )
      ),

    home:
      Number(
        home.toFixed(
          3
        )
      ),

    away:
      Number(
        away.toFixed(
          3
        )
      ),

    competition:
      Number(
        competition.toFixed(
          3
        )
      ),

    time:
      Number(
        time.toFixed(
          3
        )
      ),
  };
}

async function main() {

  const raw =
    JSON.parse(
      fs.readFileSync(
        "/tmp/live-after-fotmob-enrich.json",
        "utf8"
      )
    );

  const matches:
    LiveMatch[] =
    raw.matches ??
    raw.data ??
    raw;

  const unresolved =
    matches.filter(
      match =>
        match.sources.some(
          source =>
            source.provider ===
            "flashscore"
        ) &&
        !match.sources.some(
          source =>
            source.provider ===
            "fotmob"
        )
    );

  const catalog =
    new FotMobFixtureCatalog(
      new FotMobClient(),
      30_000
    );

  const candidates =
    await catalog.getAll(
      true
    );

  const results:
    AuditItem[] =
    [];

  for (
    const match
    of unresolved
  ) {

    let best:
      AuditItem | null =
      null;

    for (
      const candidate
      of candidates
    ) {

      const current =
        score(
          match,
          candidate
        );

      if (
        !best ||
        current.score >
          best.score
      ) {
        best =
          current;
      }
    }

    if (
      best
    ) {
      results.push(
        best
      );
    }
  }

  results.sort(
    (
      a,
      b
    ) =>
      b.score -
      a.score
  );

  const buckets = {
    unresolved:
      unresolved.length,

    fotmobCatalog:
      candidates.length,

    score078Plus:
      results.filter(
        item =>
          item.score >=
          0.78
      ).length,

    score070To077:
      results.filter(
        item =>
          item.score >=
            0.70 &&
          item.score <
            0.78
      ).length,

    score055To069:
      results.filter(
        item =>
          item.score >=
            0.55 &&
          item.score <
            0.70
      ).length,

    below055:
      results.filter(
        item =>
          item.score <
          0.55
      ).length,
  };

  console.log(
    "===== SUMMARY ====="
  );

  console.log(
    buckets
  );

  console.log(
    "\n===== NEAR MISSES ====="
  );

  console.table(
    results.slice(
      0,
      40
    )
  );
}

main().catch(
  error => {
    console.error(
      error
    );

    process.exitCode =
      1;
  }
);
