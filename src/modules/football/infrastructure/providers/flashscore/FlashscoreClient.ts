import {
  env,
} from "../../../../../config/env";

export class FlashscoreClient {

  constructor(
    private readonly isEnabled:
      () =>
        Promise<boolean> =
      async () =>
        true
  ) {}

  public async get<T>(
    path:
      string,

    params:
      Record<
        string,
        string
      > = {}
  ): Promise<T> {

    if (
      !(await this.isEnabled())
    ) {
      throw new Error(
        "Flashscore provider is disabled"
      );
    }

    const url =
      new URL(
        path,
        env.FLASHSCORE_BASE_URL
      );

    for (
      const [
        key,
        value,
      ]
      of Object.entries(
        params
      )
    ) {
      url.searchParams.set(
        key,
        value
      );
    }

    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              "application/json",
          },

          signal:
            AbortSignal.timeout(
              120_000
            ),
        }
      );

    if (!response.ok) {
      const body =
        await response.text();

      throw new Error(
        `Flashscore HTTP ${response.status}: ${body.slice(
          0,
          500
        )}`
      );
    }

    return await response
      .json() as T;
  }
}
