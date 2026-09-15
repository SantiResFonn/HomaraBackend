import { test, is, ok } from "./harness.js";
import { fakeUsuarios, usuario, contextoExpress, errorDeNext } from "./helpers.js";
import jwt from "jsonwebtoken";
import { optionalAuth, requireAuth, setUserRepositoryForTests } from "../src/infrastructure/http/middlewares/auth.js";
import { AppError } from "../src/shared/errors/AppError.js";

const SECRETO = process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure";
const tokenDe = (payload: object, opciones: jwt.SignOptions = { expiresIn: "7d" }) =>
  jwt.sign(payload, SECRETO, opciones);

function instalarRepo() {
  const repo = fakeUsuarios();
  setUserRepositoryForTests(repo as any);
  return repo;
}

test("UNIT-AUTH-01", "optionalAuth pasa de largo si no hay cabecera Authorization", async () => {
  // Arrange
  const repo = instalarRepo();
  const { req, res, next } = contextoExpress();

  // Act
  await optionalAuth(req, res, next);

  // Assert
  is(req.user, undefined);
  is(next.mock.calls.length, 1);
  is(next.mock.calls[0][0], undefined);
});

test("UNIT-AUTH-02", "optionalAuth ignora cabeceras que no comienzan con Bearer", async () => {
  // Arrange
  const repo = instalarRepo();
  const { req, res, next } = contextoExpress("Basic some-credentials");

  // Act
  await optionalAuth(req, res, next);

  // Assert
  is(req.user, undefined);
  is(next.mock.calls.length, 1);
});

test("UNIT-AUTH-03", "optionalAuth autentica al usuario cuando el token es válido y existe", async () => {
  // Arrange
  const repo = instalarRepo();
  const u = usuario({ id: "usr_opt", role: "CUSTOMER", firstName: "Maria", lastName: "Gomez" });
  repo.findById.mockResolvedValue(u);
  const token = tokenDe({ id: "usr_opt", email: u.email, role: u.role });
  const { req, res, next } = contextoExpress(`Bearer ${token}`);

  // Act
  await optionalAuth(req, res, next);

  // Assert
  is(next.mock.calls.length, 1);
  is(req.user?.id, "usr_opt");
  is(req.user?.email, u.email);
  is(req.user?.role, "CUSTOMER");
  is(req.user?.firstName, "Maria");
  is(req.user?.lastName, "Gomez");
});

test("UNIT-AUTH-04", "optionalAuth traga silenciosamente errores de JWT inválido o expirado", async () => {
  // Arrange
  const repo = instalarRepo();
  const caducado = tokenDe({ id: "usr_exp" }, { expiresIn: "-1s" });
  const { req, res, next } = contextoExpress(`Bearer ${caducado}`);

  // Act
  await optionalAuth(req, res, next);

  // Assert
  is(req.user, undefined);
  is(next.mock.calls.length, 1);
  is(next.mock.calls[0][0], undefined);
});

test("UNIT-AUTH-05", "optionalAuth no asigna usuario si findById devuelve null", async () => {
  // Arrange
  const repo = instalarRepo();
  repo.findById.mockResolvedValue(null);
  const token = tokenDe({ id: "usr_none", email: "none@homara.com" });
  const { req, res, next } = contextoExpress(`Bearer ${token}`);

  // Act
  await optionalAuth(req, res, next);

  // Assert
  is(req.user, undefined);
  is(next.mock.calls.length, 1);
});

test("UNIT-AUTH-06", "forwardAuthError mapea errores inesperados a 500", async () => {
  // Arrange
  const repo = instalarRepo();
  repo.findById.mockRejectedValue(new Error("Conexión perdida con la base de datos"));
  const token = tokenDe({ id: "usr_crash", email: "crash@homara.com" });
  const { req, res, next } = contextoExpress(`Bearer ${token}`);

  // Act
  await requireAuth(req, res, next);

  // Assert
  const error = errorDeNext(next);
  ok(error instanceof AppError);
  is(error.statusCode, 500);
  is(error.message, "Error durante la autenticación.");
});
