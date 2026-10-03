import type {
  MatchStatisticMetric,
  MatchStatisticValue,
} from "../../../domain/entities/MatchStatistics";

export class FlashscoreStatisticsParser {
  public parse(
    data: unknown
  ): MatchStatisticMetric[] {

    const found:
      MatchStatisticMetric[] = [];

    this.walk(
      data,
      found
    );

    return this.deduplicate(
      found
    );
  }

  private walk(
    value: unknown,
    found:
      MatchStatisticMetric[]
  ): void {

    if (
      Array.isArray(value)
    ) {
      for (
        const item
        of value
      ) {
        this.walk(
          item,
          found
        );
      }

      return;
    }

    if (
      !value ||
      typeof value !==
      "object"
    ) {
      return;
    }

    const obj =
      value as Record<
        string,
        unknown
      >;

    const metric =
      this.tryMetric(
        obj
      );

    if (metric) {
      found.push(
        metric
      );
    }

    for (
      const child
      of Object.values(
        obj
      )
    ) {
      this.walk(
        child,
        found
      );
    }
  }

  private tryMetric(
    obj:
      Record<
        string,
        unknown
      >
  ): MatchStatisticMetric | null {

    const label =
      this.firstString(
        obj[
          "name"
        ],
        obj[
          "label"
        ],
        obj[
          "category"
        ],
        obj[
          "statistic"
        ],
        obj[
          "title"
        ]
      );

    if (!label) {
      return null;
    }

    const homeRaw =
      obj[
        "home"
      ] ??
      obj[
        "homeValue"
      ] ??
      obj[
        "home_value"
      ];

    const awayRaw =
      obj[
        "away"
      ] ??
      obj[
        "awayValue"
      ] ??
      obj[
        "away_value"
      ];

    if (
      homeRaw == null ||
      awayRaw == null
    ) {
      return null;
    }

    return {
      key:
        this.normalizeKey(
          label
        ),

      label,

      home:
        this.toValue(
          homeRaw
        ),

      away:
        this.toValue(
          awayRaw
        ),
    };
  }

  private toValue(
    value: unknown
  ): MatchStatisticValue {

    const raw =
      typeof value ===
        "string" ||
      typeof value ===
        "number"
        ? value
        : String(
            value ?? ""
          );

    const numeric =
      this.parseNumber(
        raw
      );

    return {
      raw,
      numeric,
    };
  }

  private parseNumber(
    value:
      string |
      number
  ): number | null {

    if (
      typeof value ===
      "number"
    ) {
      return Number.isFinite(
        value
      )
        ? value
        : null;
    }

    const clean =
      value
        .replace(
          "%",
          ""
        )
        .replace(
          ",",
          "."
        )
        .trim();

    const match =
      clean.match(
        /-?\d+(?:\.\d+)?/
      );

    if (!match) {
      return null;
    }

    const number =
      Number(
        match[0]
      );

    return Number.isFinite(
      number
    )
      ? number
      : null;
  }

  private firstString(
    ...values: unknown[]
  ): string | null {

    for (
      const value
      of values
    ) {
      if (
        typeof value ===
          "string" &&
        value.trim()
      ) {
        return value.trim();
      }
    }

    return null;
  }

  private normalizeKey(
    value: string
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
        "_"
      )
      .replace(
        /^_+|_+$/g,
        ""
      );
  }

  private deduplicate(
    metrics:
      MatchStatisticMetric[]
  ): MatchStatisticMetric[] {

    const map =
      new Map<
        string,
        MatchStatisticMetric
      >();

    for (
      const metric
      of metrics
    ) {
      if (
        !map.has(
          metric.key
        )
      ) {
        map.set(
          metric.key,
          metric
        );
      }
    }

    return [
      ...map.values(),
    ];
  }
}
