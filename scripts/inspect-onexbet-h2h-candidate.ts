import {
  OneXBetLiveClient,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

import {
  OneXBetLiveSnapshotExtractor,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveSnapshotExtractor";

async function main():
  Promise<void> {

  const url =
    process.env
      .ONEXBET_LIVE_URL ??
    "https://afg.1xbet.com/en/live/football";

  const client =
    new OneXBetLiveClient(
      url
    );

  const parser =
    new OneXBetLiveHtmlParser();

  const snapshotExtractor =
    new OneXBetLiveSnapshotExtractor();

  /*
   * Una sola descarga.
   */
  const html =
    await client
      .getLiveHtml();

  const games =
    parser.parse(
      html
    );

  console.log(
    "LIVE GAMES:",
    games.length
  );

  for (
    const game
    of games
  ) {

    const snapshot =
      snapshotExtractor
        .extract(
          html,
          game.id
        );

    if (!snapshot) {
      continue;
    }

    if (
      snapshot
        .capabilityLikeFields
        .hasHeadToHead !==
      true
    ) {
      continue;
    }

    console.log(
      "\n================================"
    );

    console.log(
      "H2H CANDIDATE"
    );

    console.log(
      "================================"
    );

    console.log(
      game.homeName,
      "vs",
      game.awayName
    );

    console.log(
      "ID:",
      game.id
    );

    console.log(
      "CHAMPIONSHIP:",
      game.championshipId
    );

    console.log(
      "COMPETITION:",
      game.competitionName
    );

    console.log(
      "\nCAPABILITIES:"
    );

    console.dir(
      snapshot
        .capabilityLikeFields,
      {
        depth:
          null,
      }
    );

    /*
     * El SnapshotExtractor YA aisló
     * correctamente el fragmento.
     *
     * Ahora inspeccionamos sus campos.
     */
    const interesting =
      Object.fromEntries(
        Object.entries(
          snapshot
            .debugPrimitiveFields
        )
          .filter(
            (
              [
                key,
              ]
            ) => {

              const value =
                key.toLowerCase();

              return (
                value.includes(
                  "url"
                ) ||
                value.includes(
                  "game"
                ) ||
                value.includes(
                  "opponent"
                ) ||
                value.includes(
                  "champ"
                ) ||
                value.includes(
                  "country"
                ) ||
                value.includes(
                  "head"
                ) ||
                value.includes(
                  "h2h"
                ) ||
                value.includes(
                  "lineup"
                ) ||
                value.includes(
                  "timeline"
                ) ||
                value.includes(
                  "history"
                ) ||
                value.includes(
                  "recent"
                ) ||
                value.includes(
                  "last"
                ) ||
                value.includes(
                  "form"
                ) ||
                value.includes(
                  "stat"
                )
              );
            }
          )
      );

    console.log(
      "\n================================"
    );

    console.log(
      "DETAIL FIELDS"
    );

    console.log(
      "================================"
    );

    console.dir(
      interesting,
      {
        depth:
          null,
      }
    );

    /*
     * Solo necesitamos un candidato.
     */
    return;
  }

  console.log(
    "\nNo current live match has hasHeadToHead=true."
  );
}

void main();
