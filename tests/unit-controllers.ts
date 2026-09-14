import { test, is, eq, ok } from "./harness.js";
import { contextoExpress, spy, fakeCarritos, fakePedidos, fakeProyectos, fakeProductos, fakeUsuarios, fakeResenas } from "./helpers.js";
import { CartController, setCartRepositoryForTests } from "../src/infrastructure/http/controllers/cart.controller.js";
import { OrderController, setOrderRepositoriesForTests } from "../src/infrastructure/http/controllers/order.controller.js";
import { ProjectController, setProjectRepositoriesForTests } from "../src/infrastructure/http/controllers/project.controller.js";
import { CatalogController, setCatalogRepositoriesForTests } from "../src/infrastructure/http/controllers/catalog.controller.js";
import { AuthController, setAuthRepositoryForTests } from "../src/infrastructure/http/controllers/auth.controller.js";
import { AdminController, setPrismaClientForTests as setAdminPrismaForTests } from "../src/infrastructure/http/controllers/admin.controller.js";
import { AppError } from "../src/shared/errors/AppError.js";

// ============================================================================
// CartController Tests
// ============================================================================

test("UNIT-CTRL-CART-01", "CartController.get retorna carrito vacío si no hay usuario ni query param", async () => {
  const { req, res, next } = contextoExpress();
  req.user = undefined;
  req.query = {};

  await CartController.get(req, res, next);

  is(res.body.success, true);
  is(res.body.data.id, "guest");
  is(res.body.data.itemCount, 0);
  is(next.calls.length, 0);
});

test("UNIT-CTRL-CART-02", "CartController.get obtiene carrito si hay usuario autenticado", async () => {
  const fakeCart = fakeCarritos();
  fakeCart.findByUserId.resolves({ id: "cart-1", userId: "usr-1", items: [] });
  setCartRepositoryForTests(fakeCart as any);

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };

  await CartController.get(req, res, next);

  is(res.body.success, true);
  is(res.body.data.id, "cart-1");
  is(next.calls.length, 0);
});

test("UNIT-CTRL-CART-03", "CartController.get delega errores a next", async () => {
  const fakeCart = fakeCarritos();
  fakeCart.findByUserId.rejects(new Error("DB Down"));
  setCartRepositoryForTests(fakeCart as any);

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };

  await CartController.get(req, res, next);

  is(next.calls.length, 1);
  is(next.calls[0][0].message, "DB Down");
});

test("UNIT-CTRL-CART-04", "CartController.addItem agrega producto y responde 201", async () => {
  const fakeCart = fakeCarritos();
  fakeCart.findByUserId.resolves({ id: "cart-1", userId: "usr-1", items: [] });
  fakeCart.addItem.resolves({ id: "cart-1", userId: "usr-1", items: [{ id: "item-1", productId: "prd-1", quantity: 2 }] });
  setCartRepositoryForTests(fakeCart as any);

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = { productId: "prd-1", quantity: 2 };

  await CartController.addItem(req, res, next);

  is(res.statusCode, 201);
  is(res.body.success, true);
  is(next.calls.length, 0);
});

test("UNIT-CTRL-CART-05", "CartController.addItem delega errores a next", async () => {
  const fakeCart = fakeCarritos();
  fakeCart.findByUserId.rejects(new Error("Error agregando"));
  setCartRepositoryForTests(fakeCart as any);

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = { productId: "prd-1", quantity: 2 };

  await CartController.addItem(req, res, next);

  is(next.calls.length, 1);
  is(next.calls[0][0].message, "Error agregando");
});

test("UNIT-CTRL-CART-06", "CartController.updateItemQuantity actualiza cantidad y responde 200", async () => {
  const fakeCart = fakeCarritos();
  fakeCart.findItemOwner.resolves("usr-1");
  fakeCart.updateItemQuantity.resolves({ id: "cart-1", userId: "usr-1", items: [{ id: "item-1", quantity: 5 }] });
  setCartRepositoryForTests(fakeCart as any);

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { itemId: "item-1" };
  req.body = { quantity: 5 };

  await CartController.updateItemQuantity(req, res, next);

  is(res.body.success, true);
  is(next.calls.length, 0);
});

