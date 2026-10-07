import type {
  Request,
  Response,
  NextFunction,
} from "express";

export function bindAuthenticatedOwner(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId =
    res.locals.authUserId as
      string | undefined;

  if (!userId) {
    res.status(401).json({
      message:
        "Sesión requerida",
    });

    return;
  }

  /*
   * Compatibilidad con controllers
   * antiguos.
   *
   * Se ignora el ownerId enviado
   * por el cliente y se utiliza
   * exclusivamente el autenticado.
   */
  req.headers[
    "x-football-radar-owner-id"
  ] = userId;

  next();
}
