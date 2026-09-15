// ============================================================================
// Instancias de mock compartidas entre la prueba y el código bajo prueba.
//
// Los controladores y el middleware de auth construyen sus repositorios en el
// ámbito del módulo (`new PrismaCartRepository()`) y se los pasan a los casos
// de uso una sola vez, al importar. `vi.mock()` hace que esos constructores
// devuelvan los objetos de acá, así la prueba y el controlador miran el mismo
// doble sin necesidad de ninguna costura en producción.
//
// Como los casos de uso capturan la referencia al importar, `reiniciar()` NO
// crea objetos nuevos: renueva las propiedades del mismo objeto. La identidad
// se mantiene y cada caso arranca con mocks limpios y sus implementaciones por
// defecto intactas.
//
// Uso en un archivo de pruebas:
//
//   vi.mock("../src/infrastructure/database/repositories/prisma-cart.repository.js", async () => {
//     const { mockCarritos } = await import("./mocks/repositorios.js");
//     return { PrismaCartRepository: vi.fn(() => mockCarritos) };
//   });
//   beforeEach(reiniciarRepositorios);
// ============================================================================

import {
  fakeUsuarios,
  fakeCarritos,
  fakeProductos,
  fakeProyectos,
  fakePedidos,
  fakeResenas,
  fakeCategorias,
  fakePrismaCliente,
} from "../helpers.js";

export const mockUsuarios = fakeUsuarios();
export const mockCarritos = fakeCarritos();
export const mockProductos = fakeProductos();
export const mockProyectos = fakeProyectos();
export const mockPedidos = fakePedidos();
export const mockResenas = fakeResenas();
export const mockCategorias = fakeCategorias();
export const mockPrisma = fakePrismaCliente();

/** Reemplaza las propiedades de `destino` por las de `fuente`, sin cambiar la referencia. */
function renovar(destino: Record<string, any>, fuente: Record<string, any>) {
  for (const clave of Object.keys(destino)) delete destino[clave];
  Object.assign(destino, fuente);
}

/** Deja todos los dobles como recién creados. Llamar en un `beforeEach`. */
export function reiniciarRepositorios() {
  renovar(mockUsuarios, fakeUsuarios());
  renovar(mockCarritos, fakeCarritos());
  renovar(mockProductos, fakeProductos());
  renovar(mockProyectos, fakeProyectos());
  renovar(mockPedidos, fakePedidos());
  renovar(mockResenas, fakeResenas());
  renovar(mockCategorias, fakeCategorias());
  renovar(mockPrisma, fakePrismaCliente());
}