test("UNIT-CTRL-CART-07", "CartController.updateItemQuantity delega error a next", async () => {
  const fakeCart = fakeCarritos();
  fakeCart.findItemOwner.rejects(new Error("Error"));
  setCartRepositoryForTests(fakeCart as any);

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { itemId: "item-1" };
  req.body = { quantity: 5 };

  await CartController.updateItemQuantity(req, res, next);

  is(next.calls.length, 1);
});

test("UNIT-CTRL-CART-08", "CartController.removeItem remueve item y responde 200", async () => {
  const fakeCart = fakeCarritos();
  fakeCart.findItemOwner.resolves("usr-1");
  fakeCart.removeItem.resolves({ id: "cart-1", userId: "usr-1", items: [] });
  setCartRepositoryForTests(fakeCart as any);

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { itemId: "item-1" };

  await CartController.removeItem(req, res, next);

  is(res.body.success, true);
  is(next.calls.length, 0);
});

test("UNIT-CTRL-CART-09", "CartController.removeItem delega error a next", async () => {
  const fakeCart = fakeCarritos();
  fakeCart.findItemOwner.rejects(new Error("Error"));
  setCartRepositoryForTests(fakeCart as any);

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { itemId: "item-1" };

  await CartController.removeItem(req, res, next);

  is(next.calls.length, 1);
});

// ============================================================================
// OrderController Tests
// ============================================================================

test("UNIT-CTRL-ORD-01", "OrderController.list retorna vacío si no hay userId", async () => {
  const { req, res, next } = contextoExpress();
  req.user = undefined;
  req.query = {};

  await OrderController.list(req, res, next);

  is(res.body.success, true);
  eq(res.body.data, []);
  is(next.calls.length, 0);
});

test("UNIT-CTRL-ORD-02", "OrderController.list lista pedidos para usuario autenticado", async () => {
  const fakeOrder = fakePedidos();
  fakeOrder.findAll.resolves([{ id: "ord-1", orderNumber: "ORD-1", status: "PENDIENTE", total: 100000, createdAt: new Date() }]);
  setOrderRepositoriesForTests({ orderRepo: fakeOrder as any });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.query = { admin: "false" };

  await OrderController.list(req, res, next);

  is(res.body.success, true);
  is(res.body.data.length, 1);
  is(next.calls.length, 0);
});

test("UNIT-CTRL-ORD-03", "OrderController.list delega errores a next", async () => {
  const fakeOrder = fakePedidos();
  fakeOrder.findAll.rejects(new Error("DB Error"));
  setOrderRepositoriesForTests({ orderRepo: fakeOrder as any });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.query = {};

  await OrderController.list(req, res, next);

  is(next.calls.length, 1);
});

test("UNIT-CTRL-ORD-04", "OrderController.getDetail retorna detalle de pedido", async () => {
  const fakeOrder = fakePedidos();
  fakeOrder.findByIdOrNumber.resolves({
    id: "ord-1",
    orderNumber: "ORD-2026-001",
    status: "PENDIENTE",
    subtotal: 100000,
    shippingCost: 0,
    total: 100000,
    paymentMethod: "TARJETA",
    shippingAddress: "A",
    shippingCity: "B",
    shippingState: "C",
    shippingZip: "D",
    shippingNotes: null,
    createdAt: new Date()
  });
  setOrderRepositoriesForTests({ orderRepo: fakeOrder as any });

  const { req, res, next } = contextoExpress();
  req.params = { id: "ord-1" };

  await OrderController.getDetail(req, res, next);

  is(res.body.success, true);
  is(res.body.data.id, "ORD-2026-001");
  is(next.calls.length, 0);
});

test("UNIT-CTRL-ORD-05", "OrderController.getDetail delega error a next", async () => {
  const fakeOrder = fakePedidos();
  fakeOrder.findByIdOrNumber.rejects(new Error("No encontrado"));
  setOrderRepositoriesForTests({ orderRepo: fakeOrder as any });

  const { req, res, next } = contextoExpress();
  req.params = { id: "ord-none" };

  await OrderController.getDetail(req, res, next);

  is(next.calls.length, 1);
});

