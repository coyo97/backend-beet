import {
  SofascoreSessionClient,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreSessionClient";

type JsonRecord =
  Record<
    string,
    unknown
  >;

function collectTimeFields(
  value:
    unknown,

  path =
    "event",

  depth =
    0,

  result:
    Record<
      string,
      unknown
    > =
      {}
): Record<
  string,
  unknown
> {

  if (
    depth >
      6 ||
    value ===
      null ||
    value ===
      undefined
  ) {
    return result;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    value
      .slice(
        0,
        10
      )
      .forEach(
        (
          item,
          index
        ) => {
          collectTimeFields(
            item,
            `${path}[${index}]`,
            depth + 1,
            result
          );
        }
      );

    return result;
  }

  if (
    typeof value !==
    "object"
  ) {
    return result;
  }

  for (
    const [
      key,
      item,
    ]
    of Object.entries(
      value as
        JsonRecord
    )
  ) {

    const currentPath =
      `${path}.${key}`;

    if (
      /time|minute|period|clock|start|timestamp/i
        .test(
          key
        )
    ) {
      result[
        currentPath
      ] =
        item;
    }

    collectTimeFields(
      item,
      currentPath,
      depth + 1,
      result
    );
  }

  return result;
}

async function main():
  Promise<void> {

  const client =
    new SofascoreSessionClient();

  try {
    const events =
      await client
        .getLiveEvents();

    const live =
      events.filter(
        event =>
          event.status
            ?.type ===
          "inprogress"
      );

    console.log(
      "LIVE EVENTS:",
      live.length
    );

    for (
      const event
      of live.slice(
        0,
        8
      )
    ) {

      console.log(
        "\n======================================"
      );

      console.log(
        "EVENT:",
        event.id
      );

      console.log(
        "MATCH:",
        event.homeTeam
          ?.name,
        "-",
        event.awayTeam
          ?.name
      );

      console.log(
        "STATUS:",
        event.status
      );

      console.log(
        "START:",
        event.startTimestamp
      );

      console.log(
        "\nTIME FIELDS:"
      );

      console.dir(
        collectTimeFields(
          event
        ),
        {
          depth:
            null,
        }
      );
    }
  } finally {
    await client.stop();
  }
}

void main();
