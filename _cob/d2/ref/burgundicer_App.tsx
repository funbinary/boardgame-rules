import { SVGProps, useState } from "react";
import "./App.css";
import { colors, generateMap } from "./helpers";
import type { MapCell } from "./helpers";

import dice1 from "./assets/dice1.svg";
import dice2 from "./assets/dice2.svg";
import dice3 from "./assets/dice3.svg";
import dice4 from "./assets/dice4.svg";
import dice5 from "./assets/dice5.svg";
import dice6 from "./assets/dice6.svg";

export function RiHexagonLine(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="120px"
      height="120px"
      viewBox="0 0 24 24"
      className="hexagon-svg"
      {...props}
    >
      <path
        fill="currentColor"
        d="M17.5 2.5L23 12l-5.5 9.5h-11L1 12l5.5-9.5zm-1.153 2H7.653L3.311 12l4.342 7.5h8.694l4.342-7.5z"
      ></path>
    </svg>
  );
}

function generateCellImage(cell: MapCell, index: number) {
  return (
    <div className="hexagon" key={index}>
      <RiHexagonLine style={{ color: colors[cell.content] }} />
      <img
        src={[dice1, dice2, dice3, dice4, dice5, dice6][cell.dice - 1]}
        className="dice"
        style={{
          backgroundColor: colors[cell.content],
        }}
      />
    </div>
  );
}
function App() {
  const [duchyMap, setMap] = useState<MapCell[]>([]);
  return (
    <>
      <h1>Burgundicer</h1>
      <button
        onClick={() => {
          setMap(generateMap());
        }}
      >
        {duchyMap.length > 0 ? "Reg" : "G"}enerate Map
      </button>

      {duchyMap.length > 0 && (
        <button
          onClick={() => {
            window.print();
          }}
        >
          Print
        </button>
      )}
      <div id="section-to-print">
        <div className="map-row">
          {duchyMap
            .filter((c) => c.r === -3)
            .map((c, index) => generateCellImage(c, index))}
        </div>
        <div className="map-row">
          {duchyMap
            .filter((c) => c.r === -2)
            .map((c, index) => generateCellImage(c, index))}
        </div>
        <div className="map-row">
          {duchyMap
            .filter((c) => c.r === -1)
            .map((c, index) => generateCellImage(c, index))}
        </div>
        <div className="map-row">
          {duchyMap
            .filter((c) => c.r === 0)
            .map((c, index) => generateCellImage(c, index))}
        </div>
        <div className="map-row">
          {duchyMap
            .filter((c) => c.r === 1)
            .map((c, index) => generateCellImage(c, index))}
        </div>
        <div className="map-row">
          {duchyMap
            .filter((c) => c.r === 2)
            .map((c, index) => generateCellImage(c, index))}
        </div>
        <div className="map-row">
          {duchyMap
            .filter((c) => c.r === 3)
            .map((c, index) => generateCellImage(c, index))}
        </div>
      </div>
      <div className="footer">
        <a href="https://github.com/emrergin/burgundicer" target="_blank">
          Source code
        </a>
      </div>
    </>
  );
}

export default App;