test("UNIT-CTRL-ORD-06", "OrderController.create crea orden y responde 201", async () => {
  const fakeOrder = fakePedidos();
  const fakeCart = fakeCarritos();
  const fakeProd = fakeProductos();

  fakeCart.findByUserId.resolves({
    id: "cart-1",
    userId: "usr-1",
    items: [{ id: "ci-1", productId: "prd-1", quantity: 1, unitPrice: 50000, total: 50000 }]
  });
  fakeProd.findById.resolves({ id: "prd-1", price: 50000, inStock: true, stockQuantity: 10 });
  fakeCart.getReservedQuantities.resolves({});
  fakeOrder.create.resolves({ id: "ord-1", orderNumber: "ORD-2026-001", total: 75000 });

  setOrderRepositoriesForTests({
    orderRepo: fakeOrder as any,
    cartRepo: fakeCart as any,
    productRepo: fakeProd as any
  });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = {
    paymentMethod: "TARJETA",
    shippingAddress: "Calle 10 #20-30",
    shippingCity: "Bogotá",
    shippingState: "Cundinamarca",
    shippingZip: "110111"
  };

  await OrderController.create(req, res, next);

  is(res.statusCode, 201);
  is(res.body.success, true);
  is(next.calls.length, 0);
});

test("UNIT-CTRL-ORD-07", "OrderController.create delega error a next", async () => {
  const fakeOrder = fakePedidos();
  const fakeCart = fakeCarritos();
  fakeCart.findByUserId.rejects(new Error("Cart error"));

  setOrderRepositoriesForTests({
    orderRepo: fakeOrder as any,
    cartRepo: fakeCart as any
  });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = {};

  await OrderController.create(req, res, next);

  is(next.calls.length, 1);
});

test("UNIT-CTRL-ORD-08", "OrderController.updateStatus actualiza estado y responde 200", async () => {
  const fakeOrder = fakePedidos();
  fakeOrder.updateStatus.resolves({ id: "ord-1", status: "ENVIADO" });
  setOrderRepositoriesForTests({ orderRepo: fakeOrder as any });

  const { req, res, next } = contextoExpress();
  req.params = { id: "ord-1" };
  req.body = { status: "ENVIADO" };

  await OrderController.updateStatus(req, res, next);

  is(res.body.success, true);
  is(res.body.data.status, "ENVIADO");
  is(next.calls.length, 0);
});

test("UNIT-CTRL-ORD-09", "OrderController.updateStatus delega error a next", async () => {
  const fakeOrder = fakePedidos();
  fakeOrder.updateStatus.rejects(new Error("Invalid status"));
  setOrderRepositoriesForTests({ orderRepo: fakeOrder as any });

  const { req, res, next } = contextoExpress();
  req.params = { id: "ord-1" };
  req.body = { status: "INVALID" };

  await OrderController.updateStatus(req, res, next);

  is(next.calls.length, 1);
});

// ============================================================================
// ProjectController Tests
// ============================================================================

test("UNIT-CTRL-PROY-01", "ProjectController.list retorna vacío si no hay userId", async () => {
  const { req, res, next } = contextoExpress();
  req.user = undefined;
  req.query = {};

  await ProjectController.list(req, res, next);

  is(res.body.success, true);
  eq(res.body.data, []);
  is(next.calls.length, 0);
});

test("UNIT-CTRL-PROY-02", "ProjectController.list lista proyectos de usuario", async () => {
  const fakeProy = fakeProyectos();
  fakeProy.findAllByUserId.resolves([{ id: "p-1", name: "Baño" }]);
  setProjectRepositoriesForTests({ projectRepo: fakeProy as any });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };

  await ProjectController.list(req, res, next);

  is(res.body.success, true);
  is(res.body.data.length, 1);
});

test("UNIT-CTRL-PROY-03", "ProjectController.list delega error a next", async () => {
  const fakeProy = fakeProyectos();
  fakeProy.findAllByUserId.rejects(new Error("Error"));
  setProjectRepositoriesForTests({ projectRepo: fakeProy as any });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };

  await ProjectController.list(req, res, next);

  is(next.calls.length, 1);
});

