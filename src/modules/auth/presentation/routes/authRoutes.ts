import {
  Router,
} from "express";

import {
  rateLimit,
} from "express-rate-limit";

import {
  compare,
  hash,
} from "bcryptjs";

import {
  z,
} from "zod";

import {
  RadarUserModel,
} from "../../infrastructure/database/models/RadarUserModel";

import {
  createAccessToken,
  normalizeUsername,
} from "../../application/services/AuthService";

import {
  requireAuth,
} from "../middleware/requireAuth";

export const authRouter =
  Router();

const credentialsSchema =
  z.object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(
        /^[a-zA-Z0-9_.-]+$/,
        "Usuario inválido"
      ),

    password: z
      .string()
      .min(12)
      .refine(
        value =>
          Buffer.byteLength(
            value,
            "utf8"
          ) <= 72,
        "Contraseña demasiado larga"
      ),
  });

const authLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 10,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      message:
        "Demasiados intentos. Inténtalo más tarde.",
    },
  });

authRouter.post(
  "/register",
  authLimiter,
  async (req, res) => {
    const parsed =
      credentialsSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res
        .status(400)
        .json({
          message:
            "Revisa el usuario y la contraseña. La contraseña debe tener al menos 12 caracteres.",
        });
    }

    const {
      username,
      password,
    } = parsed.data;

    const usernameKey =
      normalizeUsername(
        username
      );

    try {
      const passwordHash =
        await hash(
          password,
          12
        );

      const user =
        await RadarUserModel
          .create({
            username,
            usernameKey,
            passwordHash,
          });

      return res
        .status(201)
        .json({
          message:
            "Usuario registrado",

          user: {
            id:
              String(user._id),

            username:
              user.username,
          },
        });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        return res
          .status(409)
          .json({
            message:
              "Ese usuario ya existe",
          });
      }

      console.error(
        "[Auth.register]",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "No se pudo registrar",
        });
    }
  }
);

authRouter.post(
  "/login",
  authLimiter,
  async (req, res) => {
    const parsed =
      credentialsSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res
        .status(400)
        .json({
          message:
            "Credenciales inválidas",
        });
    }

    try {
      const usernameKey =
        normalizeUsername(
          parsed.data.username
        );

      const user =
        await RadarUserModel
          .findOne({
            usernameKey,
          });

      const valid =
        user
          ? await compare(
              parsed.data.password,
              user.passwordHash
            )
          : false;

      if (!user || !valid) {
        return res
          .status(401)
          .json({
            message:
              "Usuario o contraseña incorrectos",
          });
      }

      const userId =
        String(user._id);

      return res.json({
        token:
          createAccessToken(
            userId
          ),

        user: {
          id: userId,
          username:
            user.username,
        },
      });
    } catch (error) {
      console.error(
        "[Auth.login]",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Error al iniciar sesión",
        });
    }
  }
);

authRouter.get(
  "/me",
  requireAuth,
  (req, res) => {
    return res.json({
      user: {
        id:
          res.locals.authUserId,

        username:
          res.locals.authUsername,
      },
    });
  }
);
