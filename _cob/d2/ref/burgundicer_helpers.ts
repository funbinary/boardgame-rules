export function shuffle<T>(array: T[]) {
  const resArray = array;
  for (let i = resArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [resArray[i], resArray[j]] = [resArray[j], resArray[i]];
  }
  return resArray;
}

const hexDirections = [
  [-1, 1, 0],
  [0, 1, -1],
  [1, 0, -1],
  [-1, 0, 1],
  [0, -1, 1],
  [1, -1, 0],
];

const cellList: CellContent[] = [
  "livestock",
  "livestock",
  "livestock",
  "livestock",
  "livestock",
  "livestock",
  "mine",
  "mine",
  "mine",
  "city",
  "city",
  "city",
  "city",
  "city",
  "city",
  "city",
  "city",
  "city",
  "city",
  "city",
  "city",
  "monastery",
  "monastery",
  "monastery",
  "monastery",
  "monastery",
  "monastery",
  "castle",
  "castle",
  "castle",
  "castle",
  "water",
  "water",
  "water",
  "water",
  "water",
  "water",
];

export const colors = {
  castle: "#009c00",
  livestock: "#63ff00",
  water: "#639cff",
  mine: "#9c9c9c",
  monastery: "#ffff00",
  city: "#ce9c00",
};

type Coordinate = -3 | -2 | -1 | 0 | 1 | 2 | 3;
type Dice = 1 | 2 | 3 | 4 | 5 | 6;

type CellContent =
  | "water"
  | "castle"
  | "monastery"
  | "city"
  | "mine"
  | "livestock";

export class MapCell {
  q: Coordinate;
  s: Coordinate;
  r: Coordinate;
  content: CellContent;
  dice: Dice;
  size: number;
  parent: null | MapCell;
  name: string;
  static nodeMap: Map<string, MapCell>;
  static largestSize: number;
  static largestPasture: number;

  constructor(
    r: Coordinate,
    s: Coordinate,
    q: Coordinate,
    content: CellContent,
    dice: Dice
  ) {
    this.q = q;
    this.s = s;
    this.r = r;
    this.content = content;
    this.dice = dice;

    this.size = 1;
    this.parent = null;
    this.name = `${r}|${s}|${q}`;
    if (!MapCell.nodeMap) {
      throw new Error("No nodemap is set");
    }
    MapCell.nodeMap.set(`${r}|${s}|${q}`, this);
  }

  find() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let currentNode: MapCell = this;
    while (currentNode.parent) {
      currentNode = currentNode.parent;
    }
    return currentNode.name;
  }

  static union(el1: MapCell, el2: MapCell) {
    const tag1 = el1.find();
    const tag2 = el2.find();
    const finalParent1 = MapCell.nodeMap.get(tag1);
    const finalParent2 = MapCell.nodeMap.get(tag2);
    if (tag1 === tag2) {
      return;
    } else if (finalParent1 && finalParent2) {
      if (finalParent1.size > finalParent2.size) {
        finalParent2.parent = finalParent1;
        finalParent1.size += finalParent2.size;
      } else {
        finalParent1.parent = finalParent2;
        finalParent2.size += finalParent1.size;
      }
      MapCell.largestSize = Math.max(
        finalParent1.size,
        finalParent2.size,
        MapCell.largestSize
      );
      if (finalParent1.content === "livestock") {
        MapCell.largestPasture = Math.max(
          finalParent1.size,
          finalParent2.size,
          MapCell.largestPasture
        );
      }
    }
  }
}

export function generateMap() {
  let duchyMap = [];
  MapCell.nodeMap = new Map<string, MapCell>();
  let allDices: Dice[] = [];
  do {
    allDices = [];
    for (let i = 0; i < 37; i++) {
      const dice = (Math.floor(Math.random() * 6) + 1) as Dice;
      allDices.push(dice);
    }
  } while (findVariance(allDices) < 1.4);

  while (true) {
    const randomizedTileList = shuffle(cellList);
    duchyMap = [];

    let index = 0;
    for (let r = -3; r <= 3; r++) {
      for (let s = -3; s <= 3; s++) {
        for (let q = -3; q <= 3; q++) {
          if (r + s + q !== 0) {
            continue;
          } else {
            duchyMap.push(
              new MapCell(
                r as Coordinate,
                s as Coordinate,
                q as Coordinate,
                randomizedTileList[index],
                allDices[index]
              )
            );
            index++;
          }
        }
      }
    }
    const duchyValues = getDuchyValues(duchyMap);
    if (duchyValues.largestCity <= 8 && duchyValues.largestPasture >= 3) {
      break;
    }
  }
  return duchyMap;
}

function findVariance(arr: number[]) {
  const mean = arr.reduce((acc, curr) => acc + curr, 0) / arr.length;
  return arr.reduce((acc, curr) => acc + (curr - mean) ** 2, 0) / arr.length;
}

function getDuchyValues(arr: MapCell[]) {
  MapCell.largestSize = 1;
  MapCell.largestPasture = 1;
  for (let i = 0; i < arr.length; i++) {
    const currentNode = MapCell.nodeMap.get(
      `${arr[i].r}|${arr[i].s}|${arr[i].q}`
    );
    if (
      currentNode?.content !== "city" &&
      currentNode?.content !== "livestock"
    ) {
      continue;
    }
    for (let d = 0; d < hexDirections.length; d++) {
      const targetNode = MapCell.nodeMap.get(
        `${arr[i].r + hexDirections[d][0]}|${arr[i].s + hexDirections[d][1]}|${
          arr[i].q + hexDirections[d][2]
        }`
      );

      if (
        targetNode &&
        currentNode &&
        targetNode.content === currentNode.content
      ) {
        MapCell.union(targetNode, currentNode);
      }
    }
  }
  return {
    largestCity: MapCell.largestSize,
    largestPasture: MapCell.largestPasture,
  };
}
