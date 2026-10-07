export class OneXBetLiveClient {
  private htmlCache:
    string | null =
      null;

  private expiresAt =
    0;

  private inflight:
    Promise<string> | null =
      null;

  constructor(
    private readonly url:
      string,

    private readonly cacheMs =
      15_000
  ) {}

  public async getLiveHtml():
    Promise<string> {

    const now =
      Date.now();

    if (
      this.htmlCache &&
      this.expiresAt >
        now
    ) {
      console.log(
        "[OneXBetLiveClient]",
        "cache-hit"
      );

      return this.htmlCache;
    }

    if (
      this.inflight
    ) {
      console.log(
        "[OneXBetLiveClient]",
        "inflight-hit"
      );

      return this.inflight;
    }

    const running =
      this.fetchLiveHtml();

    this.inflight =
      running;

    try {
      const html =
        await running;

      this.htmlCache =
        html;

      this.expiresAt =
        Date.now() +
        this.cacheMs;

      return html;
    } finally {
      if (
        this.inflight ===
        running
      ) {
        this.inflight =
          null;
      }
    }
  }

  public invalidate():
    void {

    this.htmlCache =
      null;

    this.expiresAt =
      0;
  }

  private async fetchLiveHtml():
    Promise<string> {

    console.log(
      "[OneXBetLiveClient]",
      "network"
    );

    const response =
      await fetch(
        this.url,
        {
          headers: {
            "user-agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

            accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

            "accept-language":
              "en-US,en;q=0.9",
          },

          signal:
            AbortSignal.timeout(
              15_000
            ),
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `1xBet live page HTTP ${response.status}`
      );
    }

    return response.text();
  }
}
