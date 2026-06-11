// Shared dorm colour system used by the Rooms, Room Assets, and Summary tables
// so they all look identical.
//
// One colour family per dorm (cycled by dorm order); within a dorm, rooms
// alternate between the light and slightly deeper shade so neighbours stay
// distinguishable. Hex values are given WITHOUT a leading "#".

export const DORM_PALETTE: [string, string][] = [
  ["FEF2F2", "FEE2E2"], // red
  ["EFF6FF", "DBEAFE"], // blue
  ["F0FDF4", "DCFCE7"], // green
  ["FFF7ED", "FFEDD5"], // orange
  ["F5F3FF", "EDE9FE"], // purple
  ["F0FDFA", "CCFBF1"], // teal
  ["FEFCE8", "FEF9C3"], // yellow
  ["FDF2F8", "FCE7F3"], // pink
];

// Header fill for the exported Excel files (slate-600), to match the on-screen
// slate table header.
export const REPORT_HEADER_FILL = "475569";

export const dormPair = (dormIndex: number): [string, string] => DORM_PALETTE[dormIndex % DORM_PALETTE.length];

/** roomId -> background shade, grouped by dorm with alternating shades per room. */
export function buildRoomShades(
  dorms: { id: number }[],
  rooms: { id: number; dorm_id: number; room_name: string }[],
): Map<number, string> {
  const shades = new Map<number, string>();
  dorms.forEach((dorm, dormIndex) => {
    const pair = dormPair(dormIndex);
    rooms
      .filter((room) => room.dorm_id === dorm.id)
      .sort((a, b) => a.room_name.localeCompare(b.room_name, "zh-Hans-CN"))
      .forEach((room, roomIndex) => shades.set(room.id, pair[roomIndex % 2]));
  });
  return shades;
}
