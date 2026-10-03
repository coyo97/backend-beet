import {
  OneXBetLiveClient,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

type Primitive =
  string |
  number |
  boolean |
  null;

function extractPrimitiveFields(
  fragment:
    string
): Record<
  string,
  Primitive
> {

  const result:
    Record<
      string,
      Primitive
    > =
      {};

  const stringRegex =
    /"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;

  for (
    const match
    of fragment.matchAll(
      stringRegex
    )
  ) {
    if (
      result[
        match[1]
      ] ===
      undefined
    ) {
      result[
        match[1]
      ] =
        match[2]
          .replace(
            /\\"/g,
            '"'
          )
          .replace(
            /\\\//g,
            "/"
          );
    }
  }

  const numberRegex =
    /"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*(-?\d+(?:\.\d+)?)(?=\s*[,}])/g;

  for (
    const match
    of fragment.matchAll(
      numberRegex
    )
  ) {
    if (
      result[
        match[1]
      ] !==
      undefined
    ) {
      continue;
    }

    const value =
      Number(
        match[2]
      );

    if (
      Number.isFinite(
        value
      )
    ) {
      result[
        match[1]
      ] =
        value;
    }
  }

  const primitiveRegex =
    /"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*(true|false|null)(?=\s*[,}])/g;

  for (
    const match
    of fragment.matchAll(
      primitiveRegex
    )
  ) {
    if (
      result[
        match[1]
      ] !==
      undefined
    ) {
      continue;
    }

    result[
      match[1]
    ] =
      match[2] ===
        "true"
        ? true
        : match[2] ===
            "false"
          ? false
          : null;
  }

  return result;
}

async function main():
  Promise<void> {

  const externalId =
    process.argv[2];

  if (!externalId) {
    console.error(
      "Usage: npx tsx scripts/inspect-onexbet-game-detail-fields.ts MATCH_ID"
    );

    process.exitCode =
      1;

    return;
  }

  const url =
    process.env
      .ONEXBET_LIVE_URL ??
    "https://afg.1xbet.com/en/live/football";

  const client =
    new OneXBetLiveClient(
      url
    );

  const html =
    await client
      .getLiveHtml();

  const markers = [
    `"gameId":${externalId}`,
    `"gameId":"${externalId}"`,
    `"gameIdForUrl":"${externalId}"`,
    `"id":${externalId}`,
    `"id":"${externalId}"`,
  ];

  let index =
    -1;

  for (
    const marker
    of markers
  ) {
    index =
      html.indexOf(
        marker
      );

    if (
      index !==
      -1
    ) {
      console.log(
        "FOUND MARKER:",
        marker
      );

      break;
    }
  }

  if (
    index ===
    -1
  ) {
    console.error(
      "Match fragment not found"
    );

    return;
  }

  const previousGame =
    html.lastIndexOf(
      '"sportId":1',
      index
    );

  const nextGame =
    html.indexOf(
      '"sportId":1',
      index +
        1
    );

  const start =
    previousGame !==
      -1
      ? Math.max(
          0,
          previousGame -
            1000
        )
      : Math.max(
          0,
          index -
            8000
        );

  const end =
    nextGame !==
      -1
      ? nextGame
      : Math.min(
          html.length,
          index +
            20000
        );

  const fragment =
    html.slice(
      start,
      end
    );

  const fields =
    extractPrimitiveFields(
      fragment
    );

  const interesting =
    Object.fromEntries(
      Object.entries(
        fields
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
                "name"
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
                "stat"
              ) ||
              value.includes(
                "game"
              ) ||
              value.includes(
                "champ"
              ) ||
              value.includes(
                "opponent"
              )
            );
          }
        )
    );

  console.dir(
    interesting,
    {
      depth:
        null,
    }
  );
}

void main();
