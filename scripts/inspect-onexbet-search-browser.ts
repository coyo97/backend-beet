
import "dotenv/config";

import {
  chromium,
} from "playwright";

import readline from "node:readline/promises";

import {
  stdin as input,
  stdout as output,
} from "node:process";

interface NetworkEntry {
  method: string;
  status: number;
  type: string;
  host: string;
  path: string;
  params: string[];
  count: number;
}

async function main(): Promise<void> {
  const context =
    await chromium.launchPersistentContext(
      "/tmp/football-radar-onexbet-search-debug",
      {
        headless: false,
        viewport: {
          width: 1280,
          height: 900,
        },
      }
    );

  const page =
    context.pages()[0] ??
    await context.newPage();

  const requests =
    new Map<string, NetworkEntry>();

  let collecting = false;

  page.on("response", response => {
    if (!collecting) return;

    const request =
      response.request();

    const type =
      request.resourceType();

    if (
      type !== "fetch" &&
      type !== "xhr" &&
      type !== "document"
    ) {
      return;
    }

    try {
      const url =
        new URL(response.url());

      /*
       * Guardamos estructura de las
       * peticiones, no cookies ni tokens.
       */
      const key = [
        request.method(),
        response.status(),
        url.host,
        url.pathname,
      ].join(" ");

      const previous =
        requests.get(key);

      if (previous) {
        previous.count++;
        return;
      }

      requests.set(key, {
        method: request.method(),
        status: response.status(),
        type,
        host: url.host,
        path: url.pathname,
        params: [
          ...url.searchParams.keys(),
        ],
        count: 1,
      });

    } catch {
      // Ignorar URLs no reconocidas.
    }
  });

  const terminal =
    readline.createInterface({
      input,
      output,
    });

  try {
    const response = await page.goto(
      "https://bol.1xbet.com/es/live/football",
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }
    );

    console.log(
      "HTTP inicial:",
      response?.status()
    );

    console.log(
      "URL inicial:",
      page.url()
    );

    collecting = true;

    console.log(
      "\nEn la ventana de Chrome:"
    );

    console.log(
      "1. Abre el buscador de 1xBet."
    );

    console.log(
      "2. Busca Operário-PR U20 vs Palmeiras U20."
    );

    console.log(
      "3. Comprueba si aparecen los resultados."
    );

    await terminal.question(
      "\nCuando aparezcan los resultados, " +
      "pulsa ENTER aquí..."
    );

    collecting = false;

    const body =
      await page.locator("body")
        .innerText({
          timeout: 5000,
        })
        .catch(() => "");

    console.log(
      "\n========== PÁGINA =========="
    );

    console.log(
      "URL final:",
      page.url()
    );

    console.log(
      "Menciona Operário:",
      /oper[aá]rio/i.test(body)
    );

    console.log(
      "Menciona Palmeiras:",
      /palmeiras/i.test(body)
    );

    console.log(
      "\n========== PETICIONES =========="
    );

    for (
      const entry of [...requests.values()]
        .sort(
          (a, b) =>
            a.host.localeCompare(b.host) ||
            a.path.localeCompare(b.path)
        )
        .slice(0, 100)
    ) {
      console.log({
        method: entry.method,
        status: entry.status,
        type: entry.type,
        host: entry.host,
        path: entry.path,
        parameterNames: entry.params,
        count: entry.count,
      });
    }

  } finally {
    terminal.close();
    await context.close();
  }
}

main().catch(error => {
  console.error(
    "[OneXBetSearchBrowser]",
    error
  );

  process.exitCode = 1;
});

