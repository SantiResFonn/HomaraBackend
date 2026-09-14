// ============================================
// Homara — Domain Service: Material Calculator (TS)
// ============================================

interface CalculatorParams {
  type: string;
  area: number;
  materialType?: string;
  tileFormat?: string;
  
  // Nuevos parámetros de personalización
  wastePercent?: number;
  layingPattern?: string;
  deductDoors?: number;
  deductWindows?: number;
  customSubtractions?: number;
  includeAdhesive?: boolean;
  includeGrout?: boolean;
  includeSpacers?: boolean;
  includeTools?: boolean;
  selectedProduct?: {
    id: string;
    name: string;
    price: number;
    unit: string;
  };
}

interface CalculatedMaterial {
  name: string;
  quantity: string;
  note: string | null;
  icon: string;
  price: number;
  productId?: string | null;
}

const PRICES = {
  pegante: 28500,     // por bulto de 25kg
  boquilla: 12000,    // por kg
  crucetas: 8500,     // por bolsa de 100u
  nivel: 35000,       // unidad
  cinta: 15000,       // rollo
  primer: 45000,      // galón
  pintura: 125000,    // galón (precio base)
  rodillo: 34500,     // unidad
  brocha: 12000,      // unidad
  enmascarar: 9500,   // rollo
  llana: 18500,       // llana metálica para cerámica
  mazo: 14500,        // mazo de goma
};

const COVERAGE = {
  pegante: 4,         // m² por bulto
  boquilla: 8,        // m² por kg
  crucetas: 15,       // m² por bolsa
  pintura: 30,        // m² por galón con 2 manos
};

const TILE_PRICES: Record<string, Record<string, number>> = {
  ceramica: {
    "60x60": 38900,
    "45x45": 32000,
    "30x60": 35500,
    "20x60": 34000,
    "80x80": 42000,
    "100x100": 48000,
    "15x90": 36000,
    "30x30": 29000,
    "10x20": 31000,
  },
  porcelanato: {
    "60x60": 45900,
    "45x45": 39000,
    "30x60": 42000,
    "20x60": 41000,
    "80x80": 54000,
    "100x100": 65000,
    "15x90": 45000,
    "30x30": 36000,
    "10x20": 38000,
  },
  madera: {
    "60x60": 52000,
    "45x45": 48000,
    "30x60": 50000,
    "20x60": 49000,
    "80x80": 58000,
    "100x100": 68000,
    "15x90": 51000,
    "30x30": 42000,
    "10x20": 44000,
  },
  vinilo: {
    "60x60": 28000,
    "45x45": 25000,
    "30x60": 27000,
    "20x60": 26000,
    "80x80": 32000,
    "100x100": 38000,
    "15x90": 28000,
    "30x30": 22000,
    "10x20": 24000,
  },
};

const MATERIAL_NAMES: Record<string, string> = {
  ceramica: "Cerámica",
  porcelanato: "Porcelanato",
  madera: "Madera laminada",
  vinilo: "Vinilo",
  pintura: "Pintura Premium",
};

const FORMAT_LABELS: Record<string, string> = {
  "60x60": "60x60 cm",
  "45x45": "45x45 cm",
  "30x60": "30x60 cm",
  "20x60": "20x60 cm",
  "80x80": "80x80 cm",
  "100x100": "100x100 cm",
  "15x90": "15x90 cm",
  "30x30": "30x30 cm",
  "10x20": "10x20 cm",
};

function parseWeightFromProductName(name: string): number | null {
  const regexKg = /\b(\d+(?:\.\d+)?)\s*(?:kg|kilos|kilogramos)\b/i;
  const regexG = /\b(\d+(?:\.\d+)?)\s*(?:g|gramos)\b/i;

  const matchKg = regexKg.exec(name);
  if (matchKg) {
    return Number.parseFloat(matchKg[1]);
  }

  const matchG = regexG.exec(name);
  if (matchG) {
    return Number.parseFloat(matchG[1]) / 1000;
  }

  return null;
}

function getEffectiveWastePercent(
  wastePercent: number | undefined,
  materialType: string,
  layingPattern: string
): number {
  if (wastePercent !== undefined && wastePercent !== null) {
    return wastePercent;
  }
  if (materialType === "pintura") {
    return 5;
  }
  switch (layingPattern) {
    case "diagonal":
      return 15;
    case "trabadura":
      return 12;
    case "directo":
    default:
      return 10;
  }
}

