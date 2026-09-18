/**
 * BharatOil Warehouse Physical Topology (Mock Data)
 * Conforms strictly to Saarthi schema: locations table (architecture.md §5.1 & §13)
 * Code format: {WAREHOUSE}-{AISLE}-{RACK}-{BIN}
 */

export const mockWarehouses = [
  {
    code: "WHSE-A",
    name: "WHSE-A — Main Warehouse",
    department: "MECH-STORE",
    description: "Mechanical materials: Fasteners, Pipes, Flanges, Valves, Gaskets",
    totalCapacityBins: 48,
    aisles: [
      {
        id: "A1",
        name: "Aisle 1",
        category: "Fasteners, Bolts, Nuts & Washers",
        racks: ["R1", "R2", "R3", "R4", "R5"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
      {
        id: "A2",
        name: "Aisle 2",
        category: "Pipes, Fittings & Flanges",
        racks: ["R1", "R2", "R3", "R4"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
      {
        id: "A3",
        name: "Aisle 3",
        category: "Valves (Gate, Ball, Check)",
        racks: ["R1", "R2", "R3"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
    ],
  },
  {
    code: "WHSE-B",
    name: "WHSE-B — Electrical Store",
    department: "ELEC-STORE",
    description: "Electrical materials: Cables, Motors, Panels, Instruments",
    totalCapacityBins: 28,
    aisles: [
      {
        id: "A1",
        name: "Aisle 1",
        category: "Cables & Wires (LT / HT / Inst)",
        racks: ["R1", "R2", "R3", "R4"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
      {
        id: "A2",
        name: "Aisle 2",
        category: "Motors, Starters & Switchgear",
        racks: ["R1", "R2"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
      {
        id: "A3",
        name: "Aisle 3",
        category: "Instruments, Transmitters & Sensors",
        racks: ["R1"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
    ],
  },
  {
    code: "WHSE-C",
    name: "WHSE-C — Chemical & Consumables",
    department: "CHEM-STORE",
    description: "Chemicals, Oils, Lubricants, PPE, Welding & Hand Tools",
    totalCapacityBins: 28,
    aisles: [
      {
        id: "A1",
        name: "Aisle 1",
        category: "Lubricants, Greases & Industrial Oils",
        racks: ["R1", "R2"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
      {
        id: "A2",
        name: "Aisle 2",
        category: "PPE & Industrial Safety Equipment",
        racks: ["R1", "R2", "R3"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
      {
        id: "A3",
        name: "Aisle 3",
        category: "Welding Consumables & Workshop Tools",
        racks: ["R1", "R2"],
        binsPerRack: ["B1", "B2", "B3", "B4"],
      },
    ],
  },
];

export default mockWarehouses;
