// F-AUTH-02 · Inicio de sesión
// Unidad: LoginUserUseCase.execute()  (POST /api/v1/users/login)
//
// Patrón AAA en cada caso: Arrange / Act / Assert.

import { test, is, ok, grab, expect } from "./harness.js";
import { fakeUsuarios, usuario } from "./helpers.js";
import { LoginUserUseCase } from "../src/application/use-cases/auth.use-cases.js";
import { loginSchema } from "../src/infrastructure/http/validators/auth.validator.js";
import { hashPassword } from "../src/shared/utils/authHelper.js";
import { AppError } from "../src/shared/errors/AppError.js";

const MENSAJE_GENERICO = "Credenciales incorrectas. Verifique correo y contraseña.";

test("CP-F-AUTH-02-01", "Rechaza correo con formato inválido antes de consultar repositorio", () => {
  // Arrange
  const repo = fakeUsuarios();
  const credenciales = { email: "ana-sin-arroba", password: "loQueSea" };

  // Act
  const resultado = loginSchema.safeParse(credenciales);

  // Assert
  is(resultado.success, false);
  expect(repo.findByEmail).not.toHaveBeenCalled();
});

test("CP-F-AUTH-02-02", "Rechaza credenciales cuando el correo no existe", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(null);

  // Act
  const error = await grab(caso.execute("nadie@homara.com", "ClaveSegura8"));

  // Assert
  ok(error instanceof AppError);
  is(error.message, MENSAJE_GENERICO);
});

test("CP-F-AUTH-02-03", "Rechaza credenciales cuando la contraseña no coincide", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("LaCorrecta8") }));

  // Act
  const error = await grab(caso.execute("ana@homara.com", "LaEquivocada8"));

  // Assert
  is(error.message, MENSAJE_GENERICO);
});

test("CP-F-AUTH-02-04", "Emite credencial de sesión al ingresar credenciales válidas", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("ClaveSegura8") }));

  // Act
  const salida = await caso.execute("ana@homara.com", "ClaveSegura8");

  // Assert
  is(typeof salida.token, "string");
  is(salida.user.id, "usr_001");
  is((salida.user as any).password, undefined);
});

test("CP-F-AUTH-02-03b", "Devuelve el mismo mensaje de error para correo inexistente y clave incorrecta", async () => {
  // Arrange — la primera consulta no halla el correo; la segunda sí, con otra clave.
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(usuario({ password: await hashPassword("LaCorrecta8") }));

  // Act
  const sinCorreo = await caso.execute("nadie@homara.com", "x").catch((e) => e.message);
  const claveMala = await caso.execute("ana@homara.com", "otra").catch((e) => e.message);

  // Assert
  is(sinCorreo, claveMala);
});

test("CP-F-AUTH-02-04b", "Normaliza correo antes de consultar", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("ClaveSegura8") }));

  // Act
  await caso.execute("  ANA@HOMARA.COM  ", "ClaveSegura8");

  // Assert
  expect(repo.findByEmail).toHaveBeenCalledWith("ana@homara.com");
});