function calculateMainCovering(
  selectedProduct: CalculatorParams["selectedProduct"],
  isConstructionMaterial: boolean,
  materialType: string,
  tileFormat: string,
  totalArea: number,
  actualWastePercent: number
): CalculatedMaterial {
  if (selectedProduct && !isConstructionMaterial) {
    const qtyUnit = selectedProduct.unit || "m²";
    const isPaintProduct = qtyUnit === "galón" || qtyUnit === "galones" || materialType === "pintura";

    if (isPaintProduct) {
      const galones = Math.ceil(totalArea / 30);
      return {
        name: selectedProduct.name,
        quantity: `${galones} ${qtyUnit}`,
        note: `Cálculo exacto: 1 galón por cada 30m² (Incluye +${actualWastePercent}% de desperdicio)`,
        icon: "🎨",
        price: selectedProduct.price * galones,
        productId: selectedProduct.id,
      };
    }

    return {
      name: selectedProduct.name,
      quantity: `${totalArea} ${qtyUnit}`,
      note: `Cálculo exacto con +${actualWastePercent}% de desperdicio`,
      icon: "🏗️",
      price: selectedProduct.price * totalArea,
      productId: selectedProduct.id,
    };
  }

  if (materialType === "pintura") {
    const galones = Math.ceil(totalArea / COVERAGE.pintura);
    return {
      name: "Pintura Premium de Interior/Exterior",
      quantity: `${galones} galón(es)`,
      note: `Rendimiento aproximado de 30m² c/u con 2 manos (Incluye +${actualWastePercent}% desperdicio)`,
      icon: "🎨",
      price: PRICES.pintura * galones,
      productId: null,
    };
  }

  const matName = MATERIAL_NAMES[materialType] || "Cerámica";
  const formatLabel = FORMAT_LABELS[tileFormat] || tileFormat;
  const pricePerM2 = TILE_PRICES[materialType]?.[tileFormat] || TILE_PRICES.ceramica["60x60"];

  return {
    name: `${matName} ${formatLabel}`,
    quantity: `${totalArea} m²`,
    note: `+${actualWastePercent}% de desperdicio por colocación`,
    icon: "🏗️",
    price: pricePerM2 * totalArea,
    productId: null,
  };
}

function calculateAdhesiveSupply(
  netArea: number,
  selectedProduct: CalculatorParams["selectedProduct"],
  isPeganteProduct: boolean
): CalculatedMaterial {
  if (isPeganteProduct && selectedProduct) {
    const parsedWeight = parseWeightFromProductName(selectedProduct.name);
    const weight = parsedWeight ?? 25;
    const coverage = weight * 0.16;
    const bultos = Math.ceil(netArea / coverage);
    const formattedCoverage = Number(coverage.toFixed(2));
    return {
      name: selectedProduct.name,
      quantity: `${bultos} ${selectedProduct?.unit || "bultos"}`,
      note: parsedWeight !== null
        ? `Pegante real vinculado: 1 unidad de ${weight}kg por cada ${formattedCoverage}m²`
        : "Pegante real vinculado: 1 bulto por cada 4m²",
      icon: "🧱",
      price: selectedProduct.price * bultos,
      productId: selectedProduct.id,
    };
  }

  const bultos = Math.ceil(netArea / COVERAGE.pegante);
  return {
    name: "Pegante cerámico flexible 25kg",
    quantity: `${bultos} bultos`,
    note: "25kg c/u (Rendimiento: 4m²/bulto)",
    icon: "🧱",
    price: PRICES.pegante * bultos,
    productId: null,
  };
}

function calculateGroutSupply(
  netArea: number,
  selectedProduct: CalculatorParams["selectedProduct"],
  isBoquillaProduct: boolean
): CalculatedMaterial {
  if (isBoquillaProduct && selectedProduct) {
    const parsedWeight = parseWeightFromProductName(selectedProduct.name);
    const weight = parsedWeight ?? 1;
    const coverage = weight * 8;
    const units = Math.ceil(netArea / coverage);
    const formattedCoverage = Number(coverage.toFixed(2));
    return {
      name: selectedProduct.name,
      quantity: `${units} ${selectedProduct?.unit || "unidades"}`,
      note: parsedWeight !== null
        ? `Boquilla real vinculada: 1 unidad de ${weight}kg por cada ${formattedCoverage}m²`
        : "Boquilla real vinculada: 1 kg por cada 8m²",
      icon: "🪣",
      price: selectedProduct.price * units,
      productId: selectedProduct.id,
    };
  }

  const kgBoquilla = Math.ceil(netArea / COVERAGE.boquilla);
  return {
    name: "Boquilla",
    quantity: `${kgBoquilla} kg`,
    note: "Rendimiento: 8m²/kg",
    icon: "🪣",
    price: PRICES.boquilla * kgBoquilla,
    productId: null,
  };
}

