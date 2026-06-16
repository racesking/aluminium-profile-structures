export type Vec3 = [number, number, number];

export type Node = {
  id: string;
  position: Vec3;
};

export type Edge = {
  id: string;
  fromId: string;
  toId: string;
};

export type Profile = {
  name: string;
  sectionLabel?: string;
  /** Cross-section size in mm (e.g. 20 for 20×20 extrusion). Drives member thickness in 3D. */
  sectionSizeMm?: number;
};

export type ClipboardPayload = {
  nodes: Node[];
  edges: Edge[];
  constraints: EdgeConstraint[];
};

export type StockBar = {
  id: string;
  length: number;
  quantity: number;
};

export type CutPiece = {
  edgeId: string;
  length: number;
  label?: string;
};

export type BarAssignment = {
  barIndex: number;
  stockLength: number;
  cuts: { length: number; edgeId: string; label?: string }[];
  used: number;
  waste: number;
};

export type CuttingResult = {
  bars: BarAssignment[];
  unplaced: CutPiece[];
  totalWaste: number;
  totalUsed: number;
  wastePercent: number;
  shortageMm: number;
  suggestedBars: { length: number; quantity: number } | null;
};

export type Selection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | null;

export type ViewPreset = 'perspective' | 'top' | 'front' | 'right';

export type ToolMode = 'select' | 'placeNode' | 'connect';

export type WorkPlane = 'xz' | 'xy' | 'yz' | 'free';

export type AxisLock = 'x' | 'y' | 'z' | null;

export type EdgeConstraintType = 'parallel' | 'perpendicular';

export type EdgeConstraint = {
  id: string;
  edgeAId: string;
  edgeBId: string;
  type: EdgeConstraintType;
};

export type HistorySnapshot = {
  nodes: Node[];
  edges: Edge[];
  constraints: EdgeConstraint[];
  edgeProfile: Record<string, string>;
};
