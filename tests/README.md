# Pruebas del backend

Suite sobre **Vitest**. Los dobles son mocks de Vitest usados con su API a la
vista (`vi.fn()`, `vi.mock()`), sin ninguna capa intermedia y sin costuras de
prueba en el código de producción. Los casos siguen derivando del método de
**cobertura de ruta básica de McCabe** (ISTQB, ISO/IEC/IEEE 29119); los ids del
plan no cambiaron.

Todos los casos están escritos con el **patrón AAA** (Arrange · Act · Assert),
marcado explícitamente con comentarios en cada cuerpo de prueba:

```ts
test("CP-F-AUTH-01-02", "Rechaza registro si el correo ya existe", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new RegisterUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(usuario());

  // Act
  const error = await grab(caso.execute(datosRegistro() as any));

  // Assert
  ok(error instanceof AppError);
  is(error.message, "El correo electrónico ya está registrado.");
  expect(repo.create).not.toHaveBeenCalled();
});
```

Regla: el **Act** es una sola invocación de la unidad bajo prueba (o una por
escenario, cuando el caso cubre varios); ninguna aserción vive antes de él. Si
un escenario necesita rearmar un doble a mitad de camino, ese rearmado va en el
Act con un comentario, y el valor que se va a comprobar se captura ahí mismo
—antes de que un `mockReset()` lo borre.

## Cómo ejecutar

```bash
npm install
npx prisma generate                  # necesario: los repos importan el cliente generado
npm test                             # corre los 194 casos
npm run test:watch                   # modo watch de Vitest
npm test -- tests/F-CHK-01.ts        # un archivo
npm test -- -t CP-F-AUTH-01-02       # un caso por id (filtro por nombre)
npm test -- -t F-CHK                 # un módulo (subcadena del id)
npm run test:coverage                # cobertura v8
```

`npm test` es `vitest run`. Sale con código ≠ 0 si algún caso falla,
**incluidos los 14 casos que documentan defectos abiertos** (ver tabla abajo):
un run limpio hoy es `180 passed, 14 failed (194)`.

## Estructura

| Archivo | Qué contiene |
|---|---|
| `vitest.config.ts` | `include: tests/**/*.ts` (menos `harness`/`helpers`), cobertura v8 y el alias que traduce los imports `"./x.js"` de ESM NodeNext a los `.ts` reales. |
| `tests/harness.ts` | `test(id, desc, fn)` → `it()` de Vitest, aserciones cortas sobre `node:assert/strict` (`is`, `eq`, `ok`, `has`, `subset`, `grab`…), `soft()` para aserciones no abortivas, y re-export de `expect` / `vi` para casos nuevos (salvo `vi.mock()`, que exige importar `vi` de `"vitest"`). |
| `tests/helpers.ts` | Repositorios falsos como objetos de `vi.fn()` (`fakeUsuarios()`, `fakeCarritos()`…), fábricas de datos en español (`producto()`, `proyecto()`, `carrito()`…), `contextoExpress()` y `conRelojFijo()`. |
| `tests/mocks/repositorios.ts` | Instancias de mock compartidas entre la prueba y el código bajo prueba, más `reiniciarRepositorios()`. Excluido del `include` de Vitest. |
| `tests/F-<MODULO>-<NN>.ts` | Un archivo por unidad / grafo de flujo. |
| `tests/unit-*.ts` | Pruebas unitarias de controladores, repositorios Prisma, middlewares, validadores y rutas. |

No hay `run-all.ts`: Vitest descubre los archivos por el `include` del config.

### Mocks

No hay capa intermedia: los dobles **son** mocks de Vitest y se usan con su API
a la vista. Los repositorios falsos de `helpers.ts` son objetos planos de
`vi.fn()`, y en los casos se programan y comprueban así:

| Para qué | Cómo |
|---|---|
| Crear el doble | `vi.fn()` (o `vi.fn(impl)` con implementación por defecto) |
| Programar el retorno | `.mockResolvedValue(v)` · `.mockRejectedValue(e)` · `.mockReturnValue(v)` |
| Implementación propia | `.mockImplementation(f)` |
| Encolar una sola llamada | `.mockResolvedValueOnce(v)` |
| Rearmar a mitad de caso | `.mockReset()` (vuelve a la implementación inicial) |
| Inspeccionar argumentos | `.mock.calls[i][j]` |
| Comprobar la llamada | `expect(m).toHaveBeenCalledWith(...)` · `expect(m).not.toHaveBeenCalled()` |
| Congelar el reloj | `vi.useFakeTimers()` + `vi.setSystemTime()` (en `conRelojFijo`) |

Recuento actual: 129 `vi.fn()`, 208 programaciones (`mock*Value*`), 97 lecturas
de `.mock.calls` y 79 aserciones con matchers de mock.

#### Mockeo de módulos

