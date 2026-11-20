
import "dotenv/config";

async function main(): Promise<void> {
  const query =
    process.argv.slice(2).join(" ").trim();

  if (!query) {
    throw new Error(
      "Debes indicar un texto de búsqueda"
    );
  }

  const url = new URL(
    "https://bol.1xbet.com/es/search-events"
  );

  url.searchParams.set(
    "searchtext",
    query
  );

  const response = await fetch(
    url,
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

        accept:
          "text/html,application/xhtml+xml",

        "accept-language":
          "es-BO,es;q=0.9,en;q=0.6",
      },

      signal:
        AbortSignal.timeout(20_000),
    }
  );

  const html = await response.text();

  const normalized = html
    .replace(/\\u002F/gi, "/")
    .replace(/&quot;/g, '"');

  console.log("\n========== HTTP ==========");
  console.log("Status:", response.status);
  console.log("URL final:", response.url);
  console.log("HTML bytes:", Buffer.byteLength(html));

  console.log("\n========== DATOS EMBEBIDOS ==========");

  const stores = [...new Set(
    [...normalized.matchAll(
      /normalizedDataItems-[a-zA-Z0-9/_-]+/g
    )].map(match => match[0])
  )];

  for (const store of stores.slice(0, 40)) {
    console.log(store);
  }

  console.log(
    "Total stores distintos:",
    stores.length
  );

  console.log("\n========== MARCADORES ==========");

  for (const marker of [
    "search-events",
    "searchtext",
    "dashboardStore-games",
    "Operário",
    "Operario",
    "Palmeiras",
    "Ferroviario",
  ]) {
    console.log(
      marker,
      normalized.toLowerCase()
        .includes(marker.toLowerCase())
    );
  }

  const matchLinks = [...new Set(
    [...normalized.matchAll(
      /\/(?:es|en)\/(?:live|line)\/football\/\d+-[a-z0-9-]+\/\d+-[a-z0-9-]+/g
    )].map(match => match[0])
  )];

  console.log("\n========== ENLACES DE PARTIDOS ==========");

  console.log(
    "Enlaces individuales encontrados:",
    matchLinks.length
  );

  for (const link of matchLinks.slice(0, 15)) {
    console.log(link);
  }
}

main().catch(error => {
  console.error(
    "[OneXBetSearchPage]",
    error
  );

  process.exitCode = 1;
});

