import {
  MongooseTeamPersonalProfileRepository,
} from "./infrastructure/repositories/MongooseTeamPersonalProfileRepository";

import {
  SaveTeamPersonalProfile,
} from "./application/use-cases/SaveTeamPersonalProfile";

import {
  GetTeamPersonalProfile,
} from "./application/use-cases/GetTeamPersonalProfile";

import {
  GetTeamPersonalProfiles,
} from "./application/use-cases/GetTeamPersonalProfiles";

import {
  TeamPersonalProfileController,
} from "./presentation/controllers/TeamPersonalProfileController";

import {
  createTeamPersonalProfileRouter,
} from "./presentation/routes/teamPersonalProfileRoutes";

export const teamPersonalProfileRepository =
  new MongooseTeamPersonalProfileRepository();

const saveTeamPersonalProfile =
  new SaveTeamPersonalProfile(
    teamPersonalProfileRepository
  );

const getTeamPersonalProfile =
  new GetTeamPersonalProfile(
    teamPersonalProfileRepository
  );

const getTeamPersonalProfiles =
  new GetTeamPersonalProfiles(
    teamPersonalProfileRepository
  );

const controller =
  new TeamPersonalProfileController(
    saveTeamPersonalProfile,
    getTeamPersonalProfile,
    getTeamPersonalProfiles
  );

export const teamPersonalProfileRouter =
  createTeamPersonalProfileRouter(
    controller
  );
