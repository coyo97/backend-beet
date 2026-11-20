
import {
  searchOneXBetMatches,
  type OneXBetSearchItem,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetMatchSearch";

const items: OneXBetSearchItem[] = [
  {
    id: "1001",
    home: "Belgrano II",
    away: "CA Independiente Avellaneda II",
    competition: "Reserve League",
    kickoffAt: "2026-11-18T19:00:00Z",
    section: "live",
    url:
      "https://bol.1xbet.com/es/live/football/123-league/1001-belgrano-independiente",
  },
  {
    id: "1002",
    home: "Belgrano II",
    away: "CA Independiente Avellaneda II",
    competition: "Reserve League",
    kickoffAt: "2026-11-25T19:00:00Z",
    section: "prematch",
    url:
      "https://bol.1xbet.com/es/line/football/123-league/1002-belgrano-independiente",
  },
  {
    id: "1003",
    home: "Manchester City",
    away: "Liverpool",
    competition: "Premier League",
    kickoffAt: "2026-11-20T16:00:00Z",
    section: "prematch",
    url:
      "https://bol.1xbet.com/es/line/football/123-league/1003-city-liverpool",
  },
  {
    id: "1004",
    home: "Montevideo City Torque",
    away: "Nacional",
    competition: "Primera Division",
    kickoffAt: "2026-11-20T18:00:00Z",
    section: "prematch",
    url:
      "https://bol.1xbet.com/es/line/football/123-league/1004-city-nacional",
  },
];

console.log("\nBELGRANO VS INDEPENDIENTE");

console.table(
  searchOneXBetMatches(
    {
      home: "Belgrano 2",
      away: "Independiente 2",
      kickoffAt: "2026-11-18T19:00:00Z",
      preferredSection: "live",
    },
    items
  ).map(item => ({
    home: item.home,
    away: item.away,
    section: item.section,
    type: item.matchType,
    score: item.score,
  }))
);

console.log("\nBUSQUEDA CITY");

console.table(
  searchOneXBetMatches(
    {
      home: "City",
      preferredSection: "prematch",
    },
    items
  ).map(item => ({
    home: item.home,
    away: item.away,
    type: item.matchType,
    score: item.score,
  }))
);

