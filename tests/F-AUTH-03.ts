// F-AUTH-03 · Control de acceso por rol
// Unidad: middlewares requireAuth y requireAdmin
//
// Patrón AAA en cada caso: Arrange / Act / Assert.

import { test, is, eq, ok, has, subset, expect } from "./harness.js";
import { fakeUsuarios, usuario, contextoExpress, errorDeNext } from "./helpers.js";
import jwt from "jsonwebtoken";
import { requireAuth, requireAdmin, setUserRepositoryForTests } from "../src/infrastructure/http/middlewares/auth.js";
import { AppError } from "../src/shared/errors/AppError.js";

const SECRETO = process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure";
const tokenDe = (payload: object, opciones: jwt.SignOptions = { expiresIn: "7d" }) =>
  jwt.sign(payload, SECRETO, opciones);

/** Instala un repositorio de usuarios falso y lo devuelve. */
function instalarRepo() {
  const repo = fakeUsuarios();
  setUserRepositoryForTests(repo as any);
  return repo;
}

test("CP-F-AUTH-03-01", "Retorna 401 si no se provee cabecera Authorization", async () => {
  // Arrange
  const repo = instalarRepo();
  const { req, res, next } = contextoExpress();

  // Act
  await requireAuth(req, res, next);

  // Assert
  const error = errorDeNext(next);
  ok(error instanceof AppError);
  is(error.statusCode, 401);
  is(error.message, "Token no provisto.");
  expect(repo.findById).not.toHaveBeenCalled();
});

test("CP-F-AUTH-03-02", "Retorna error cuando el token JWT ha caducado", async () => {
  // Arrange
  const repo = instalarRepo();
  const caducado = tokenDe({ id: "usr_001", email: "ana@homara.com", role: "CUSTOMER" }, { expiresIn: "-1s" });
  const { req, res, next } = contextoExpress(`Bearer ${caducado}`);

  // Act
  await requireAuth(req, res, next);

  // Assert
  ok(errorDeNext(next) instanceof jwt.TokenExpiredError);
  expect(repo.findById).not.toHaveBeenCalled();
});

test("CP-F-AUTH-03-03", "Retorna 401 si el usuario asociado al token no existe en la base de datos", async () => {
  // Arrange
  const repo = instalarRepo();
  repo.findById.mockResolvedValue(null);
  const { req, res, next } = contextoExpress(
    `Bearer ${tokenDe({ id: "usr_borrado", email: "x@homara.com", role: "CUSTOMER" })}`,
  );

  // Act
  await requireAuth(req, res, next);

  // Assert
  const error = errorDeNext(next);
  is(error.statusCode, 401);
  is(error.message, "Usuario no encontrado o dado de baja.");
  is(req.user, undefined);
});

test("CP-F-AUTH-03-04", "Retorna 403 cuando un usuario cliente intenta acceder a rutas de administración", async () => {
  // Arrange
  const repo = instalarRepo();
  repo.findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
  const { req, res, next } = contextoExpress(
    `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`,
  );

  // Act
  await requireAdmin(req, res, next);

  // Assert
  const error = errorDeNext(next);
  is(error.statusCode, 403);
  has(error.message, "permisos de administrador");
});

test("CP-F-AUTH-03-05", "Permite el acceso cuando el usuario tiene rol ADMIN en base de datos", async () => {
  // Arrange
  const repo = instalarRepo();
  repo.findById.mockResolvedValue(usuario({ role: "ADMIN" }));
  const { req, res, next } = contextoExpress(
    `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`,
  );

  // Act
  await requireAdmin(req, res, next);

  // Assert
  eq(next.mock.calls[0], []); // next() sin argumentos
  subset(req.user, { id: "usr_001", role: "ADMIN" });
});

test("CP-F-AUTH-03-06", "Traduce fallos internos no controlados a error 500", async () => {
  // Arrange
  const repo = instalarRepo();
  repo.findById.mockRejectedValue(new TypeError("la base de datos no responde"));
  const { req, res, next } = contextoExpress(
    `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "CUSTOMER" })}`,
  );

  // Act
  await requireAuth(req, res, next);

  // Assert
  const error = errorDeNext(next);
  ok(error instanceof AppError);
  is(error.statusCode, 500);
  is(error.message, "Error durante la autenticación.");
});

test("CP-F-AUTH-03-04b", "Valida el rol real de base de datos ignorando el payload del token", async () => {
  // Arrange — el token dice ADMIN, la base de datos dice CUSTOMER.
  const repo = instalarRepo();
  repo.findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
  const { req, res, next } = contextoExpress(
    `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`,
  );

  // Act
  await requireAdmin(req, res, next);

  // Assert
  is(errorDeNext(next).statusCode, 403);
});
