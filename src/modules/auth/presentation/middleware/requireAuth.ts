import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  verify,
} from "jsonwebtoken";

import mongoose from "mongoose";

import {
  env,
} from "../../../../config/env";

import {
  RadarUserModel,
} from "../../infrastructure/database/models/RadarUserModel";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authorization =
    req.header("authorization") ?? "";

  const match =
    /^Bearer\s+(.+)$/i.exec(
      authorization
    );

  if (!match) {
    res.status(401).json({
      message: "Debes iniciar sesión",
    });

    return;
  }

  try {
    const payload =
      verify(
        match[1],
        env.AUTH_JWT_SECRET,
        {
          algorithms: ["HS256"],
          issuer: "football-radar",
          audience: "football-radar-mobile",
        }
      );

    if (
      typeof payload === "string" ||
      !payload.sub ||
      !mongoose.isValidObjectId(
        payload.sub
      )
    ) {
      res.status(401).json({
        message: "Sesión inválida",
      });

      return;
    }

    const user =
      await RadarUserModel
        .findById(payload.sub)
        .select("_id username")
        .lean();

    if (!user) {
      res.status(401).json({
        message: "Usuario no encontrado",
      });

      return;
    }

    res.locals.authUserId =
      String(user._id);

    res.locals.authUsername =
      user.username;

    next();
  } catch (error) {
    console.error(
      "[Auth.requireAuth]",
      error instanceof Error
        ? error.name
        : "Unknown error"
    );

    res.status(401).json({
      message:
        "Sesión inválida o expirada",
    });
  }
}
