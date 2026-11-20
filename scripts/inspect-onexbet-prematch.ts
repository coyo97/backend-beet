import "dotenv/config";

import {
  OneXBetLiveHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";
import {
  OneXBetPrematchHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetPrematchHtmlParser";

async function main(): Promise<void> {

  const liveUrl =
    process.env.ONEXBET_LIVE_URL ??
    "https://afg.1xbet.com/en/live/football";

  const url =
    new URL(liveUrl);

  const prematchPath =
    url.pathname.replace(
      /\/live\/football(?:\/.*)?$/,
      "/line/football"
    );

  if (
    prematchPath === url.pathname
  ) {
    throw new Error(
      "No se pudo determinar la ruta prematch"
    );
  }

  url.pathname = prematchPath;
  url.search = "";
  url.hash = "";

  console.log(
    "Consultando:",
    url.toString()
  );

  const response =
    await fetch(
      url,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 Chrome/146 Safari/537.36",
          accept:
            "text/html",
          "accept-language":
            "en-US,en;q=0.9",
        },

        signal:
          AbortSignal.timeout(
            15_000
          ),
      }
    );

  console.log(
    "HTTP:",
    response.status
  );

  console.log(
    "URL final:",
    response.url
  );

  if (!response.ok) {
    return;
  }

  const html =
    await response.text();

  /*
 * DIAGNÓSTICO DE ESTRUCTURA PREMATCH
 *
 * Se analiza el HTML ya descargado.
 * No se hacen solicitudes adicionales.
 */

const normalizedHtml = html
  .replace(/&quot;/gi, '"')
  .replace(/&#34;/gi, '"')
  .replace(/\\u0022/gi, '"')
  .replace(/\\"/g, '"');

  const championships =
  extractStoreArray(
    normalizedHtml,
    "betting/home/line/dashboardStore-champs"
  );

console.log(
  "\n========== COMPETICIONES 1XBET =========="
);

console.log(
  "Competiciones recibidas:",
  championships.length
);

for (
  const item of championships.slice(0, 20)
) {
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    continue;
  }

  const champ =
    item as Record<string, unknown>;

  console.log({
    id:
      champ.id ?? champ.champId,

    name:
      champ.champName ?? champ.name,

    country:
      champ.countryName,

    sectionChampId:
      champ.sectionChampId,

    champNameForUrl:
      champ.champNameForUrl,

    fields:
      Object.keys(champ),
  });
}

console.log(
  "========== FIN COMPETICIONES =========="
);
  /*
 * Identificar los almacenes JSON
 * que contienen arrays.
 *
 * No realiza peticiones nuevas.
 */
const storeKeys = [
  ...normalizedHtml.matchAll(
    /"([^"]*normalizedDataItems[^"]*)"\s*:\s*\[/g
  ),
];

console.log(
  "\n========== ALMACENES JSON =========="
);

console.log(
  "Arrays encontrados:",
  storeKeys.length
);

for (const match of storeKeys.slice(0, 40)) {
  console.log(
    "KEY:",
    match[1]
  );
}

/*
 * Comprobar las rutas de datos
 * que aparecen en el HTML.
 */
console.log(
  "\n========== RUTAS DETECTADAS =========="
);

const paths = [
  "betting/home/live",
  "betting/home/line",
  "dashboardStore-games",
  "normalizedDataItems",
];

for (const path of paths) {
  console.log(
    path,
    normalizedHtml.includes(path)
  );
}

/*
 * Posición del primer encuentro
 * respecto a los almacenes.
 */
const firstGamePosition =
  normalizedHtml.indexOf(
    '"gameNameForUrl"'
  );

console.log(
  "\nPrimera posición de partido:",
  firstGamePosition
);

const previousStores =
  storeKeys.filter(
    match =>
      (match.index ?? -1) <
      firstGamePosition
  );

const closestStore =
  previousStores[
    previousStores.length - 1
  ];

console.log(
  "Almacén anterior más cercano:",
  closestStore?.[1] ?? "NO IDENTIFICADO"
);

const diagnosticFields = [
  "gameNameForUrl",
  "gameIdForUrl",
  "champNameForUrl",
  "sectionChampId",
  "sportId",
  "gameId",
  "firstOpponentName",
  "secondOpponentName",
  "firstOpponentFullName",
  "secondOpponentFullName",
  "startTimestamp",
  "startUnixTimestamp",
  "isLive",
  "isTop",
];

console.log(
  "\n========== ESTRUCTURA PREMATCH =========="
);

for (const field of diagnosticFields) {
  const expression = new RegExp(
    `"${field}"\\s*:`,
    "g"
  );

  const count = [
    ...normalizedHtml.matchAll(expression),
  ].length;

  console.log(
    `${field}: ${count}`
  );
}

/*
 * Encontrar ejemplos de nombres de
 * encuentros sin imprimir todo el HTML.
 */

const gameMarkers = [
  ...normalizedHtml.matchAll(
    /"gameNameForUrl"\s*:\s*"([^"]+)"/g
  ),
].slice(0, 8);

console.log(
  "\n--- POSIBLES ENCUENTROS ---"
);

for (const [index, marker] of gameMarkers.entries()) {
  const position = marker.index ?? 0;

  const fragment = normalizedHtml.slice(
    Math.max(0, position - 1200),
    Math.min(
      normalizedHtml.length,
      position + 800
    )
  );

  const nearbyKeys = [
    ...new Set(
      [...fragment.matchAll(
        /"([A-Za-z][A-Za-z0-9_]*)"\s*:/g
      )].map(match => match[1])
    ),
  ].slice(0, 45);

  console.log({
    number: index + 1,
    gameNameForUrl: marker[1],
    nearbyKeys,
  });
}

console.log(
  "\n========== FIN ESTRUCTURA =========="
);

  console.log(
    "HTML bytes:",
    Buffer.byteLength(html)
  );

  const fields = [
    "gameNameForUrl",
    "gameIdForUrl",
    "champNameForUrl",
    "sectionChampId",
    "startTimestamp",
    "startUnixTimestamp",
  ];

  console.log(
    "\nCAMPOS EN EL HTML"
  );

  for (const field of fields) {
    console.log(
      field,
      html.includes(field)
    );
  }

  /*
   * Reutilizamos el parser Live
   * únicamente como diagnóstico.
   *
   * No asumimos que su interpretación
   * sea correcta para prematch.
   */
  const parser =
    new OneXBetLiveHtmlParser();

  const games =
    parser.parse(html);

  console.log(
    "\nPartidos detectados con parser Live:",
    games.length
  );

  for (
    const game
    of games.slice(0, 10)
  ) {
    console.log({
      home: game.homeName,
      away: game.awayName,
      competition: game.competitionName,
      startAt: game.startAt,
      championshipId:
        game.championshipId,
      gameNameForUrl:
        game.gameNameForUrl,
      champNameForUrl:
        game.champNameForUrl,
    });
  }
  
  /*
 * Comprobar el nuevo parser
 * sobre el HTML ya descargado.
 */
const prematchParser =
  new OneXBetPrematchHtmlParser();

const prematchGames =
  prematchParser.parse(html);

const normalizedPrematchGames =
  prematchParser.parse(normalizedHtml);

console.log(
  "\n========== COMPARACIÓN =========="
);

console.log(
  "HTML original:",
  prematchGames.length
);

console.log(
  "HTML normalizado:",
  normalizedPrematchGames.length
);

console.log(
  "\n========== PREMATCH PARSER =========="
);

console.log(
  "Partidos interpretados:",
  prematchGames.length
);

for (
  const game of prematchGames.slice(0, 15)
) {

  console.log(
    JSON.stringify({
      home: game.homeName,
      away: game.awayName,
      competition:
        game.competitionName,
      country:
        game.countryName,
      kickoffAt:
        game.kickoffAt,
      id:
        game.id,
      gameNameForUrl:
        game.gameNameForUrl,
      champNameForUrl:
        game.champNameForUrl,
    }, null, 2)
  );
}
}

main().catch(error => {
  console.error(
    "[OneXBetPrematch]",
    error
  );

  process.exitCode = 1;
});

function extractStoreArray(
  source: string,
  suffix: string
): unknown[] {

  const matches = [
    ...source.matchAll(
      /"([^"]*normalizedDataItems[^"]*)"\s*:\s*\[/g
    ),
  ];

  const found = matches.find(match => {
    const key = match[1]
      .replace(/\\u002f/gi, "/")
      .replace(/\\\//g, "/");

    return key.endsWith(suffix);
  });

  if (!found) {
    return [];
  }

  const start =
    (found.index ?? 0) +
    found[0].lastIndexOf("[");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (
    let i = start;
    i < source.length;
    i++
  ) {

    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "[") {
      depth++;
    } else if (char === "]") {
      depth--;

      if (depth === 0) {
        const parsed: unknown =
          JSON.parse(source.slice(start, i + 1));

        return Array.isArray(parsed)
          ? parsed
          : [];
      }
    }
  }

  return [];
}
