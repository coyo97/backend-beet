import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

export class SofascoreBrowser {
  private browser:
    Browser | null =
    null;

  private context:
    BrowserContext | null =
    null;

  private page:
    Page | null =
    null;

  public async start():
    Promise<void> {

    if (this.browser) {
      return;
    }

    this.browser =
      await chromium.launch({
        headless:
          true,
      });

    this.context =
      await this.browser
        .newContext({
          locale:
            "es-ES",

          timezoneId:
            "America/La_Paz",

          viewport: {
            width:
              1365,

            height:
              900,
          },
        });

    this.page =
      await this.context
        .newPage();

    console.log(
      "[SofascoreBrowser] started"
    );
  }

  public async getPage():
    Promise<Page> {

    await this.start();

    if (!this.page) {
      throw new Error(
        "Sofascore browser page not available"
      );
    }

    return this.page;
  }

  public async stop():
    Promise<void> {

    await this.context
      ?.close()
      .catch(
        () => undefined
      );

    await this.browser
      ?.close()
      .catch(
        () => undefined
      );

    this.page =
      null;

    this.context =
      null;

    this.browser =
      null;

    console.log(
      "[SofascoreBrowser] stopped"
    );
  }
}