test("UNIT-CTRL-PROY-04", "ProjectController.getDetail retorna proyecto y maneja error", async () => {
  const fakeProy = fakeProyectos();
  fakeProy.findById.resolves({ id: "p-1", name: "Cocina" });
  setProjectRepositoriesForTests({ projectRepo: fakeProy as any });

  const { req, res, next } = contextoExpress();
  req.params = { id: "p-1" };

  await ProjectController.getDetail(req, res, next);

  is(res.body.success, true);
  is(res.body.data.id, "p-1");

  // Error case
  fakeProy.findById.rejects(new Error("No encontrado"));
  const ctxErr = contextoExpress();
  ctxErr.req.params = { id: "p-none" };
  await ProjectController.getDetail(ctxErr.req, ctxErr.res, ctxErr.next);
  is(ctxErr.next.calls.length, 1);
});

test("UNIT-CTRL-PROY-05", "ProjectController.create crea proyecto y responde 201", async () => {
  const fakeProy = fakeProyectos();
  fakeProy.create.resolves({ id: "p-new", name: "Sala", userId: "usr-1" });
  setProjectRepositoriesForTests({ projectRepo: fakeProy as any });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = { name: "Sala", type: "PISO", area: 25, materialType: "ceramica", tileFormat: "60x60" };

  await ProjectController.create(req, res, next);

  is(res.statusCode, 201);
  is(res.body.success, true);

  // Error delegation
  fakeProy.create.rejects(new Error("Creation failed"));
  const ctxErr = contextoExpress();
  ctxErr.req.user = { id: "usr-1" };
  ctxErr.req.body = req.body;
  await ProjectController.create(ctxErr.req, ctxErr.res, ctxErr.next);
  is(ctxErr.next.calls.length, 1);
});

test("UNIT-CTRL-PROY-06", "ProjectController.update actualiza proyecto y delega error", async () => {
  const fakeProy = fakeProyectos();
  fakeProy.findById.resolves({ id: "p-1", userId: "usr-1", name: "Sala" });
  fakeProy.update.resolves({ id: "p-1", name: "Sala Grande" });
  setProjectRepositoriesForTests({ projectRepo: fakeProy as any });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { id: "p-1" };
  req.body = { name: "Sala Grande" };

  await ProjectController.update(req, res, next);

  is(res.body.success, true);
  is(res.body.data.name, "Sala Grande");

  // Error case
  fakeProy.findById.rejects(new Error("Fail"));
  const ctxErr = contextoExpress();
  ctxErr.req.user = { id: "usr-1" };
  ctxErr.req.params = { id: "p-1" };
  ctxErr.req.body = { name: "Fail" };
  await ProjectController.update(ctxErr.req, ctxErr.res, ctxErr.next);
  is(ctxErr.next.calls.length, 1);
});

test("UNIT-CTRL-PROY-07", "ProjectController.delete borra proyecto y delega error", async () => {
  const fakeProy = fakeProyectos();
  fakeProy.findById.resolves({ id: "p-1", userId: "usr-1" });
  fakeProy.delete.resolves();
  setProjectRepositoriesForTests({ projectRepo: fakeProy as any });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { id: "p-1" };

  await ProjectController.delete(req, res, next);

  is(res.body.success, true);

  // Error case
  fakeProy.findById.rejects(new Error("Error borrando"));
  const ctxErr = contextoExpress();
  ctxErr.req.user = { id: "usr-1" };
  ctxErr.req.params = { id: "p-1" };
  await ProjectController.delete(ctxErr.req, ctxErr.res, ctxErr.next);
  is(ctxErr.next.calls.length, 1);
});

// ============================================================================
// CatalogController Tests
// ============================================================================

