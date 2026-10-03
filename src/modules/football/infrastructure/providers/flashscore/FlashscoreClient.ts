import {
  env,
} from "../../../../../config/env";

export class FlashscoreClient {
  public async get<T>(
    path: string,
    params:
      Record<string, string> = {}
  ): Promise<T> {

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
      of Object.entries(params)
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

    const data =
  await response.json();

return data as T;
  }
}