function calculateTileSupplies(
  netArea: number,
  includeAdhesive: boolean,
  includeGrout: boolean,
  includeSpacers: boolean,
  selectedProduct: CalculatorParams["selectedProduct"],
  isPeganteProduct: boolean,
  isBoquillaProduct: boolean
): CalculatedMaterial[] {
  const supplies: CalculatedMaterial[] = [];

  if (includeAdhesive) {
    supplies.push(calculateAdhesiveSupply(netArea, selectedProduct, isPeganteProduct));
  }

  if (includeGrout) {
    supplies.push(calculateGroutSupply(netArea, selectedProduct, isBoquillaProduct));
  }

  if (includeSpacers) {
    const bolsasCrucetas = Math.ceil(netArea / COVERAGE.crucetas);
    supplies.push({
      name: "Crucetas 2mm",
      quantity: `${bolsasCrucetas} bolsas`,
      note: "100 unidades c/u (Rendimiento: 15m²/bolsa)",
      icon: "➕",
      price: PRICES.crucetas * bolsasCrucetas,
      productId: null,
    });
  }

  return supplies;
}

function calculateTools(
  materialType: string,
  selectedProduct: CalculatorParams["selectedProduct"],
  isTile: boolean
): CalculatedMaterial[] {
  if (materialType === "pintura" || selectedProduct?.unit === "galón") {
    return [
      {
        name: "Kit Rodillo Antigoteo Profesional 23cm",
        quantity: "1 unidad",
        note: "Incluye bandeja y felpa de microfibra",
        icon: "🖌️",
        price: PRICES.rodillo,
        productId: null,
      },
      {
        name: "Brocha de cerda fina 2.5\"",
        quantity: "1 unidad",
        note: "Para retoques y esquinas",
        icon: "🖌️",
        price: PRICES.brocha,
        productId: null,
      },
      {
        name: "Cinta de enmascarar premium 1\"",
        quantity: "2 rollos",
        note: "Para protección de bordes y zócalos",
        icon: "📏",
        price: PRICES.enmascarar * 2,
        productId: null,
      },
    ];
  }

  const toolList: CalculatedMaterial[] = [
    {
      name: "Nivel de burbuja profesional 60cm",
      quantity: "1 unidad",
      note: "Para alineación exacta de la superficie",
      icon: "📏",
      price: PRICES.nivel,
      productId: null,
    },
  ];

  if (isTile) {
    toolList.push(
      {
        name: "Llana metálica dentada 10x10mm",
        quantity: "1 unidad",
        note: "Para distribución correcta del pegante",
        icon: "🛠️",
        price: PRICES.llana,
        productId: null,
      },
      {
        name: "Mazo de goma blanco anti-marca",
        quantity: "1 unidad",
        note: "Para asentamiento de baldosas sin fracturas",
        icon: "🔨",
        price: PRICES.mazo,
        productId: null,
      }
    );
  }

  return toolList;
}

const CONSTRUCTION_KEYWORDS = [
  "pegante",
  "cemento",
  "adhesivo",
  "mortero",
  "yeso",
  "cal",
  "boquilla",
];

const PEGANTE_KEYWORDS = [
  "pegante",
  "cemento",
  "adhesivo",
  "mortero",
  "yeso",
  "cal",
];

function identifyProductTypes(selectedProduct: CalculatorParams["selectedProduct"]) {
  if (!selectedProduct) {
    return {
      isConstructionMaterial: false,
      isPeganteProduct: false,
      isBoquillaProduct: false,
    };
  }

  const nameLower = selectedProduct.name.toLowerCase();
  const hasKeyword = (keywords: string[]) => keywords.some((kw) => nameLower.includes(kw));

  return {
    isConstructionMaterial: hasKeyword(CONSTRUCTION_KEYWORDS),
    isPeganteProduct: hasKeyword(PEGANTE_KEYWORDS),
    isBoquillaProduct: nameLower.includes("boquilla"),
  };
}

function calculateNetArea(
  area: number,
  deductDoors = 0,
  deductWindows = 0,
  customSubtractions = 0
): number {
  const doorsDeduction = deductDoors * 2.0;
  const windowsDeduction = deductWindows * 1.5;
  const totalDeductions = doorsDeduction + windowsDeduction + customSubtractions;
  return Math.max(0.1, area - totalDeductions);
}