test("UNIT-CTRL-CAT-01", "CatalogController.listCategories y listProducts funcionan y delegan errores", async () => {
  const fakeCategoryRepo = { findAll: spy(async () => [{ id: "cat-1", name: "Pisos" }]) };
  const fakeProductRepo = fakeProductos();
  const fakeCartRepo = fakeCarritos();

  fakeProductRepo.findAll.resolves([{ id: "prd-1", name: "Piso Blanco" }]);
  fakeCartRepo.getReservedQuantities.resolves({});

  setCatalogRepositoriesForTests({
    categoryRepo: fakeCategoryRepo as any,
    productRepo: fakeProductRepo as any,
    cartRepo: fakeCartRepo as any
  });

  // listCategories
  const ctxCat = contextoExpress();
  await CatalogController.listCategories(ctxCat.req, ctxCat.res, ctxCat.next);
  is(ctxCat.res.body.success, true);
  is(ctxCat.res.body.data.length, 1);

  // listCategories error
  fakeCategoryRepo.findAll.rejects(new Error("Cat err"));
  const ctxCatErr = contextoExpress();
  await CatalogController.listCategories(ctxCatErr.req, ctxCatErr.res, ctxCatErr.next);
  is(ctxCatErr.next.calls.length, 1);

  // listProducts
  const ctxProd = contextoExpress();
  ctxProd.req.query = { category: "pisos", q: "blanco" };
  await CatalogController.listProducts(ctxProd.req, ctxProd.res, ctxProd.next);
  is(ctxProd.res.body.success, true);
  is(ctxProd.res.body.data.length, 1);

  // listProducts error
  fakeProductRepo.findAll.rejects(new Error("Prod err"));
  const ctxProdErr = contextoExpress();
  ctxProdErr.req.query = {};
  await CatalogController.listProducts(ctxProdErr.req, ctxProdErr.res, ctxProdErr.next);
  is(ctxProdErr.next.calls.length, 1);
});

test("UNIT-CTRL-CAT-02", "CatalogController.getProductDetail y getStorefrontProducts", async () => {
  const fakeProductRepo = fakeProductos();
  const fakeCartRepo = fakeCarritos();
  fakeProductRepo.findById.resolves({ id: "prd-1", name: "Piso" });
  fakeCartRepo.getReservedQuantities.resolves({});
  fakeProductRepo.findStorefrontRecommended.resolves([{ id: "r1" }]);
  fakeProductRepo.findStorefrontOffers.resolves([{ id: "o1" }]);
  fakeProductRepo.findStorefrontBestSellers.resolves([{ id: "b1" }]);

  setCatalogRepositoriesForTests({
    productRepo: fakeProductRepo as any,
    cartRepo: fakeCartRepo as any
  });

  // getProductDetail
  const ctxDet = contextoExpress();
  ctxDet.req.params = { id: "prd-1" };
  await CatalogController.getProductDetail(ctxDet.req, ctxDet.res, ctxDet.next);
  is(ctxDet.res.body.success, true);
  is(ctxDet.res.body.data.id, "prd-1");

  // getProductDetail error
  fakeProductRepo.findById.rejects(new Error("Det err"));
  const ctxDetErr = contextoExpress();
  ctxDetErr.req.params = { id: "prd-none" };
  await CatalogController.getProductDetail(ctxDetErr.req, ctxDetErr.res, ctxDetErr.next);
  is(ctxDetErr.next.calls.length, 1);

  // getStorefrontProducts
  const ctxStore = contextoExpress();
  await CatalogController.getStorefrontProducts(ctxStore.req, ctxStore.res, ctxStore.next);
  is(ctxStore.res.body.success, true);
  is(ctxStore.res.body.data.recommended.length, 1);

  // getStorefrontProducts error
  fakeProductRepo.findStorefrontRecommended.rejects(new Error("Store err"));
  const ctxStoreErr = contextoExpress();
  await CatalogController.getStorefrontProducts(ctxStoreErr.req, ctxStoreErr.res, ctxStoreErr.next);
  is(ctxStoreErr.next.calls.length, 1);
});

