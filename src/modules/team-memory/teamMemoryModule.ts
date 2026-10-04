import {
  AddTeamMemoryEvent,
} from "./application/use-cases/AddTeamMemoryEvent";

import {
  DeleteTeamMemoryEvent,
} from "./application/use-cases/DeleteTeamMemoryEvent";

import {
  GetTeamMemoryHistory,
} from "./application/use-cases/GetTeamMemoryHistory";

import {
  GetTeamMemorySummaries,
} from "./application/use-cases/GetTeamMemorySummaries";

import {
  MongooseTeamMemoryRepository,
} from "./infrastructure/repositories/MongooseTeamMemoryRepository";

import {
  GetAllTeamMemorySummaries,
} from "./application/use-cases/GetAllTeamMemorySummaries";

import {
  TeamMemoryController,
} from "./presentation/controllers/TeamMemoryController";

import {
  createTeamMemoryRouter,
} from "./presentation/routes/teamMemoryRoutes";

export const teamMemoryRepository =
  new MongooseTeamMemoryRepository();

const addTeamMemoryEvent =
  new AddTeamMemoryEvent(
    teamMemoryRepository
  );

  const getAllTeamMemorySummaries =
  new GetAllTeamMemorySummaries(
    teamMemoryRepository
  );

const getTeamMemorySummaries =
  new GetTeamMemorySummaries(
    teamMemoryRepository
  );

const getTeamMemoryHistory =
  new GetTeamMemoryHistory(
    teamMemoryRepository
  );

const deleteTeamMemoryEvent =
  new DeleteTeamMemoryEvent(
    teamMemoryRepository
  );

const controller =
  new TeamMemoryController(
    addTeamMemoryEvent,
    getTeamMemorySummaries,
    getTeamMemoryHistory,
    deleteTeamMemoryEvent,
	getAllTeamMemorySummaries
  );

export const teamMemoryRouter =
  createTeamMemoryRouter(
    controller
  );
