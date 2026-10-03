import fs from "node:fs";

import type {
  Locator,
  Page,
} from "playwright";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

interface SearchResult {
  text:
    string;

  href:
    string;

  type:
    "team" |
    "tournament" |
    "match";
}

interface TournamentCandidate {
  id:
    string;

  name:
    string;

  slug:
    string | null;
}

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

function stringValue(
  value:
    unknown
): string | null {

  return typeof value ===
    "string"
    ? value.trim() ||
      null
    : null;
}

function idValue(
  value:
    unknown
): string | null {

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  ) {
    return String(
      value
    );
  }

  return stringValue(
    value
  );
}

function detectType(
  href:
    string
):
  SearchResult["type"] |
  null {

  if (
    /\/football\/team\/compare\/?$/i
      .test(
        href
      )
  ) {
    return null;
  }

  if (
    href.includes(
      "/football/team/"
    )
  ) {
    return "team";
  }

  if (
    href.includes(
      "/football/tournament/"
    )
  ) {
    return "tournament";
  }

  if (
    href.includes(
      "/football/match/"
    )
  ) {
    return "match";
  }

  return null;
}

function collectTournaments(
  value:
    unknown,

  output:
    Map<
      string,
      TournamentCandidate
    >,

  depth =
    0
): void {

  if (
    depth >
    12 ||
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
    for (
      const item
      of value
    ) {
      collectTournaments(
        item,
        output,
        depth +
          1
      );
    }

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
   * Sofascore normalmente usa:
   *
   * tournament.uniqueTournament
   *
   * o directamente:
   *
   * uniqueTournament
   */
  const directUnique =
    asRecord(
      record.uniqueTournament
    );

  if (directUnique) {
    addTournament(
      directUnique,
      output
    );
  }

  const tournament =
    asRecord(
      record.tournament
    );

  const nestedUnique =
    asRecord(
      tournament
        ?.uniqueTournament
    );

  if (nestedUnique) {
    addTournament(
      nestedUnique,
      output
    );
  }

  /*
   * Algunas páginas ya representan
   * directamente el unique tournament.
   */
  if (
    record.id !==
      undefined &&
    record.name !==
      undefined &&
    (
      record.slug !==
        undefined ||
      record.category !==
        undefined
    )
  ) {
    const name =
      stringValue(
        record.name
      );

    const slug =
      stringValue(
        record.slug
      );

    /*
     * Solo candidatos que parecen
     * competiciones.
     */
    if (
      name &&
      slug &&
      /league|liga|cup|copa|champ|division|premier|tournament|cmcl/i
        .test(
          `${name} ${slug}`
        )
    ) {
      addTournament(
        record,
        output
      );
    }
  }

  for (
    const child
    of Object.values(
      record
    )
  ) {
    collectTournaments(
      child,
      output,
      depth +
        1
    );
  }
}

function addTournament(
  record:
    JsonRecord,

  output:
    Map<
      string,
      TournamentCandidate
    >
): void {

  const id =
    idValue(
      record.id
    );

  const name =
    stringValue(
      record.name
    );

  if (
    !id ||
    !name
  ) {
    return;
  }

  output.set(
    id,
    {
      id,

      name,

      slug:
        stringValue(
          record.slug
        ),
    }
  );
}

async function openSearch(
  page:
    Page
): Promise<void> {

  const searchButton =
    page.getByRole(
      "button",
      {
        name:
          /Buscar en Sofascore|Search Sofascore/i,
      }
    )
      .first();

  if (
    await searchButton.count() ===
    0
  ) {
    throw new Error(
      "Sofascore search button not found"
    );
  }

  await searchButton.click({
    timeout:
      10_000,
  });

  await page.waitForTimeout(
    400
  );
}

async function getSearchInput(
  page:
    Page
): Promise<
  Locator
> {

  /*
   * Sofascore normalmente deja enfocado
   * el campo del buscador al abrir el modal.
   *
   * Esta es nuestra primera opción.
   */
  const focusedInput =
    page.locator(
      [
        "input:focus",
        ':not([type="radio"])',
        ':not([type="checkbox"])',
        ':not([type="hidden"])',
        ':not([type="button"])',
        ':not([type="submit"])',
      ].join(
        ""
      )
    );

  if (
    await focusedInput.count() >
      0
  ) {
    const input =
      focusedInput.first();

    if (
      await input
        .isEditable()
        .catch(
          () =>
            false
        )
    ) {
      console.log(
        "[SofascoreSearch] using focused input"
      );

      return input;
    }
  }

  /*
   * Fallback:
   * solamente inputs que puedan
   * comportarse como textbox.
   *
   * Excluimos radio, checkbox, etc.
   */
  const candidates =
    page.locator(
      [
        "input:visible",
        ':not([type="radio"])',
        ':not([type="checkbox"])',
        ':not([type="hidden"])',
        ':not([type="button"])',
        ':not([type="submit"])',
        ':not([type="file"])',
        ':not([type="range"])',
      ].join(
        ""
      )
    );

  const count =
    await candidates.count();

  let editableFallback:
    Locator | null =
    null;

  for (
    let index =
      0;

    index <
      count;

    index +=
      1
  ) {
    const candidate =
      candidates.nth(
        index
      );

    const editable =
      await candidate
        .isEditable()
        .catch(
          () =>
            false
        );

    if (!editable) {
      continue;
    }

    if (!editableFallback) {
      editableFallback =
        candidate;
    }

    const type =
      (
        await candidate
          .getAttribute(
            "type"
          )
      ) ??
      "text";

    const placeholder =
      (
        await candidate
          .getAttribute(
            "placeholder"
          )
      ) ??
      "";

    const ariaLabel =
      (
        await candidate
          .getAttribute(
            "aria-label"
          )
      ) ??
      "";

    const name =
      (
        await candidate
          .getAttribute(
            "name"
          )
      ) ??
      "";

    const description =
      [
        type,
        placeholder,
        ariaLabel,
        name,
      ]
        .join(
          " "
        )
        .toLowerCase();

    /*
     * Preferimos explícitamente algo
     * que Sofascore identifique como
     * búsqueda.
     */
    if (
      /search|buscar|busqueda|búsqueda|find/
        .test(
          description
        )
    ) {
      console.log(
        "[SofascoreSearch] search input:",
        {
          index,
          type,
          placeholder,
          ariaLabel,
          name,
        }
      );

      return candidate;
    }
  }

  /*
   * Si solo existe un textbox editable
   * pero Sofascore no le puso placeholder
   * descriptivo, todavía podemos usarlo.
   */
  if (
    editableFallback
  ) {
    console.log(
      "[SofascoreSearch] using editable fallback"
    );

    return editableFallback;
  }

  throw new Error(
    "Editable Sofascore search input not found"
  );
}

function normalizeSearchText(
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
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function isRelatedToQuery(
  query:
    string,

  text:
    string
): boolean {

  const normalizedQuery =
    normalizeSearchText(
      query
    );

  const normalizedText =
    normalizeSearchText(
      text
    );

  if (
    !normalizedQuery ||
    !normalizedText
  ) {
    return false;
  }

  /*
   * Coincidencia completa.
   */
  if (
    normalizedText.includes(
      normalizedQuery
    ) ||
    normalizedQuery.includes(
      normalizedText
    )
  ) {
    return true;
  }

  /*
   * Coincidencia por palabras importantes.
   *
   * Ej:
   * Guangdong Chenxing
   * Guangdong Chenxing Juli
   */
  const queryTokens =
    normalizedQuery
      .split(
        " "
      )
      .filter(
        (
          token
        ) =>
          token.length >=
          3
      );

  const textTokens =
    new Set(
      normalizedText
        .split(
          " "
        )
    );

  const matches =
    queryTokens.filter(
      (
        token
      ) =>
        textTokens.has(
          token
        )
    );

  if (
    queryTokens.length ===
    0
  ) {
    return false;
  }

  return (
    matches.length /
      queryTokens.length
  ) >=
    0.5;
}

async function search(
  page:
    Page,

  query:
    string
): Promise<
  SearchResult[]
> {

  const input =
    await getSearchInput(
      page
    );

  console.log(
    "[SofascoreSearch] input:",
    {
      placeholder:
        await input.getAttribute(
          "placeholder"
        ),

      ariaLabel:
        await input.getAttribute(
          "aria-label"
        ),

      type:
        await input.getAttribute(
          "type"
        ),
    }
  );

  await input.fill(
    ""
  );

  await input.fill(
    query
  );

  await page.waitForTimeout(
    1500
  );

  console.log(
    "[SofascoreSearch] value:",
    await input.inputValue()
  );

  /*
   * Primero buscamos un contenedor
   * específico del buscador.
   */
  const candidateScopes =
    [
      '[role="dialog"]:visible',
      '[role="listbox"]:visible',
      '[data-testid*="search"]:visible',
    ];

  let scope:
    Locator =
      page.locator(
        "body"
      );

  for (
    const selector
    of candidateScopes
  ) {
    const candidates =
      page.locator(
        selector
      );

    const count =
      await candidates.count();

    for (
      let index =
        0;

      index <
        count;

      index +=
        1
    ) {
      const candidate =
        candidates.nth(
          index
        );

      const resultLinks =
        candidate.locator(
          [
            'a[href*="/football/team/"]',
            'a[href*="/football/tournament/"]',
            'a[href*="/football/match/"]',
          ].join(
            ","
          )
        );

      if (
        await resultLinks.count() >
        0
      ) {
        scope =
          candidate;

        console.log(
          "[SofascoreSearch] scope:",
          selector,
          index
        );

        break;
      }
    }

    if (
      scope !==
      page.locator(
        "body"
      )
    ) {
      break;
    }
  }

  const links =
    scope.locator(
      [
        'a:visible[href*="/football/team/"]',
        'a:visible[href*="/football/tournament/"]',
        'a:visible[href*="/football/match/"]',
      ].join(
        ","
      )
    );

  const count =
    await links.count();

  const result =
    new Map<
      string,
      SearchResult
    >();

  for (
    let index =
      0;

    index <
      count;

    index +=
      1
  ) {
    const link =
      links.nth(
        index
      );

    const href =
      await link.getAttribute(
        "href"
      );

    if (!href) {
      continue;
    }

    /*
     * Esto fue exactamente el falso
     * positivo que acabamos de encontrar.
     */
    if (
      /\/football\/team\/compare\/?$/i
        .test(
          href
        )
    ) {
      continue;
    }

    const type =
      detectType(
        href
      );

    if (!type) {
      continue;
    }

    const text =
      (
        await link
          .innerText()
          .catch(
            () =>
              ""
          )
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (!text) {
      continue;
    }

    /*
     * Para discovery de equipos no
     * aceptamos links genéricos de la
     * página como Premier League,
     * Champions, partidos destacados, etc.
     */
    if (
      !isRelatedToQuery(
        query,
        text
      )
    ) {
      continue;
    }

    result.set(
      href,
      {
        text,
        href,
        type,
      }
    );
  }

  return Array.from(
    result.values()
  )
    .slice(
      0,
      25
    );
}

async function inspectTeam(
  page:
    Page,

  result:
    SearchResult
): Promise<
  TournamentCandidate[]
> {

  const url =
    result.href.startsWith(
      "http"
    )
      ? result.href
      : `https://www.sofascore.com${result.href}`;

  await page.goto(
    url,
    {
      waitUntil:
        "domcontentloaded",

      timeout:
        30_000,
    }
  );

  await page.waitForTimeout(
    1000
  );

  const nextData =
    page.locator(
      "script#__NEXT_DATA__"
    );

  await nextData.waitFor({
    state:
      "attached",

    timeout:
      15_000,
  });

  const raw =
    await nextData
      .textContent();

  if (!raw) {
    return [];
  }

  const payload:
    unknown =
    JSON.parse(
      raw
    );

  const tournaments =
    new Map<
      string,
      TournamentCandidate
    >();

  collectTournaments(
    payload,
    tournaments
  );

  return Array.from(
    tournaments.values()
  );
}

function printResults(
  title:
    string,

  results:
    SearchResult[]
): void {

  console.log(
    `\n===== ${title} =====`
  );

  results.forEach(
    (
      item,
      index
    ) => {

      console.log(
        `${index + 1}. [${item.type}] ${item.text}`
      );

      console.log(
        `   ${item.href}`
      );
    }
  );
}

function printTournaments(
  title:
    string,

  tournaments:
    TournamentCandidate[]
): void {

  console.log(
    `\n===== ${title} COMPETITIONS =====`
  );

  tournaments.forEach(
    (
      tournament,
      index
    ) => {

      console.log(
        `${index + 1}. ${tournament.name}`
      );

      console.log(
        `   id=${tournament.id}`
      );

      console.log(
        `   slug=${tournament.slug ?? "-"}`
      );
    }
  );
}

async function main():
  Promise<void> {

  const homeQuery =
    process.argv[2];

  const awayQuery =
    process.argv[3];

  if (
    !homeQuery ||
    !awayQuery
  ) {
    console.error(
      "Usage:"
    );

    console.error(
      'npx tsx scripts/inspect-sofascore-team-search.ts "HOME" "AWAY"'
    );

    process.exitCode =
      1;

    return;
  }

  const browser =
    new SofascoreBrowser();

  try {
    const page =
      await browser
        .getPage();

    await page.goto(
      "https://www.sofascore.com/es/",
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          30_000,
      }
    );

    await page.waitForTimeout(
      1000
    );

    await openSearch(
      page
    );

    const homeResults =
      await search(
        page,
        homeQuery
      );

    printResults(
      "HOME SEARCH",
      homeResults
    );

    const homeTeam =
      homeResults.find(
        (
          item
        ) =>
          item.type ===
          "team"
      );

    /*
     * Volvemos a portada porque
     * inspectTeam navegará fuera.
     */
    let homeTournaments:
      TournamentCandidate[] =
      [];

    if (homeTeam) {
      homeTournaments =
        await inspectTeam(
          page,
          homeTeam
        );

      printTournaments(
        homeQuery,
        homeTournaments
      );
    }

    await page.goto(
      "https://www.sofascore.com/es/",
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          30_000,
      }
    );

    await page.waitForTimeout(
      800
    );

    await openSearch(
      page
    );

    const awayResults =
      await search(
        page,
        awayQuery
      );

    printResults(
      "AWAY SEARCH",
      awayResults
    );

    const awayTeam =
      awayResults.find(
        (
          item
        ) =>
          item.type ===
          "team"
      );

    let awayTournaments:
      TournamentCandidate[] =
      [];

    if (awayTeam) {
      awayTournaments =
        await inspectTeam(
          page,
          awayTeam
        );

      printTournaments(
        awayQuery,
        awayTournaments
      );
    }

    const awayIds =
      new Set(
        awayTournaments.map(
          (
            item
          ) =>
            item.id
        )
      );

    const common =
      homeTournaments.filter(
        (
          item
        ) =>
          awayIds.has(
            item.id
          )
      );

    console.log(
      "\n================================"
    );

    console.log(
      "COMMON COMPETITIONS:",
      common.length
    );

    console.log(
      "================================"
    );

    printTournaments(
      "COMMON",
      common
    );

    fs.writeFileSync(
      "/tmp/sofascore-team-discovery.json",
      JSON.stringify(
        {
          homeQuery,
          awayQuery,
          homeResults,
          awayResults,
          homeTournaments,
          awayTournaments,
          common,
        },
        null,
        2
      ),
      "utf8"
    );

    console.log(
      "\nSAVED:"
    );

    console.log(
      "/tmp/sofascore-team-discovery.json"
    );
  } finally {
    await browser.stop();
  }
}

void main();
