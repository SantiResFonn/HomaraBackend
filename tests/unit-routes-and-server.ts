// ============================================================================
// Pruebas unitarias para Express Server y Enrutadores HTTP
// ============================================================================

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test, is, ok, vi } from "./harness.js";
import app from "../src/infrastructure/http/express-server.js";

import categoriesRouter from "../src/infrastructure/http/routes/categories.js";
import productsRouter from "../src/infrastructure/http/routes/products.js";
import projectsRouter from "../src/infrastructure/http/routes/projects.js";
import cartRouter from "../src/infrastructure/http/routes/cart.js";
import ordersRouter from "../src/infrastructure/http/routes/orders.js";
import usersRouter from "../src/infrastructure/http/routes/users.js";
import adminRouter from "../src/infrastructure/http/routes/admin.js";

import { setCatalogRepositoriesForTests } from "../src/infrastructure/http/controllers/catalog.controller.js";

// Helper para extraer rutas y métodos de un Router de Express
function obtenerRutas(router: any): Array<{ path: string; methods: string[] }> {
  const rutas: Array<{ path: string; methods: string[] }> = [];
  for (const layer of router.stack) {
    if (layer.route) {
      rutas.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      });
    }
  }
  return rutas;
}

// Helper para obtener el router stack tanto en Express 4 como en Express 5
function obtenerServerStack(): any[] {
  return (app as any).router?.stack || (app as any)._router?.stack || [];
}

// ============================================================================
// Express Server & Middleware Tests
// ============================================================================

test("UNIT-SRV-01", "Express App está inicializado con middlewares y rutas base", () => {
  // Arrange — la app se construye al importar el módulo.

  // Act
  const stack = obtenerServerStack();

  // Assert
  ok(typeof app === "function");
  is(app.get("x-powered-by"), false);
  ok(stack.length > 5, "La pila de middleware del servidor debe tener registradas las rutas y middlewares");
});

test("UNIT-SRV-02", "Middleware de reescritura /api -> /api/v1 funciona correctamente", () => {
  // Arrange — en express-server: app.use("/api", (req, res, next) => { ... }).
  // Se busca esa capa anónima, anterior al router v1.
  const stack = obtenerServerStack();
  const rewriteLayer = stack.find((layer: any) => layer.name === "<anonymous>" && typeof layer.handle === "function");
  ok(rewriteLayer, "El middleware de reescritura de /api debe existir en la pila"); // precondición
  const middleware = rewriteLayer.handle;

  const req1: any = { url: "/categories" };   // sin /v1
  const req2: any = { url: "/v1/products" };  // ya con /v1
  let nextCalled1 = false;
  let nextCalled2 = false;

  // Act
  middleware(req1, {} as any, () => { nextCalled1 = true; });
  middleware(req2, {} as any, () => { nextCalled2 = true; });

  // Assert
  is(req1.url, "/v1/categories"); // se antepone /v1
  is(nextCalled1, true);
  is(req2.url, "/v1/products");   // no se duplica
  is(nextCalled2, true);
});

test("UNIT-SRV-03", "Servidor Express responde a GET / con metadatos de la API", async () => {
  // Arrange
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    // Act
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const body: any = await res.json();

    // Assert
    is(res.status, 200);
    is(body.message, "Homara API — Backend");
    is(body.version, "1.0.0");
    ok(body.endpoints.categories !== undefined);
    ok(body.endpoints.products !== undefined);
    ok(body.endpoints.cart !== undefined);
  } finally {
    server.close();
  }
});

test("UNIT-SRV-04", "Servidor Express maneja peticiones OPTIONS y CORS", async () => {
  // Arrange
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    // Act
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET"
      }
    });

    // Assert
    is(res.status, 204);
  } finally {
    server.close();
  }
});

// ============================================================================
// Route Definitions Tests (7 Routers)
// ============================================================================

test("UNIT-ROUTES-CAT-01", "categoriesRouter define GET /", () => {
  // Arrange — el router se importa ya construido; no hay dobles que montar.

  // Act
  const rutas = obtenerRutas(categoriesRouter);

  // Assert
  ok(rutas.some((r) => r.path === "/" && r.methods.includes("get")));
});

test("UNIT-ROUTES-PRD-01", "productsRouter define endpoints de catálogo y administración", () => {
  // Arrange — el router se importa ya construido; no hay dobles que montar.

  // Act
  const rutas = obtenerRutas(productsRouter);

  // Assert
  ok(rutas.some((r) => r.path === "/storefront" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/:id/reviews" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/:id/reviews" && r.methods.includes("post")));
  ok(rutas.some((r) => r.path === "/" && r.methods.includes("post")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("put")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("delete")));
});