Los controladores y `middlewares/auth.ts` construyen sus repositorios Prisma en
el ámbito del módulo y se los pasan a los casos de uso al importarse. Para
sustituirlos **no hay ninguna costura en producción**: se mockea el módulo, y el
constructor devuelve el doble compartido de `tests/mocks/repositorios.ts`.

```ts
vi.mock("../src/infrastructure/database/repositories/prisma-cart.repository.js", async () => {
  const { mockCarritos } = await import("./mocks/repositorios.js");
  return { PrismaCartRepository: vi.fn(() => mockCarritos) };
});

beforeEach(reiniciarRepositorios);
```

Como los casos de uso capturan la referencia al importar, `reiniciarRepositorios()`
no crea objetos nuevos: **renueva las propiedades del mismo objeto**, así cada caso
arranca con mocks limpios sin romper esa referencia.

`vi` se importa de `"vitest"` directamente en los archivos que usan `vi.mock()`:
la llamada se hoistea y Vitest no reconoce un `vi` re-exportado por `harness.ts`.

Archivos con `vi.mock()`: `unit-controllers.ts` (8 módulos), `unit-auth-middleware.ts`,
`unit-routes-and-server.ts`, `F-AUTH-03`, `F-ADM-01`, `F-ADM-02`, `F-ADM-03`.

Las pruebas de repositorio (`unit-prisma-repositories.ts`, `F-CAT-01`, `F-CHK-*`)
siguen inyectando un cliente `db` falso por constructor
(`new PrismaCartRepository(dbFalso)`), que es una dependencia declarada, no una
costura. Ninguna prueba toca una base de datos real.

## Catálogo de casos

| Módulo | Archivos | Casos |
|---|---|---|
| Autenticación (`F-AUTH`) | 3 | 17 |
| Catálogo (`F-CAT`) | 3 | 19 |
| Carrito y pago (`F-CHK`) | 3 | 14 |
| Proyectos (`F-PROY`) | 3 | 43 |
| Administración (`F-ADM`) | 3 | 16 |
| **Subtotal flujos** | **15** | **109** |
| Unitarias (`unit-*`) | 8 | 85 |
| **Total** | **23** | **194** |

## Defectos localizados

La suite mantiene aserciones estrictas que documentan la regla de negocio
exigida frente al comportamiento actual. Estos 14 casos **fallan a propósito**
hasta que se corrija el código.

| # | Defecto | Unidad | Caso que lo evidencia |
|---|---|---|---|
| 1 | La clasificación de material de construcción usa `nombre.includes("cal")`, rechazando «Piso Calacatta» legítimo | `CreateProjectUseCase`, `UpdateProjectUseCase`, `calculateMaterials` | `CP-F-PROY-01-06`, `CP-F-PROY-02-08` |
| 2 | Las paredes cotizan un producto vendido por galón como `precio_galón × m²` | `calculateMaterials` | `CP-F-PROY-02-02` |
| 3 | Un `materialType` desconocido se etiqueta con un formato y se cobra con el precio de otro | `calculateMaterials` | `CP-F-PROY-02-19` |
| 4 | El desperdicio se aplica a la baldosa pero no al pegante, la boquilla ni las crucetas | `calculateMaterials` | `CP-F-PROY-02-02` |
| 5 | El producto elegido desaparece de la cotización si no encaja en ninguna rama | `calculateMaterials` | `CP-F-PROY-02-06` |
| 6 | Se entregan herramientas de pintura en un proyecto de baldosa | `calculateMaterials` | `CP-F-PROY-02-02` |
| 7 | La lista manual de materiales se descarta en silencio al recalcular | `UpdateProjectUseCase` | `CP-F-PROY-03-07` |
| 8 | La calificación de una reseña no se revalida fuera del endpoint: un 99 se guarda y contamina el promedio | `CreateProductReviewUseCase` | `CP-F-CAT-03-04c` |
| 9 | La acumulación en el carrito no respeta el tope de 9999 (9999 + 9999 = 19998) | `PrismaCartRepository.addItem` | `CP-F-CHK-01-04` |
| 10 | Umbral de envío: `> 500000` (RF16) vs «igual o mayor» (HU19). Con 500.000 exactos se cobra envío | `GetCartUseCase`, `CreateOrderUseCase` | `CP-F-CHK-02-06`, `CP-F-CHK-03-03` |
| 11 | `totalUnits` resta las existencias negativas del total de unidades en bodega | `AdminController.getInventoryReport` | `CP-F-ADM-03-01`, `CP-F-ADM-03-05` |
| 12 | La API acepta publicar un producto con precio 0, que el panel prohíbe | `createProductSchema` | `CP-F-ADM-02-04` |
| 13 | Al bajar las existencias a 0 con `PUT`, el producto sigue marcado como disponible | `UpdateProductUseCase` | `CP-F-ADM-02-05` |

**Antes de "arreglar" un caso que parece mal, revisá esta tabla**: varios
codifican un conflicto de especificación, no un bug para parchear en silencio.
