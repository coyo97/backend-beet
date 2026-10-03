interface Candidate {
  url:
    string;

  source:
    "direct" |
    "duckduckgo-redirect";
}

function decodeHtml(
  value:
    string
): string {

  return value
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&#x27;/g,
      "'"
    );
}

function normalizeCandidate(
  rawHref:
    string
): Candidate | null {

  const href =
    decodeHtml(
      rawHref
    );

  /*
   * Resultado directo.
   */
  if (
    href.startsWith(
      "https://www.sofascore.com/"
    ) ||
    href.startsWith(
      "https://sofascore.com/"
    )
  ) {
    return {
      url:
        href,

      source:
        "direct",
    };
  }

  /*
   * DuckDuckGo suele redireccionar mediante:
   *
   * /l/?uddg=https%3A...
   */
  try {
    const absolute =
      href.startsWith(
        "//"
      )
        ? `https:${href}`
        : href.startsWith(
            "/"
          )
          ? `https://duckduckgo.com${href}`
          : href;

    const url =
      new URL(
        absolute
      );

    const uddg =
      url.searchParams.get(
        "uddg"
      );

    if (!uddg) {
      return null;
    }

    const decoded =
      decodeURIComponent(
        uddg
      );

    if (
      decoded.startsWith(
        "https://www.sofascore.com/"
      ) ||
      decoded.startsWith(
        "https://sofascore.com/"
      )
    ) {
      return {
        url:
          decoded,

        source:
          "duckduckgo-redirect",
      };
    }
  } catch {
    return null;
  }

  return null;
}

function extractCandidates(
  html:
    string
): Candidate[] {

  const hrefRegex =
    /href=["']([^"']+)["']/gi;

  const result =
    new Map<
      string,
      Candidate
    >();

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        hrefRegex.exec(
          html
        )
    ) !==
    null
  ) {
    const candidate =
      normalizeCandidate(
        match[1]
      );

    if (!candidate) {
      continue;
    }

    result.set(
      candidate.url,
      candidate
    );
  }

  return Array.from(
    result.values()
  );
}

async function searchDuckDuckGo(
  query:
    string
): Promise<
  Candidate[]
> {

  const url =
    new URL(
      "https://html.duckduckgo.com/html/"
    );

  url.searchParams.set(
    "q",
    query
  );

  console.log(
    "\n================================"
  );

  console.log(
    "QUERY:"
  );

  console.log(
    query
  );

  console.log(
    "================================"
  );

  const response =
    await fetch(
      url,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

          "accept-language":
            "en-US,en;q=0.9",
        },
      }
    );

  console.log(
    "STATUS:",
    response.status
  );

  console.log(
    "CONTENT-TYPE:",
    response.headers.get(
      "content-type"
    )
  );

  const html =
    await response.text();

  console.log(
    "BYTES:",
    html.length
  );

  /*
   * Guardamos la respuesta para poder
   * inspeccionarla si cambia el HTML.
   */
  await import(
    "node:fs/promises"
  )
    .then(
      (
        fs
      ) =>
        fs.writeFile(
          "/tmp/sofascore-ddg.html",
          html,
          "utf8"
        )
    );

  if (
    !response.ok
  ) {
    console.log(
      html.slice(
        0,
        1000
      )
    );

    return [];
  }

  return extractCandidates(
    html
  );
}

function isInteresting(
  url:
    string
): boolean {

  return (
    url.includes(
      "/football/match/"
    ) ||
    url.includes(
      "/football/team/"
    ) ||
    url.includes(
      "/football/tournament/"
    )
  );
}

async function main():
  Promise<void> {

  const home =
    process.argv[2];

  const away =
    process.argv[3];

  if (
    !home ||
    !away
  ) {
    console.error(
      "Usage:"
    );

    console.error(
      'npx tsx scripts/inspect-sofascore-web-discovery.ts "HOME" "AWAY"'
    );

    process.exitCode =
      1;

    return;
  }

  /*
   * Empezamos por el candidato más valioso:
   * una página del partido exacto.
   */
  const queries =
    [
      `site:sofascore.com/football/match "${home}" "${away}"`,

      /*
       * Algunos índices no conservan exactamente
       * los nombres o el orden del encuentro.
       */
      `site:sofascore.com "${home}" "${away}"`,

      /*
       * Candidatos individuales como fallback.
       */
      `site:sofascore.com/football/team "${home}"`,

      `site:sofascore.com/football/team "${away}"`,
    ];

  const all =
    new Map<
      string,
      Candidate
    >();

  for (
    const query
    of queries
  ) {
    const candidates =
      await searchDuckDuckGo(
        query
      );

    console.log(
      "\nCANDIDATES:",
      candidates.length
    );

    for (
      const candidate
      of candidates
    ) {
      if (
        !isInteresting(
          candidate.url
        )
      ) {
        continue;
      }

      console.log(
        `[${candidate.source}]`
      );

      console.log(
        candidate.url
      );

      all.set(
        candidate.url,
        candidate
      );
    }

    /*
     * No golpeamos el buscador demasiado rápido.
     */
    await new Promise(
      (
        resolve
      ) =>
        setTimeout(
          resolve,
          800
        )
    );
  }

  console.log(
    "\n================================"
  );

  console.log(
    "TOTAL SOFASCORE CANDIDATES:",
    all.size
  );

  console.log(
    "================================"
  );

  let index =
    1;

  for (
    const candidate
    of all.values()
  ) {
    console.log(
      `${index}. ${candidate.url}`
    );

    index +=
      1;
  }
}

void main();