test("UNIT-ROUTES-PROY-01", "projectsRouter define CRUD de proyectos", () => {
  // Arrange — el router se importa ya construido; no hay dobles que montar.

  // Act
  const rutas = obtenerRutas(projectsRouter);

  // Assert
  ok(rutas.some((r) => r.path === "/" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/" && r.methods.includes("post")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("put")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("delete")));
});

test("UNIT-ROUTES-CART-01", "cartRouter define endpoints de carrito", () => {
  // Arrange — el router se importa ya construido; no hay dobles que montar.

  // Act
  const rutas = obtenerRutas(cartRouter);

  // Assert
  ok(rutas.some((r) => r.path === "/" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/items" && r.methods.includes("post")));
  ok(rutas.some((r) => r.path === "/items/:itemId" && r.methods.includes("put")));
  ok(rutas.some((r) => r.path === "/items/:itemId" && r.methods.includes("delete")));
});

test("UNIT-ROUTES-ORD-01", "ordersRouter define endpoints de pedidos", () => {
  // Arrange — el router se importa ya construido; no hay dobles que montar.

  // Act
  const rutas = obtenerRutas(ordersRouter);

  // Assert
  ok(rutas.some((r) => r.path === "/" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/" && r.methods.includes("post")));
  ok(rutas.some((r) => r.path === "/:id/status" && r.methods.includes("put")));
});

test("UNIT-ROUTES-USR-01", "usersRouter define endpoints de autenticación y perfil", () => {
  // Arrange — el router se importa ya construido; no hay dobles que montar.

  // Act
  const rutas = obtenerRutas(usersRouter);

  // Assert
  ok(rutas.some((r) => r.path === "/register" && r.methods.includes("post")));
  ok(rutas.some((r) => r.path === "/login" && r.methods.includes("post")));
  ok(rutas.some((r) => r.path === "/me" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/:id" && r.methods.includes("put")));
});

test("UNIT-ROUTES-ADM-01", "adminRouter define métricas e inventario", () => {
  // Arrange — el router se importa ya construido; no hay dobles que montar.

  // Act
  const rutas = obtenerRutas(adminRouter);

  // Assert
  ok(rutas.some((r) => r.path === "/metrics" && r.methods.includes("get")));
  ok(rutas.some((r) => r.path === "/inventory" && r.methods.includes("get")));
});

// ============================================================================
// End-to-End Route Invocations via Express App
// ============================================================================

test("UNIT-SRV-05", "Petición HTTP a /api/v1/categories devuelve listado de categorías", async () => {
  // Arrange
  const fakeCatRepo = {
    findAll: vi.fn(async () => [
      { id: "cat-1", name: "Pisos", slug: "pisos", description: "Pisos", icon: "p.jpg" }
    ]),
    findBySlug: vi.fn(),
    create: vi.fn(),
  };
  setCatalogRepositoriesForTests({ categoryRepo: fakeCatRepo as any });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    // Act
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/categories`);
    const json: any = await res.json();

    // Assert
    is(res.status, 200);
    is(json.success, true);
    is(json.data.length, 1);
    is(json.data[0].name, "Pisos");
  } finally {
    server.close();
  }
});

test("UNIT-SRV-06", "Petición HTTP con reescritura /api/categories funciona idénticamente", async () => {
  // Arrange
  const fakeCatRepo = {
    findAll: vi.fn(async () => [
      { id: "cat-1", name: "Pisos", slug: "pisos", description: "Pisos", icon: "p.jpg" }
    ]),
    findBySlug: vi.fn(),
    create: vi.fn(),
  };
  setCatalogRepositoriesForTests({ categoryRepo: fakeCatRepo as any });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    // Act
    const res = await fetch(`http://127.0.0.1:${port}/api/categories`);
    const json: any = await res.json();

    // Assert
    is(res.status, 200);
    is(json.success, true);
    is(json.data.length, 1);
  } finally {
    server.close();
  }
});

test("UNIT-SRV-07", "Ruta no existente retorna 404 a través del manejador global", async () => {
  // Arrange
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    // Act
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/ruta-inexistente-xyz`);

    // Assert
    is(res.status, 404);
  } finally {
    server.close();
  }
});
