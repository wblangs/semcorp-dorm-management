// Shared dorm colour system used by the Rooms, Room Assets, and Summary tables
// so they all look identical.
//
// Each dorm gets one soft colour (cycled by dorm order). The colour is shown as
// a pill badge on the dorm name and a 5px left border on the row; rows stay
// white. `excel` is the same shade as a bare hex (no "#") for ExcelJS fills.

export type DormColor = {
  bg: string;
  text: string;
  border: string; // light accent
  borderStrong: string; // darker accent (alternate rooms within a dorm)
  excel: string;
};

export const DORM_PALETTE: DormColor[] = [
  { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", borderStrong: "#60a5fa", excel: "EFF6FF" }, // blue
  { bg: "#ecfdf5", text: "#047857", border: "#bbf7d0", borderStrong: "#4ade80", excel: "ECFDF5" }, // green
  { bg: "#fffbeb", text: "#b45309", border: "#fde68a", borderStrong: "#fbbf24", excel: "FFFBEB" }, // amber
  { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe", borderStrong: "#a78bfa", excel: "F5F3FF" }, // violet
  { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", borderStrong: "#fb7185", excel: "FFF1F2" }, // rose
  { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4", borderStrong: "#2dd4bf", excel: "F0FDFA" }, // teal
];

// Dark header fill for exported Excel files (white text on slate-900).
export const REPORT_HEADER_FILL = "0F172A";

export const dormColorAt = (index: number): DormColor => DORM_PALETTE[index % DORM_PALETTE.length];

/** dorm.id -> colour, assigned by dorm order. */
export function dormColorMap(dorms: { id: number }[]): Map<number, DormColor> {
  const map = new Map<number, DormColor>();
  dorms.forEach((dorm, index) => map.set(dorm.id, dormColorAt(index)));
  return map;
}

/**
 * roomId -> whether the room is an "alternate" room within its dorm.
 * Alternating rooms get a light tinted background so neighbouring rooms in the
 * same dorm are visually separated.
 */
export function buildRoomAlt(
  dorms: { id: number }[],
  rooms: { id: number; dorm_id: number; room_name: string }[],
): Map<number, boolean> {
  const map = new Map<number, boolean>();
  dorms.forEach((dorm) => {
    rooms
      .filter((room) => room.dorm_id === dorm.id)
      .sort((a, b) => a.room_name.localeCompare(b.room_name, "zh-Hans-CN"))
      .forEach((room, index) => map.set(room.id, index % 2 === 1));
  });
  return map;
}
