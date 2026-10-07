import {
  sign,
} from "jsonwebtoken";

import {
  env,
} from "../../../../config/env";

export function normalizeUsername(
  value: string
): string {
  return value
    .trim()
    .toLowerCase();
}

export function createAccessToken(
  userId: string
): string {
  return sign(
    {},
    env.AUTH_JWT_SECRET,
    {
      algorithm: "HS256",
      subject: userId,
      issuer: "football-radar",
      audience: "football-radar-mobile",
      expiresIn: "30d",
    }
  );
}
