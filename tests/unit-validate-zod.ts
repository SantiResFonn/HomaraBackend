import { test, is, eq, has } from "./harness.js";
import { validateZod } from "../src/infrastructure/http/middlewares/validateZod.js";
import { z } from "zod";
import { AppError } from "../src/shared/errors/AppError.js";

test("UNIT-ZOD-01", "Valida body correcto y llama a next", () => {
  // Arrange
  const schema = z.object({ name: z.string(), age: z.number() });
  const middleware = validateZod(schema, "body");
  let nextCalled = false;
  const req: any = { body: { name: "Juan", age: 30 } };
  const res: any = {};
  const next = () => { nextCalled = true; };

  // Act
  middleware(req, res, next);

  // Assert
  is(nextCalled, true);
  eq(req.body, { name: "Juan", age: 30 });
});

test("UNIT-ZOD-02", "Lanza AppError 400 cuando el body no cumple el esquema", () => {
  // Arrange
  const schema = z.object({ email: z.string().email() });
  const middleware = validateZod(schema, "body");
  const req: any = { body: { email: "correo-invalido" } };
  const res: any = {};
  const next = () => {};
  let errorLanzado: any = null;

  // Act
  try {
    middleware(req, res, next);
  } catch (err) {
    errorLanzado = err;
  }

  // Assert
  is(errorLanzado instanceof AppError, true);
  is(errorLanzado.statusCode, 400);
  has(errorLanzado.message, "Validación fallida");
});

test("UNIT-ZOD-03", "Mutan in-place req.query preservando conversión de tipos de Zod", () => {
  // Arrange
  const schema = z.object({ limit: z.coerce.number().default(10) });
  const middleware = validateZod(schema, "query");
  let nextCalled = false;
  const req: any = { query: { limit: "25", extra: "quitar" } };
  const res: any = {};
  const next = () => { nextCalled = true; };

  // Act
  middleware(req, res, next);

  // Assert
  is(nextCalled, true);
  is(req.query.limit, 25);
  is(req.query.extra, undefined);
});

test("UNIT-ZOD-04", "Mutan in-place req.params con tipos validados", () => {
  // Arrange
  const schema = z.object({ id: z.string().min(3) });
  const middleware = validateZod(schema, "params");
  let nextCalled = false;
  const req: any = { params: { id: "abc" } };
  const res: any = {};
  const next = () => { nextCalled = true; };

  // Act
  middleware(req, res, next);

  // Assert
  is(nextCalled, true);
  is(req.params.id, "abc");
});