test("UNIT-CTRL-CAT-03", "CatalogController CRUD productos y reseñas de catálogo", async () => {
  const fakeProductRepo = fakeProductos();
  const fakeReviewRepo = fakeResenas();

  fakeReviewRepo.findByProductId.resolves([{ id: "rev-1", rating: 5 }]);
  fakeReviewRepo.findByUserAndProduct.resolves(null);
  fakeProductRepo.findById.resolves({ id: "prd-1", name: "Piso" });
  fakeReviewRepo.create.resolves({ id: "rev-1", rating: 5, comment: "Buenisimo" });
  fakeReviewRepo.getAverageRatingAndCount.resolves({ average: 5, count: 1 });
  fakeProductRepo.updateProductRating.resolves();
  fakeProductRepo.create.resolves({ id: "prd-new", name: "Nuevo" });
  fakeProductRepo.update.resolves({ id: "prd-1", name: "Modificado" });
  fakeProductRepo.delete.resolves();

  setCatalogRepositoriesForTests({
    productRepo: fakeProductRepo as any,
    reviewRepo: fakeReviewRepo as any
  });

  // getProductReviews
  const ctxRevList = contextoExpress();
  ctxRevList.req.params = { id: "prd-1" };
  await CatalogController.getProductReviews(ctxRevList.req, ctxRevList.res, ctxRevList.next);
  is(ctxRevList.res.body.success, true);

  // createReview
  const ctxRevCreate = contextoExpress();
  ctxRevCreate.req.params = { id: "prd-1" };
  ctxRevCreate.req.user = { id: "usr-1" };
  ctxRevCreate.req.body = { rating: 5, comment: "Buenisimo" };
  await CatalogController.createReview(ctxRevCreate.req, ctxRevCreate.res, ctxRevCreate.next);
  is(ctxRevCreate.res.statusCode, 201);

  // createProduct
  const ctxProdCreate = contextoExpress();
  ctxProdCreate.req.body = { name: "Nuevo", price: 10000 };
  await CatalogController.createProduct(ctxProdCreate.req, ctxProdCreate.res, ctxProdCreate.next);
  is(ctxProdCreate.res.statusCode, 201);

  // updateProduct
  const ctxProdUpd = contextoExpress();
  ctxProdUpd.req.params = { id: "prd-1" };
  ctxProdUpd.req.body = { name: "Modificado" };
  await CatalogController.updateProduct(ctxProdUpd.req, ctxProdUpd.res, ctxProdUpd.next);
  is(ctxProdUpd.res.body.success, true);

  // deleteProduct
  const ctxProdDel = contextoExpress();
  ctxProdDel.req.params = { id: "prd-1" };
  await CatalogController.deleteProduct(ctxProdDel.req, ctxProdDel.res, ctxProdDel.next);
  is(ctxProdDel.res.body.success, true);

  // Delega errores a next en delete
  fakeProductRepo.delete.rejects(new Error("Del err"));
  const ctxDelErr = contextoExpress();
  ctxDelErr.req.params = { id: "prd-1" };
  await CatalogController.deleteProduct(ctxDelErr.req, ctxDelErr.res, ctxDelErr.next);
  is(ctxDelErr.next.calls.length, 1);

  // Delega errores en createReview
  fakeReviewRepo.findByUserAndProduct.rejects(new Error("Rev err"));
  const ctxRevErr = contextoExpress();
  ctxRevErr.req.params = { id: "prd-1" };
  ctxRevErr.req.user = { id: "usr-1" };
  ctxRevErr.req.body = { rating: 5 };
  await CatalogController.createReview(ctxRevErr.req, ctxRevErr.res, ctxRevErr.next);
  is(ctxRevErr.next.calls.length, 1);

  // Delega errores en getProductReviews
  fakeReviewRepo.findByProductId.rejects(new Error("Rev list err"));
  const ctxRevListErr = contextoExpress();
  ctxRevListErr.req.params = { id: "prd-1" };
  await CatalogController.getProductReviews(ctxRevListErr.req, ctxRevListErr.res, ctxRevListErr.next);
  is(ctxRevListErr.next.calls.length, 1);

  // Delega errores en createProduct
  fakeProductRepo.create.rejects(new Error("Create prod err"));
  const ctxProdCreateErr = contextoExpress();
  ctxProdCreateErr.req.body = { name: "Nuevo" };
  await CatalogController.createProduct(ctxProdCreateErr.req, ctxProdCreateErr.res, ctxProdCreateErr.next);
  is(ctxProdCreateErr.next.calls.length, 1);

  // Delega errores en updateProduct
  fakeProductRepo.update.rejects(new Error("Update prod err"));
  const ctxProdUpdErr = contextoExpress();
  ctxProdUpdErr.req.params = { id: "prd-1" };
  ctxProdUpdErr.req.body = { name: "Modificado" };
  await CatalogController.updateProduct(ctxProdUpdErr.req, ctxProdUpdErr.res, ctxProdUpdErr.next);
  is(ctxProdUpdErr.next.calls.length, 1);
});

// ============================================================================
// AuthController Tests
// ============================================================================

