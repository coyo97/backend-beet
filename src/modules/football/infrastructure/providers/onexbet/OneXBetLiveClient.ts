export class OneXBetLiveClient {
  constructor(
    private readonly url:
      string
  ) {}

  public async getLiveHtml():
    Promise<string> {

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
