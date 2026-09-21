import { BOARD_RADIUS } from "../constants";
import type { HexCell } from "../types";
import { hexDistance, hexKey } from "./hexGrid";

/**
 * Classic 37-hex duchy (radius 3, pointy-top). Center castle is die 6,
 * matching the recommended starting space on Duchies 1 and 2.
 */
export const PLAYER_BOARD: readonly HexCell[] = [
	{ q: 0, r: -3, kind: "animal", die: 4 },
	{ q: 1, r: -3, kind: "knowledge", die: 2 },
	{ q: 2, r: -3, kind: "knowledge", die: 5 },
	{ q: 3, r: -3, kind: "building", die: 3 },

	{ q: -1, r: -2, kind: "animal", die: 1 },
	{ q: 0, r: -2, kind: "castle", die: 5 },
	{ q: 1, r: -2, kind: "building", die: 6 },
	{ q: 2, r: -2, kind: "building", die: 1 },
	{ q: 3, r: -2, kind: "building", die: 4 },

	{ q: -2, r: -1, kind: "ship", die: 3 },
	{ q: -1, r: -1, kind: "animal", die: 6 },
	{ q: 0, r: -1, kind: "building", die: 2 },
	{ q: 1, r: -1, kind: "castle", die: 3 },
	{ q: 2, r: -1, kind: "mine", die: 5 },
	{ q: 3, r: -1, kind: "ship", die: 1 },

	{ q: -3, r: 0, kind: "ship", die: 6 },
	{ q: -2, r: 0, kind: "mine", die: 2 },
	{ q: -1, r: 0, kind: "knowledge", die: 4 },
	{ q: 0, r: 0, kind: "castle", die: 6 },
	{ q: 1, r: 0, kind: "animal", die: 3 },
	{ q: 2, r: 0, kind: "building", die: 5 },
	{ q: 3, r: 0, kind: "ship", die: 4 },

	{ q: -3, r: 1, kind: "knowledge", die: 1 },
	{ q: -2, r: 1, kind: "mine", die: 4 },
	{ q: -1, r: 1, kind: "animal", die: 2 },
	{ q: 0, r: 1, kind: "building", die: 3 },
	{ q: 1, r: 1, kind: "ship", die: 2 },
	{ q: 2, r: 1, kind: "castle", die: 2 },

	{ q: -3, r: 2, kind: "castle", die: 4 },
	{ q: -2, r: 2, kind: "building", die: 1 },
	{ q: -1, r: 2, kind: "mine", die: 6 },
	{ q: 0, r: 2, kind: "animal", die: 5 },
	{ q: 1, r: 2, kind: "building", die: 6 },

	{ q: -3, r: 3, kind: "ship", die: 5 },
	{ q: -2, r: 3, kind: "knowledge", die: 3 },
	{ q: -1, r: 3, kind: "castle", die: 1 },
	{ q: 0, r: 3, kind: "mine", die: 3 },
];

const byKey = new Map(PLAYER_BOARD.map((cell) => [hexKey(cell.q, cell.r), cell]));

export function getCell(q: number, r: number): HexCell | undefined {
	return byKey.get(hexKey(q, r));
}

export function isOnPlayerBoard(q: number, r: number): boolean {
	return hexDistance({ q, r }, { q: 0, r: 0 }) <= BOARD_RADIUS && byKey.has(hexKey(q, r));
}
