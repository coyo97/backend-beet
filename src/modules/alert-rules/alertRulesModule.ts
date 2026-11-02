
import {
  MongooseAlertRuleRepository,
} from "./infrastructure/repositories/MongooseAlertRuleRepository";

import {
  AlertRulesController,
} from "./presentation/controllers/AlertRulesController";

import {
  createAlertRulesRouter,
} from "./presentation/routes/alertRulesRoutes";

export const alertRulesRepository =
  new MongooseAlertRuleRepository();

const alertRulesController =
  new AlertRulesController(
    alertRulesRepository
  );

export const alertRulesRouter =
  createAlertRulesRouter(
    alertRulesController
  );

