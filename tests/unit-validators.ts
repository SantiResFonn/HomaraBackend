import { test, is } from "./harness.js";
import { cuidParamSchema, itemIdParamSchema, listProjectsQuerySchema, listOrdersQuerySchema } from "../src/infrastructure/http/validators/common.validator.js";
import { createOrderSchema, updateOrderStatusSchema } from "../src/infrastructure/http/validators/order.validator.js";
import { createProjectSchema, updateProjectSchema } from "../src/infrastructure/http/validators/project.validator.js";

test("UNIT-VAL-01", "Valida cuidParamSchema y itemIdParamSchema con CUID válido e inválido", () => {
  // Arrange
  const validCuid = "cju055a6d0000y8v760ny8rq5";

  // Act
  const cuidValido = cuidParamSchema.safeParse({ id: validCuid });
  const cuidInvalido = cuidParamSchema.safeParse({ id: "123" });
  const itemValido = itemIdParamSchema.safeParse({ itemId: validCuid });
  const itemInvalido = itemIdParamSchema.safeParse({ itemId: "invalid" });

  // Assert
  is(cuidValido.success, true);
  is(cuidInvalido.success, false);
  is(itemValido.success, true);
  is(itemInvalido.success, false);
});

test("UNIT-VAL-02", "Valida listOrdersQuerySchema y transformación de admin boolean", () => {
  // Arrange
  const adminVerdadero = { admin: "true" };
  const adminFalso = { admin: "false" };

  // Act
  const parsed = listOrdersQuerySchema.safeParse(adminVerdadero);
  const parsedFalse = listOrdersQuerySchema.safeParse(adminFalso);
  const proyectosSinFiltro = listProjectsQuerySchema.safeParse({});

  // Assert
  is(parsed.success, true);
  if (parsed.success) {
    is(parsed.data.admin, true);
  }
  is(parsedFalse.success, true);
  if (parsedFalse.success) {
    is(parsedFalse.data.admin, false);
  }
  is(proyectosSinFiltro.success, true);
});

test("UNIT-VAL-03", "Valida createOrderSchema y updateOrderStatusSchema", () => {
  // Arrange
  const validOrder = {
    paymentMethod: "TARJETA_CREDITO",
    shippingAddress: "Calle 123 #45-67",
    shippingCity: "Bogotá",
  };

  // Act
  const pedidoValido = createOrderSchema.safeParse(validOrder);
  const pedidoVacio = createOrderSchema.safeParse({});
  const estadoValido = updateOrderStatusSchema.safeParse({ status: "ENVIADO" });
  const estadoDesconocido = updateOrderStatusSchema.safeParse({ status: "DESCONOCIDO" });

  // Assert
  is(pedidoValido.success, true);
  is(pedidoVacio.success, false);
  is(estadoValido.success, true);
  is(estadoDesconocido.success, false);
});

test("UNIT-VAL-04", "Valida createProjectSchema y updateProjectSchema", () => {
  // Arrange
  const validProject = {
    name: "Remodelación Cocina",
    type: "PISO",
    area: 25.5,
    wastePercent: 10,
  };
  const validUpdate = {
    area: 30,
    status: "COMPLETADO",
  };

  // Act
  const proyectoValido = createProjectSchema.safeParse(validProject);
  const proyectoSinNombre = createProjectSchema.safeParse({ name: "", type: "PISO", area: 10 });
  const cambioValido = updateProjectSchema.safeParse(validUpdate);
  const areaNegativa = updateProjectSchema.safeParse({ area: -5 });

  // Assert
  is(proyectoValido.success, true);
  is(proyectoSinNombre.success, false);
  is(cambioValido.success, true);
  is(areaNegativa.success, false);
});
