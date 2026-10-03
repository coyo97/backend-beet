import fs from "node:fs";

type JsonRecord =
  Record<
    string,
    unknown
  >;

function asRecord(
  value:
    unknown
): JsonRecord | null {

  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value as
    JsonRecord;
}

function looksLikeStandingRow(
  value:
    unknown
): boolean {

  const record =
    asRecord(
      value
    );

  if (!record) {
    return false;
  }

  const team =
    asRecord(
      record.team
    );

  return Boolean(
    team &&
    (
      record.position !==
        undefined ||
      record.points !==
        undefined ||
      record.matches !==
        undefined
    )
  );
}

function walk(
  value:
    unknown,

  path:
    string,

  depth =
    0
): void {

  if (
    depth >
      20 ||
    value ===
      null ||
    value ===
      undefined
  ) {
    return;
  }

  if (
    Array.isArray(
      value
    )
  ) {

    if (
      value.length >
        0 &&
      value.some(
        looksLikeStandingRow
      )
    ) {
      console.log(
        "\n================================"
      );

      console.log(
        "STANDINGS-LIKE ARRAY"
      );

      console.log(
        "PATH:",
        path
      );

      console.log(
        "ROWS:",
        value.length
      );

      console.dir(
        value.slice(
          0,
          15
        ),
        {
          depth:
            5,
        }
      );
    }

    value.forEach(
      (
        item,
        index
      ) => {

        walk(
          item,
          `${path}[${index}]`,
          depth +
            1
        );
      }
    );

    return;
  }

  const record =
    asRecord(
      value
    );

  if (!record) {
    return;
  }

  /*
   * Buscamos específicamente referencias
   * al grupo/fase del partido.
   */
  const serialized =
    JSON.stringify(
      record
    );

  if (
    serialized.includes(
      '"194069"'
    ) ||
    serialized.includes(
      ":194069"
    )
  ) {
    console.log(
      "\n--------------------------------"
    );

    console.log(
      "FOUND TOURNAMENT 194069"
    );

    console.log(
      "PATH:",
      path
    );

    console.dir(
      record,
      {
        depth:
          4,
      }
    );
  }

  for (
    const [
      key,
      child,
    ]
    of Object.entries(
      record
    )
  ) {
    walk(
      child,
      `${path}.${key}`,
      depth +
        1
    );
  }
}

function main(): void {

  const path =
    "/tmp/sofascore-event-next-data.json";

  const raw =
    fs.readFileSync(
      path,
      "utf8"
    );

  const payload:
    unknown =
    JSON.parse(
      raw
    );

  console.log(
    "FILE:",
    path
  );

  walk(
    payload,
    "$"
  );
}

main();