function calculateAdditionalFloorSupplies(
  materialType: string,
  selectedProduct: CalculatorParams["selectedProduct"],
  netArea: number,
  includeAdhesive: boolean
): CalculatedMaterial[] {
  if (!includeAdhesive) {
    return [];
  }

  const supplies: CalculatedMaterial[] = [];
  const nameLower = selectedProduct?.name.toLowerCase() ?? "";
  const isWood = materialType === "madera" || nameLower.includes("madera");
  const isVinyl = materialType === "vinilo" || nameLower.includes("vinilo");

  if (isWood) {
    const rollos = Math.ceil(netArea / 20);
    supplies.push({
      name: "Cinta underlayment",
      quantity: `${rollos} rollos`,
      note: "20m² c/u (Aislamiento acústico y de humedad)",
      icon: "📏",
      price: PRICES.cinta * rollos,
      productId: null,
    });
  }

  if (isVinyl) {
    const galones = Math.ceil(netArea / 15);
    supplies.push({
      name: "Primer para vinilo",
      quantity: `${galones} galones`,
      note: "15m² c/u (Adherencia óptima)",
      icon: "🪣",
      price: PRICES.primer * galones,
      productId: null,
    });
  }

  return supplies;
}

function calculateIntegralWallMaterials(
  type: string,
  materialType: string,
  tileFormat: string,
  netArea: number,
  wasteMultiplier: number,
  actualWastePercent: number,
  selectedProduct: CalculatorParams["selectedProduct"]
): CalculatedMaterial[] {
  if (type.toLowerCase() !== "integral" || materialType === "pintura") {
    return [];
  }

  const wallArea = Math.ceil(Number((netArea * 0.6).toFixed(4)));
  const wallTotal = Math.ceil(Number((wallArea * wasteMultiplier).toFixed(4)));

  if (selectedProduct) {
    return [
      {
        name: `${selectedProduct.name} Pared`.trim(),
        quantity: `${wallTotal} m²`,
        note: `Paredes estimadas (+${actualWastePercent}% desperdicio)`,
        icon: "🧱",
        price: selectedProduct.price * wallTotal,
        productId: selectedProduct.id,
      },
    ];
  }

  const matName = MATERIAL_NAMES[materialType] || "Cerámica";
  const formatLabel = FORMAT_LABELS[tileFormat] || tileFormat;
  const pricePerM2 = TILE_PRICES[materialType]?.[tileFormat] || TILE_PRICES.ceramica["60x60"];

  return [
    {
      name: `${matName} Pared ${formatLabel}`.trim(),
      quantity: `${wallTotal} m²`,
      note: `Paredes estimadas (+${actualWastePercent}% desperdicio)`,
      icon: "🧱",
      price: pricePerM2 * wallTotal,
      productId: null,
    },
  ];
}

export function calculateMaterials({
  type,
  area,
  materialType = "ceramica",
  tileFormat = "60x60",
  wastePercent,
  layingPattern = "directo",
  deductDoors = 0,
  deductWindows = 0,
  customSubtractions = 0,
  includeAdhesive = true,
  includeGrout = true,
  includeSpacers = true,
  includeTools = true,
  selectedProduct,
}: CalculatorParams): CalculatedMaterial[] {
  const materials: CalculatedMaterial[] = [];

  // 1. Cálculo del Área Neta considerando deducciones
  const netArea = calculateNetArea(area, deductDoors, deductWindows, customSubtractions);

  // 2. Cálculo de Desperdicio
  const actualWastePercent = getEffectiveWastePercent(wastePercent, materialType, layingPattern);
  const wasteMultiplier = 1 + (actualWastePercent / 100);
  const totalArea = Math.ceil(Number((netArea * wasteMultiplier).toFixed(4)));

  // 3. Identificación de producto
  const { isConstructionMaterial, isPeganteProduct, isBoquillaProduct } = identifyProductTypes(selectedProduct);

  // 4. Material de revestimiento principal
  materials.push(
    calculateMainCovering(selectedProduct, isConstructionMaterial, materialType, tileFormat, totalArea, actualWastePercent)
  );

  // 5. Insumos para baldosas (cerámica y porcelanato)
  const isTile = materialType === "ceramica" || materialType === "porcelanato";
  if (isTile) {
    materials.push(
      ...calculateTileSupplies(netArea, includeAdhesive, includeGrout, includeSpacers, selectedProduct, isPeganteProduct, isBoquillaProduct)
    );
  }

  // 6. Insumos para Madera laminada y Vinilo
  materials.push(...calculateAdditionalFloorSupplies(materialType, selectedProduct, netArea, includeAdhesive));

  // 7. Herramientas
  if (includeTools) {
    materials.push(...calculateTools(materialType, selectedProduct, isTile));
  }

  // 8. Estimación de paredes si es de tipo integral y no es pintura pura
  materials.push(
    ...calculateIntegralWallMaterials(type, materialType, tileFormat, netArea, wasteMultiplier, actualWastePercent, selectedProduct)
  );

  return materials;
}
