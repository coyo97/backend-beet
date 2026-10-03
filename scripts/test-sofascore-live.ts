import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

import {
  SofascoreLiveDiscovery,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreLiveDiscovery";

async function main():
  Promise<void> {

  const browser =
    new SofascoreBrowser();

  const discovery =
    new SofascoreLiveDiscovery(
      browser
    );

  try {
    const matches =
      await discovery
        .discover();

    console.log(
      "\nTOTAL:",
      matches.length
    );

    console.log(
      "\n===== MATCHES =====\n"
    );

    matches
      .slice(
        0,
        100
      )
      .forEach(
        (
          match,
          index
        ) => {

          console.log(
            `${index + 1}. ${match.text}`
          );

          console.log(
            `   ${match.url}`
          );
        }
      );
  } finally {
    await browser.stop();
  }
}

void main();
