import {
  CreateWatchlistItem,
} from "./application/use-cases/CreateWatchlistItem";

import {
  DeleteWatchlistItem,
} from "./application/use-cases/DeleteWatchlistItem";

import {
  GetWatchlist,
} from "./application/use-cases/GetWatchlist";

import {
  SetWatchlistEnabled,
} from "./application/use-cases/SetWatchlistEnabled";

import {
  MongooseWatchlistRepository,
} from "./infrastructure/repositories/MongooseWatchlistRepository";

import {
  WatchlistController,
} from "./presentation/controllers/WatchlistController";

import {
  createWatchlistRouter,
} from "./presentation/routes/watchlistRoutes";

export const watchlistRepository =
  new MongooseWatchlistRepository();

export const watchlistSignalMatcher =
  new WatchlistSignalMatcher(
    watchlistRepository
  );

import {
  WatchlistSignalMatcher,
} from "./application/services/WatchlistSignalMatcher";

export const createWatchlistItem =
  new CreateWatchlistItem(
    watchlistRepository
  );

export const getWatchlist =
  new GetWatchlist(
    watchlistRepository
  );

export const deleteWatchlistItem =
  new DeleteWatchlistItem(
    watchlistRepository
  );

export const setWatchlistEnabled =
  new SetWatchlistEnabled(
    watchlistRepository
  );

const watchlistController =
  new WatchlistController(
    createWatchlistItem,
    getWatchlist,
    deleteWatchlistItem,
    setWatchlistEnabled
  );

export const watchlistRouter =
  createWatchlistRouter(
    watchlistController
  );

