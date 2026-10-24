import {
  AnalyzeMatchLineup,
} from "./application/use-cases/AnalyzeMatchLineup";

import {
  BootstrapTeamLineupHistory,
} from "./application/use-cases/BootstrapTeamLineupHistory";

import {
  InspectMatchLineup,
} from "./application/use-cases/InspectMatchLineup";

import {
  VerifyMatchLineup,
} from "./application/use-cases/VerifyMatchLineup";

import {
  FlashscoreTeamMatchHistoryCatalog,
} from "./infrastructure/catalogs/flashscore/FlashscoreTeamMatchHistoryCatalog";

import {
  FlashscoreMatchLineupProvider,
} from "./infrastructure/providers/flashscore/FlashscoreMatchLineupProvider";

import {
  MongooseMatchLineupStore,
} from "./infrastructure/repositories/MongooseMatchLineupStore";

import {
  TeamLineupController,
} from "./presentation/controllers/TeamLineupController";

import {
  createTeamLineupRouter,
} from "./presentation/routes/teamLineupRoutes";

export const matchLineupStore =
  new MongooseMatchLineupStore();

export const matchLineupProvider =
  new FlashscoreMatchLineupProvider();

export const teamMatchHistoryCatalog =
  new FlashscoreTeamMatchHistoryCatalog();

export const verifyMatchLineup =
  new VerifyMatchLineup(
    matchLineupProvider,
    matchLineupStore
  );

export const analyzeMatchLineup =
  new AnalyzeMatchLineup(
    matchLineupStore
  );

export const bootstrapTeamLineupHistory =
  new BootstrapTeamLineupHistory(
    teamMatchHistoryCatalog,
    matchLineupProvider,
    matchLineupStore
  );

export const inspectMatchLineup =
  new InspectMatchLineup(
    verifyMatchLineup,
    analyzeMatchLineup,
    bootstrapTeamLineupHistory
  );

const controller =
  new TeamLineupController(
    inspectMatchLineup
  );

export const teamLineupRouter =
  createTeamLineupRouter(
    controller
  );