test("UNIT-CTRL-AUTH-01", "AuthController.register y login exitosos", async () => {
  const fakeUserRepo = fakeUsuarios();
  fakeUserRepo.findByEmail.resolves(null);
  fakeUserRepo.create.resolves({ id: "usr-new", email: "new@homara.co", role: "CUSTOMER" });

  setAuthRepositoryForTests(fakeUserRepo as any);

  // Register
  const ctxReg = contextoExpress();
  ctxReg.req.body = { email: "new@homara.co", password: "Password123!", firstName: "Ana", lastName: "Rojas" };
  await AuthController.register(ctxReg.req, ctxReg.res, ctxReg.next);
  is(ctxReg.res.statusCode, 201);
  is(ctxReg.res.body.success, true);

  // Register error delegation
  fakeUserRepo.findByEmail.rejects(new Error("Reg err"));
  const ctxRegErr = contextoExpress();
  ctxRegErr.req.body = ctxReg.req.body;
  await AuthController.register(ctxRegErr.req, ctxRegErr.res, ctxRegErr.next);
  is(ctxRegErr.next.calls.length, 1);
});

test("UNIT-CTRL-AUTH-02", "AuthController.getMe y getById formatean perfil", async () => {
  const fakeUserRepo = fakeUsuarios();
  const fakeDb = {
    project: { count: spy(async () => 3) },
    order: { count: spy(async () => 5) }
  };

  fakeUserRepo.findById.resolves({
    id: "usr-1",
    email: "user@homara.co",
    firstName: "Carlos",
    lastName: "Perez",
    role: "CUSTOMER",
    createdAt: new Date()
  });

  setAuthRepositoryForTests(fakeUserRepo as any, fakeDb);

  // getMe
  const ctxMe = contextoExpress();
  ctxMe.req.user = { id: "usr-1" };
  await AuthController.getMe(ctxMe.req, ctxMe.res, ctxMe.next);
  is(ctxMe.res.body.success, true);
  is(ctxMe.res.body.data.projectCount, 3);
  is(ctxMe.res.body.data.orderCount, 5);

  // getById ("me")
  const ctxByIdMe = contextoExpress();
  ctxByIdMe.req.user = { id: "usr-1" };
  ctxByIdMe.req.params = { id: "me" };
  await AuthController.getById(ctxByIdMe.req, ctxByIdMe.res, ctxByIdMe.next);
  is(ctxByIdMe.res.body.success, true);
  is(ctxByIdMe.res.body.data.id, "usr-1");

  // getById ("other")
  const ctxByIdOther = contextoExpress();
  ctxByIdOther.req.params = { id: "usr-2" };
  await AuthController.getById(ctxByIdOther.req, ctxByIdOther.res, ctxByIdOther.next);
  is(ctxByIdOther.res.body.success, true);

  // getById error delegation
  fakeUserRepo.findById.rejects(new Error("Find err"));
  const ctxErr = contextoExpress();
  ctxErr.req.params = { id: "me" };
  ctxErr.req.user = { id: "usr-1" };
  await AuthController.getById(ctxErr.req, ctxErr.res, ctxErr.next);
  is(ctxErr.next.calls.length, 1);
});

test("UNIT-CTRL-AUTH-03", "AuthController.update restringe acceso y actualiza campos permitidos", async () => {
  const fakeUserRepo = fakeUsuarios();
  fakeUserRepo.update.resolves({ id: "usr-1", firstName: "NuevoNombre" });

  setAuthRepositoryForTests(fakeUserRepo as any);

  // No autorizado (intenta modificar otro perfil sin ser admin)
  const ctxForbidden = contextoExpress();
  ctxForbidden.req.user = { id: "usr-1", role: "CUSTOMER" };
  ctxForbidden.req.params = { id: "usr-other" };
  ctxForbidden.req.body = { firstName: "Hacker" };
  await AuthController.update(ctxForbidden.req, ctxForbidden.res, ctxForbidden.next);
  is(ctxForbidden.next.calls.length, 1);
  const err = ctxForbidden.next.calls[0][0];
  ok(err instanceof AppError);
  is(err.statusCode, 403);

  // Autorizado (modifica su propio perfil "me")
  const ctxOk = contextoExpress();
  ctxOk.req.user = { id: "usr-1", role: "CUSTOMER" };
  ctxOk.req.params = { id: "me" };
  ctxOk.req.body = { firstName: "NuevoNombre" };
  await AuthController.update(ctxOk.req, ctxOk.res, ctxOk.next);
  is(ctxOk.res.body.success, true);
  is(ctxOk.res.body.data.firstName, "NuevoNombre");

  // Autorizado con cambio de contraseña
  const ctxPass = contextoExpress();
  ctxPass.req.user = { id: "usr-1", role: "CUSTOMER" };
  ctxPass.req.params = { id: "usr-1" };
  ctxPass.req.body = { password: "NewPassword123" };
  await AuthController.update(ctxPass.req, ctxPass.res, ctxPass.next);
  is(ctxPass.res.body.success, true);
});

