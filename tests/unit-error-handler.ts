import { test, is, eq } from "./harness.js";
import { errorHandler } from "../src/infrastructure/http/middlewares/errorHandler.js";
import { AppError } from "../src/shared/errors/AppError.js";
import { Prisma } from "../src/generated/prisma/client.js";
import jwt from "jsonwebtoken";

const { JsonWebTokenError, TokenExpiredError } = jwt;

function makeRes() {
  const res: any = {
    statusCode: 200,
    payload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.payload = data;
      return this;
    },
  };
  return res;
}

const req: any = {};
const next = () => {};

test("UNIT-ERR-01", "Maneja AppError devolviendo el statusCode y el mensaje", () => {
  // Arrange
  const res = makeRes();
  const error = new AppError("Recurso no disponible", 404);

  // Act
  errorHandler(error, req, res, next);

  // Assert
  is(res.statusCode, 404);
  eq(res.payload, { success: false, error: "Recurso no disponible" });
});

test("UNIT-ERR-02", "Maneja Prisma P2002 como 409 conflicto con campos duplicados", () => {
  // Arrange
  const res = makeRes();
  const prismaErr = new Prisma.PrismaClientKnownRequestError("Duplicate", {
    code: "P2002",
    clientVersion: "7.8.0",
    meta: { target: ["email"] },
  });

  // Act
  errorHandler(prismaErr, req, res, next);

  // Assert
  is(res.statusCode, 409);
  is(res.payload.success, false);
  eq(res.payload.error, "El registro ya existe. Campo duplicado: email");
});

test("UNIT-ERR-03", "Maneja Prisma P2025 como 404 no encontrado", () => {
  // Arrange
  const res = makeRes();
  const prismaErr = new Prisma.PrismaClientKnownRequestError("Not found", {
    code: "P2025",
    clientVersion: "7.8.0",
  });

  // Act
  errorHandler(prismaErr, req, res, next);

  // Assert
  is(res.statusCode, 404);
  is(res.payload.success, false);
  eq(res.payload.error, "El recurso solicitado no fue encontrado o no tienes permisos para acceder a él.");
});

test("UNIT-ERR-04", "Maneja Prisma P2003 como 400 error de integridad", () => {
  // Arrange
  const res = makeRes();
  const prismaErr = new Prisma.PrismaClientKnownRequestError("Foreign key", {
    code: "P2003",
    clientVersion: "7.8.0",
  });

  // Act
  errorHandler(prismaErr, req, res, next);

  // Assert
  is(res.statusCode, 400);
  is(res.payload.success, false);
  eq(res.payload.error, "Error de integridad de datos. La entidad referenciada no existe.");
});

test("UNIT-ERR-05", "Maneja PrismaClientValidationError como 400", () => {
  // Arrange
  const res = makeRes();
  const prismaErr = new Prisma.PrismaClientValidationError("Validation failed", {
    clientVersion: "7.8.0",
  });

  // Act
  errorHandler(prismaErr, req, res, next);

  // Assert
  is(res.statusCode, 400);
  eq(res.payload.error, "Los datos proporcionados no coinciden con la estructura requerida.");
});

test("UNIT-ERR-06", "Maneja TokenExpiredError como 401", () => {
  // Arrange
  const res = makeRes();
  const jwtErr = new TokenExpiredError("jwt expired", new Date());

  // Act
  errorHandler(jwtErr, req, res, next);

  // Assert
  is(res.statusCode, 401);
  eq(res.payload.error, "Token expirado. Por favor, inicia sesión nuevamente.");
});

test("UNIT-ERR-07", "Maneja JsonWebTokenError como 401", () => {
  // Arrange
  const res = makeRes();
  const jwtErr = new JsonWebTokenError("invalid signature");

  // Act
  errorHandler(jwtErr, req, res, next);

  // Assert
  is(res.statusCode, 401);
  eq(res.payload.error, "Token inválido o malformado.");
});

test("UNIT-ERR-08", "Maneja error inesperado como 500", () => {
  // Arrange
  const res = makeRes();
  const genericErr = new Error("Fallo imprevisto");

  // Act
  errorHandler(genericErr, req, res, next);

  // Assert
  is(res.statusCode, 500);
  eq(res.payload.error, "Fallo imprevisto");
});

test("UNIT-ERR-09", "Maneja código Prisma desconocido como 400 genérico", () => {
  // Arrange
  const res = makeRes();
  const prismaErr = new Prisma.PrismaClientKnownRequestError("Generic DB error", {
    code: "P9999",
    clientVersion: "7.8.0",
  });

  // Act
  errorHandler(prismaErr, req, res, next);

  // Assert
  is(res.statusCode, 400);
  is(res.payload.success, false);
  is(res.payload.error.includes("P9999"), true);
});
