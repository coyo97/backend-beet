import mongoose from "mongoose";

import {
  readFile,
} from "node:fs/promises";

import type {
  LiveMatch,
} from "../src/modules/football/domain/entities/LiveMatch";


import {
  MatchGoalAnalyzer,
} from "../src/modules/football/domain/services/MatchGoalAnalyzer";

import {
  matchEventTrackingCoordinator,
} from "../src/modules/football/footballModule";

interface OpportunityFile {
  opportunities?: Array<{
    match:
      LiveMatch;
  }>;
}

async function main():
  Promise<void> {


	  const mongodbUri =
    process.env.MONGODB_URI;

  if (!mongodbUri) {
    throw new Error(
      "MONGODB_URI is required"
    );
  }

  await mongoose.connect(
    mongodbUri
  );

  console.log(
    "MongoDB connected for test"
  );

  const path =
    process.argv[2] ??
    "/tmp/football-opportunities.json";

  const index =
    Number(
      process.argv[3] ??
      "0"
    );

  const raw =
    await readFile(
      path,
      "utf8"
    );

  const data =
    JSON.parse(
      raw
    ) as OpportunityFile;

  const opportunities =
    data.opportunities ??
    [];

  const opportunity =
    opportunities[
      index
    ];

  if (!opportunity) {
    throw new Error(
      `Opportunity index ${index} not found`
    );
  }

  const match =
    opportunity.match;

  console.log(
    "\n=============================="
  );

  console.log(
    "MATCH"
  );

  console.log(
    match.home.name,
    "vs",
    match.away.name
  );

  console.log(
    "minute:",
    match.status.minute
  );

  console.log(
    "sources:",
    match.sources
  );

  /*
   * Prueba manual explícita.
   *
   * No depende del profile del Radar.
   * El objetivo es comprobar UNA captura
   * de incidents.
   */
  const result =
    await matchEventTrackingCoordinator
      .track(
        match,
        {
          userPick:
            false,

          watchlisted:
            false,

          redCard:
            false,

          detailOpened:
            false,

          manual:
            true,

          opportunityLevel:
            null,
        },
        true
      );

  console.log(
    "\n=============================="
  );

  console.log(
    "TRACKING RESULT"
  );

  console.log({
    captured:
      result.captured,

    skippedReason:
      result.skippedReason,

    reasons:
      result.decision
        .reasons,

    refreshAfterMs:
      result.decision
        .refreshAfterMs,
  });

  if (
    result.snapshot
  ) {

    console.log(
      "\nincidentSource:",
      result.snapshot
        .incidentSource
    );

    console.log(
      "incidents:",
      result.snapshot
        .incidents
        .length
    );



    console.log(
      "\nLAST INCIDENTS"
    );

    console.log(
      result.snapshot
        .incidents
        .slice(
          -15
        )
    );

    console.log(
      "\nINCIDENT TYPES"
    );

    const types =
      new Map<
        string,
        number
      >();

    for (
      const incident
      of result.snapshot
        .incidents
    ) {

      const type =
        incident.type ??
        "(null)";

      types.set(
        type,
        (
          types.get(
            type
          ) ??
          0
        ) +
          1
      );
    }

    console.log(
      Object.fromEntries(
        types
      )
    );
	const goalAnalyzer =
  new MatchGoalAnalyzer();

const goalAnalysis =
  goalAnalyzer.analyze(
    result.snapshot
      .incidents
  );

console.log(
  "\n=============================="
);

console.log(
  "GOAL ANALYSIS"
);

console.dir(
  goalAnalysis,
  {
    depth:
      null,
  }
);
  }
}

main()
  .then(
    async () => {

      await mongoose.disconnect();

      process.exit(
        0
      );
    }
  )
  .catch(
    async error => {

      console.error(
        error
      );

      await mongoose
        .disconnect()
        .catch(
          () => undefined
        );

      process.exit(
        1
      );
    }
  );
