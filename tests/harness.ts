// ============================================================================
// Arnés sobre Vitest.
//
// Los archivos `tests/F-*.ts` y `tests/unit-*.ts` siguen registrando casos con
// `test(id, desc, fn)`; acá eso se delega a `it()` de Vitest, que además provee
// el runner (paralelo por archivo), watch, filtros y cobertura.
//
//   npx vitest                      # watch
//   npm test                        # run completo
//   npm test -- tests/F-CHK-01.ts   # un archivo
//   npm test -- -t CP-F-AUTH-01-02  # un caso por id
//
// Las aserciones siguen siendo las de `node:assert/strict` envueltas en nombres
// cortos: funcionan igual dentro de Vitest. Para casos nuevos también se
// re-exporta `expect` y `vi`.
// ============================================================================

import { it } from "vitest";
import {
  deepStrictEqual,
  strictEqual,
  notStrictEqual,
  ok as nodeOk,
  match as nodeMatch,
} from "node:assert/strict";

export { expect, vi, describe, beforeEach, afterEach, beforeAll, afterAll } from "vitest";

export type TestFn = () => void | Promise<void>;

let softErrors: string[] = [];

/**
 * Aserción "blanda": registra el fallo pero no aborta el caso, para poder
 * documentar varios defectos en un mismo test (equivale a `expect.soft`).
 * Al final del caso, si hubo alguno, el caso se marca como fallido.
 */
export function soft(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    softErrors.push(e instanceof Error ? e.message : String(e));
  }
}

/** Envuelve el cuerpo del caso para agregar los fallos de `soft()` al final. */
function cuerpo(fn: TestFn) {
  return async () => {
    softErrors = [];
    await fn();
    if (softErrors.length) {
      const fallos = softErrors;
      softErrors = [];
      throw new Error(fallos.join("\n       ---\n"));
    }
  };
}

interface RegistrarCaso {
  /** Registra un caso en Vitest. El `id` es el identificador del plan (CP-F-...). */
  (id: string, desc: string, fn: TestFn): void;
  /**
   * Caso que documenta un **defecto abierto**: se espera que falle, así que la
   * suite queda en verde mientras el defecto siga ahí (ver la tabla de defectos
   * en `tests/README.md`).
   *
   * Ojo con la inversión: el día que alguien corrija el defecto, este caso se
   * pone **rojo** — es la señal de que hay que devolverlo a `test(...)` normal.
   */
  fails(id: string, desc: string, fn: TestFn): void;
}

export const test: RegistrarCaso = Object.assign(
  (id: string, desc: string, fn: TestFn): void => {
    it(`${id}  ${desc}`, cuerpo(fn));
  },
  {
    fails(id: string, desc: string, fn: TestFn): void {
      it.fails(`${id}  ${desc}`, cuerpo(fn));
    },
  },
);

// --- Aserciones -------------------------------------------------------------

/** Igualdad profunda (objetos, arrays, primitivos). */
export const eq = (actual: unknown, esperado: unknown, msg?: string) =>
  deepStrictEqual(actual, esperado, msg);

/** Igualdad estricta por referencia / primitivo (===). */
export const is = (actual: unknown, esperado: unknown, msg?: string) =>
  strictEqual(actual, esperado, msg);

/** Desigualdad estricta (!==). */
export const isNot = (actual: unknown, esperado: unknown, msg?: string) =>
  notStrictEqual(actual, esperado, msg);

/** El valor es truthy. */
export const ok = (valor: unknown, msg?: string) => nodeOk(valor, msg);

/** El string cumple la expresión regular. */
export const matches = (texto: string, re: RegExp, msg?: string) =>
  nodeMatch(texto, re, msg);

/** `contenedor` (string o array) incluye `parte`. */
export function has(contenedor: string | readonly unknown[], parte: unknown, msg?: string) {
  const dentro =
    typeof contenedor === "string"
      ? contenedor.includes(parte as string)
      : contenedor.includes(parte);
  nodeOk(dentro, msg ?? `Se esperaba encontrar ${rep(parte)} en ${rep(contenedor)}`);
}

/** `contenedor` (string o array) NO incluye `parte`. */
export function hasNot(contenedor: string | readonly unknown[], parte: unknown, msg?: string) {
  const dentro =
    typeof contenedor === "string"
      ? contenedor.includes(parte as string)
      : contenedor.includes(parte);
  nodeOk(!dentro, msg ?? `No se esperaba ${rep(parte)} en ${rep(contenedor)}`);
}

/** `actual` contiene al menos las claves/valores de `esperado` (match parcial). */
export function subset(actual: Record<string, unknown>, esperado: Record<string, unknown>, msg?: string) {
  for (const clave of Object.keys(esperado)) {
    deepStrictEqual(actual?.[clave], esperado[clave], msg ?? `Campo "${clave}"`);
  }
}

// --- Captura de errores ---------------------------------------------------

/** Espera que la promesa rechace y devuelve el error para inspeccionarlo. */
export async function grab(p: Promise<unknown>): Promise<any> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("Se esperaba un error y la operación terminó bien.");
}

/** Espera que la función lance y devuelve el error para inspeccionarlo. */
export function grabSync(fn: () => unknown): any {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("Se esperaba un error y la función no lanzó.");
}

function rep(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