// ============================================================================
// AdminController Tests
// ============================================================================

test("UNIT-CTRL-ADM-01", "AdminController.getMetrics calcula métricas y delega errores a next", async () => {
  const fakeDb = {
    order: {
      findMany: spy()
        .resolvesOnce([{ total: 100000, status: "ENTREGADO" }])
        .resolvesOnce([{ total: 80000, status: "ENTREGADO" }])
        .resolvesOnce([
          { total: 100000, createdAt: new Date() }
        ]),
      count: spy(async () => 5)
    },
    orderItem: {
      findMany: spy(async () => [
        { total: 50000, product: { category: { name: "Pisos" } } }
      ])
    },
    product: {
      count: spy(async () => 40)
    },
    user: {
      count: spy(async () => 12)
    }
  };

  setAdminPrismaForTests(fakeDb);

  // Success
  const ctx = contextoExpress();
  await AdminController.getMetrics(ctx.req, ctx.res, ctx.next);
  is(ctx.res.body.success, true);
  is(Array.isArray(ctx.res.body.data), true);
  is(ctx.res.body.data[0].label, "Ventas del Mes");
  is(ctx.res.body.data[1].label, "Pedidos Activos");
  is(ctx.res.body.charts.topCategories.length, 1);
  is(ctx.next.calls.length, 0);

  // Error delegation
  fakeDb.order.findMany.rejects(new Error("Metrics DB Err"));
  const ctxErr = contextoExpress();
  await AdminController.getMetrics(ctxErr.req, ctxErr.res, ctxErr.next);
  is(ctxErr.next.calls.length, 1);
  is(ctxErr.next.calls[0][0].message, "Metrics DB Err");
});

test("UNIT-CTRL-ADM-02", "AdminController.getInventoryReport genera estadísticas de inventario y delega errores", async () => {
  const fakeDb = {
    product: {
      findMany: spy(async () => [
        { id: "p1", name: "Piso", category: { name: "Pisos" }, stockQuantity: 60, unit: "m²", price: 50000, inStock: true },
        { id: "p2", name: "Pintura", category: { name: "Pinturas" }, stockQuantity: 20, unit: "galon", price: 30000, inStock: true },
        { id: "p3", name: "Tornillos", category: { name: "Fijaciones" }, stockQuantity: 0, unit: "caja", price: 5000, inStock: false },
        { id: "p4", name: "Defectuoso", category: { name: "Varios" }, stockQuantity: -2, unit: "u", price: 1000, inStock: false },
      ])
    }
  };

  setAdminPrismaForTests(fakeDb);

  // Success
  const ctx = contextoExpress();
  await AdminController.getInventoryReport(ctx.req, ctx.res, ctx.next);
  is(ctx.res.body.success, true);
  const stats = ctx.res.body.data.stats;
  is(stats.totalProducts, 4);
  is(stats.totalUnits, 78);
  is(stats.lowStockCount, 1);
  is(stats.outOfStockCount, 1);
  is(stats.negativeStockCount, 1);
  is(ctx.next.calls.length, 0);

  // Error delegation
  fakeDb.product.findMany.rejects(new Error("Inventory DB Err"));
  const ctxErr = contextoExpress();
  await AdminController.getInventoryReport(ctxErr.req, ctxErr.res, ctxErr.next);
  is(ctxErr.next.calls.length, 1);
  is(ctxErr.next.calls[0][0].message, "Inventory DB Err");
});
