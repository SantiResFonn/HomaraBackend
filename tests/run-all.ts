// Ejecutor de la suite manual. `npm test` corre este archivo con tsx.
// Filtro opcional por id:  npm test -- F-CHK   /   npm test -- CP-F-AUTH-01-02
//
// Cada import registra sus casos con `test(...)`; `run()` los ejecuta.

import "./F-AUTH-01.js";
import "./F-AUTH-02.js";
import "./F-AUTH-03.js";
import "./F-CAT-01.js";
import "./F-CAT-02.js";
import "./F-CAT-03.js";
import "./F-CHK-01.js";
import "./F-CHK-02.js";
import "./F-CHK-03.js";
import "./F-PROY-01.js";
import "./F-PROY-02.js";
import "./F-PROY-03.js";
import "./F-ADM-01.js";
import "./F-ADM-02.js";
import "./F-ADM-03.js";
import "./unit-validate-zod.js";
import "./unit-error-handler.js";
import "./unit-validators.js";
import "./unit-entities.js";
import "./unit-auth-middleware.js";
import "./unit-controllers.js";
import "./unit-prisma-repositories.js";
import "./unit-routes-and-server.js";

import { run } from "./harness.js";

await run();
