import json
import urllib.error
import urllib.parse
import urllib.request


BASE = "http://localhost:8000/api/v1"


TEAM_FIELDS = [
    "position",
    "points",
    "played",
    "wins",
    "draws",
    "losses",
    "goalsFor",
    "goalsAgainst",
    "goalDifference",
    "goalsPerMatch",
    "concededPerMatch",
]


def get_json(url):
    try:
        with urllib.request.urlopen(
            url,
            timeout=30,
        ) as response:
            return json.loads(
                response.read()
            )

    except urllib.error.HTTPError as error:
        body = error.read().decode(
            "utf-8",
            errors="replace",
        )

        return {
            "_error": (
                f"HTTP {error.code}: "
                f"{body[:300]}"
            )
        }

    except Exception as error:
        return {
            "_error": str(error)
        }


def context_url(
    provider,
    external_id,
):
    provider = urllib.parse.quote(
        provider,
        safe="",
    )

    external_id = urllib.parse.quote(
        str(external_id),
        safe="",
    )

    return (
        f"{BASE}/football/"
        f"matches/"
        f"{provider}/"
        f"{external_id}/context"
    )


def team_stats_count(team):
    return sum(
        1
        for field in TEAM_FIELDS
        if team.get(field)
        is not None
    )


def form_count(team):
    value = team.get(
        "form"
    )

    if not isinstance(
        value,
        list,
    ):
        return 0

    return min(
        len(value),
        5,
    )


def recent_count(team):
    value = team.get(
        "recentMatches"
    )

    if not isinstance(
        value,
        list,
    ):
        return 0

    return min(
        len(value),
        5,
    )


def summarize_context(
    payload,
):
    if "_error" in payload:
        return {
            "error":
                payload["_error"],
        }

    context = payload.get(
        "context"
    )

    if not context:
        return {
            "error":
                "context missing",
        }

    home = context.get(
        "home"
    ) or {}

    away = context.get(
        "away"
    ) or {}

    source = context.get(
        "source"
    ) or {}

    lineups = context.get(
        "lineups"
    ) or {}

    table_fields = (
        team_stats_count(
            home
        )
        +
        team_stats_count(
            away
        )
    )

    form_items = (
        form_count(
            home
        )
        +
        form_count(
            away
        )
    )

    recent_items = (
        recent_count(
            home
        )
        +
        recent_count(
            away
        )
    )

    lineup_score = 0

    if (
        lineups.get(
            "status"
        )
        not in (
            None,
            "unavailable",
        )
    ):
        lineup_score += 1

    if (
        lineups.get(
            "homeFormation"
        )
        is not None
    ):
        lineup_score += 1

    if (
        lineups.get(
            "awayFormation"
        )
        is not None
    ):
        lineup_score += 1

    total = (
        table_fields
        +
        form_items
        +
        recent_items
        +
        lineup_score
    )

    return {
        "error":
            None,

        "returnedProvider":
            source.get(
                "provider"
            ),

        "tableFields":
            table_fields,

        "formItems":
            form_items,

        "recentMatches":
            recent_items,

        "lineups":
            lineup_score,

        "total":
            total,

        "home":
            home,

        "away":
            away,
    }


def print_summary(
    label,
    summary,
):
    if summary.get(
        "error"
    ):
        print(
            f"{label:<11}",
            "ERROR:",
            summary["error"],
        )

        return

    print(
        f"{label:<11}",
        f"real={summary['returnedProvider']:<10}",
        f"tabla={summary['tableFields']:>2}/22",
        f"forma={summary['formItems']:>2}/10",
        f"ultimos={summary['recentMatches']:>2}/10",
        f"XI={summary['lineups']}/3",
        f"TOTAL={summary['total']}",
    )


def main():
    live = get_json(
        f"{BASE}/football/live"
    )

    if "_error" in live:
        print(
            "ERROR LIVE:",
            live["_error"],
        )
        return

    matches = live.get(
        "matches",
        [],
    )

    overlapping = []

    for match in matches:
        flashscore = next(
            (
                source
                for source
                in match.get(
                    "sources",
                    [],
                )
                if source.get(
                    "provider"
                )
                ==
                "flashscore"
            ),
            None,
        )

        sofascore = next(
            (
                source
                for source
                in match.get(
                    "sources",
                    [],
                )
                if source.get(
                    "provider"
                )
                ==
                "sofascore"
            ),
            None,
        )

        if (
            flashscore
            and
            sofascore
        ):
            overlapping.append(
                (
                    match,
                    flashscore,
                    sofascore,
                )
            )

    print(
        "PARTIDOS LIVE:",
        len(matches),
    )

    print(
        "FLASHSCORE + SOFASCORE:",
        len(overlapping),
    )

    print()

    totals = {
        "flashscore": 0,
        "sofascore": 0,
    }

    valid = {
        "flashscore": 0,
        "sofascore": 0,
    }

    wins = {
        "flashscore": 0,
        "sofascore": 0,
        "tie": 0,
    }

    for (
        index,
        (
            match,
            flashscore,
            sofascore,
        ),
    ) in enumerate(
        overlapping,
        start=1,
    ):

        print(
            "=" * 80
        )

        print(
            f"{index}. "
            f"{match['home']['name']}"
            " - "
            f"{match['away']['name']}"
        )

        print(
            "SOURCES:",
            ", ".join(
                source["provider"]
                for source
                in match[
                    "sources"
                ]
            ),
        )

        flash_payload = get_json(
            context_url(
                "flashscore",
                flashscore[
                    "externalId"
                ],
            )
        )

        sofa_payload = get_json(
            context_url(
                "sofascore",
                sofascore[
                    "externalId"
                ],
            )
        )

        flash = summarize_context(
            flash_payload
        )

        sofa = summarize_context(
            sofa_payload
        )

        print_summary(
            "Flashscore",
            flash,
        )

        print_summary(
            "SofaScore",
            sofa,
        )

        if (
            flash.get(
                "error"
            )
            is None
        ):
            totals[
                "flashscore"
            ] += flash[
                "total"
            ]

            valid[
                "flashscore"
            ] += 1

        if (
            sofa.get(
                "error"
            )
            is None
        ):
            totals[
                "sofascore"
            ] += sofa[
                "total"
            ]

            valid[
                "sofascore"
            ] += 1

        if (
            flash.get(
                "error"
            )
            is None
            and
            sofa.get(
                "error"
            )
            is None
        ):
            if (
                flash[
                    "total"
                ]
                >
                sofa[
                    "total"
                ]
            ):
                wins[
                    "flashscore"
                ] += 1

            elif (
                sofa[
                    "total"
                ]
                >
                flash[
                    "total"
                ]
            ):
                wins[
                    "sofascore"
                ] += 1

            else:
                wins[
                    "tie"
                ] += 1

        print()

    print(
        "=" * 80
    )

    print(
        "RESUMEN"
    )

    print(
        "=" * 80
    )

    for provider in (
        "flashscore",
        "sofascore",
    ):
        count = valid[
            provider
        ]

        average = (
            totals[
                provider
            ]
            /
            count
        ) if count else 0

        print(
            provider.upper(),
            "| contextos:",
            count,
            "| puntos:",
            totals[
                provider
            ],
            "| promedio:",
            f"{average:.2f}",
        )

    print()

    print(
        "MÁS COMPLETO POR PARTIDO"
    )

    print(
        "Flashscore:",
        wins[
            "flashscore"
        ]
    )

    print(
        "SofaScore:",
        wins[
            "sofascore"
        ]
    )

    print(
        "Empates:",
        wins[
            "tie"
        ]
    )


if __name__ == "__main__":
    main()
