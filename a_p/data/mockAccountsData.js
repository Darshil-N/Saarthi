export const categories = [
  'Mechanical',
  'Electrical',
  'Civil',
  'Chemical',
  'Consumables'
];

export const vendors = [
  { id: 'V001', code: 'V-001', name: 'TechMech Industries', score: 92, deliveryReliability: 95, qualityPercent: 94 },
  { id: 'V002', code: 'V-002', name: 'ElectroIndia Corp', score: 88, deliveryReliability: 90, qualityPercent: 89 },
  { id: 'V003', code: 'V-003', name: 'Global Build Materials', score: 85, deliveryReliability: 82, qualityPercent: 85 },
  { id: 'V004', code: 'V-004', name: 'ChemSolve Solutions', score: 95, deliveryReliability: 96, qualityPercent: 98 },
  { id: 'V005', code: 'V-005', name: 'Everyday Supplies Ltd', score: 78, deliveryReliability: 75, qualityPercent: 80 },
  { id: 'V006', code: 'V-006', name: 'MechPro Parts', score: 89, deliveryReliability: 92, qualityPercent: 90 },
  { id: 'V007', code: 'V-007', name: 'Spark Electricals', score: 83, deliveryReliability: 85, qualityPercent: 82 },
  { id: 'V008', code: 'V-008', name: 'Solid Foundation Co', score: 91, deliveryReliability: 94, qualityPercent: 90 },
  { id: 'V009', code: 'V-009', name: 'PuraChem Ltd', score: 87, deliveryReliability: 88, qualityPercent: 88 },
  { id: 'V010', code: 'V-010', name: 'Reliable Consumables', score: 94, deliveryReliability: 98, qualityPercent: 95 },
];

const generateMaterials = () => {
  const mats = [];
  const baseNames = [
    { n: 'Steel Pipe 4"', c: 'Mechanical', u: 'Meters' },
    { n: 'Copper Wire 2.5mm', c: 'Electrical', u: 'Coil' },
    { n: 'Cement Grade 53', c: 'Civil', u: 'Bags' },
    { n: 'Sulfuric Acid', c: 'Chemical', u: 'Liters' },
    { n: 'Safety Gloves', c: 'Consumables', u: 'Pairs' },
    { n: 'Ball Bearing 6204', c: 'Mechanical', u: 'Pieces' },
    { n: 'Circuit Breaker 32A', c: 'Electrical', u: 'Pieces' },
    { n: 'TMT Bar 12mm', c: 'Civil', u: 'Tonnes' },
    { n: 'Industrial Solvents', c: 'Chemical', u: 'Liters' },
    { n: 'Masks N95', c: 'Consumables', u: 'Boxes' },
    { n: 'Hydraulic Pump', c: 'Mechanical', u: 'Pieces' },
    { n: 'Transformer 100kVA', c: 'Electrical', u: 'Pieces' },
    { n: 'Bricks Type A', c: 'Civil', u: 'Pallets' },
    { n: 'Nitric Acid', c: 'Chemical', u: 'Liters' },
    { n: 'Safety Boots', c: 'Consumables', u: 'Pairs' },
    { n: 'Conveyor Belt 10m', c: 'Mechanical', u: 'Meters' },
    { n: 'LED Panel 40W', c: 'Electrical', u: 'Pieces' },
    { n: 'Gravel 20mm', c: 'Civil', u: 'Tonnes' },
    { n: 'Caustic Soda', c: 'Chemical', u: 'Kg' },
    { n: 'Lubricant Oil', c: 'Consumables', u: 'Liters' },
    { n: 'Flange 6"', c: 'Mechanical', u: 'Pieces' },
    { n: 'Insulation Tape', c: 'Electrical', u: 'Rolls' },
  ];

  baseNames.forEach((b, i) => {
    mats.push({
      id: `M${String(i + 1).padStart(3, '0')}`,
      cnmc: `CNMC-${1000 + i}`,
      name: b.n,
      category: b.c,
      uom: b.u,
      specification: `Standard Spec for ${b.n}`,
      currentStock: Math.floor(Math.random() * 500) + 50,
      maxStock: Math.floor(Math.random() * 400) + 100, // Sometimes current > 1.5 * max
      lastMovement: new Date(Date.now() - Math.floor(Math.random() * 400) * 86400000).toISOString(),
    });
  });

  return mats;
};

export const materials = generateMaterials();

const generatePurchases = () => {
  const purchasesList = [];
  const start = new Date();
  start.setMonth(start.getMonth() - 12); // Last 12 months

  let grCount = 1000;

  materials.forEach(material => {
    // Each material has 2-3 specific vendors
    const materialVendors = [...vendors].sort(() => 0.5 - Math.random()).slice(0, 3);
    
    // Generate 10-20 purchases for each material spread over 12 months
    const numPurchases = Math.floor(Math.random() * 10) + 10;
    
    // Base price for material
    const basePrice = Math.floor(Math.random() * 5000) + 100;

    for (let i = 0; i < numPurchases; i++) {
      const vendor = materialVendors[Math.floor(Math.random() * materialVendors.length)];
      
      const pDate = new Date(start.getTime() + Math.random() * (Date.now() - start.getTime()));
      
      const unitPrice = basePrice + Math.floor(Math.random() * (basePrice * 0.2)) - (basePrice * 0.1); // +/- 10%
      const quantity = Math.floor(Math.random() * 50) + 10;

      purchasesList.push({
        id: `GR-${grCount++}`,
        date: pDate.toISOString(),
        vendorId: vendor.id,
        vendorName: vendor.name,
        materialId: material.id,
        materialName: material.name,
        cnmc: material.cnmc,
        category: material.category,
        quantity,
        uom: material.uom,
        unitPrice: Math.round(unitPrice),
        totalValue: Math.round(unitPrice * quantity),
        quality: Math.random() > 0.8 ? 'B' : 'A',
        location: ['Warehouse 1', 'Warehouse 2', 'Site A', 'Site B'][Math.floor(Math.random() * 4)],
      });
    }
  });

  return purchasesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const purchases = generatePurchases();
