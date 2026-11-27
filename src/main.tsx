import { Canvas } from "@react-three/fiber";
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useGameStore } from "./app/game-store";
import { generateCity } from "./world";
import { CityScene } from "./rendering/CityScene";
import { VehicleScene } from "./rendering/VehicleScene";
import "./style.css";

function App() {
  const phase = useGameStore((state) => state.phase);
  const setPhase = useGameStore((state) => state.setPhase);
  const togglePause = useGameStore((state) => state.togglePause);
  const [speedKph, setSpeedKph] = useState(0);
  const city = useMemo(
    () => generateCity({ seed: "nova-city-preview-11", terrainSegmentsPerDistrict: 16 }),
    [],
  );

  return (
    <main className="game-shell">
      <Canvas
        frameloop="demand"
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: [790, 730, 930],
          fov: 43,
          near: 0.5,
          far: 4000,
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <CityScene city={city} enableCameraControls={phase !== "playing"} />
        <VehicleScene
          city={city}
          active={phase === "playing"}
          onSpeedChange={setSpeedKph}
        />
      </Canvas>

      <header className="game-header">
        <div className="brand-lockup">
          <p className="eyebrow">PROJECT PHOENIX / OPEN WORLD</p>
          <h1>NOVA CITY</h1>
        </div>
        <div className="header-status">
          <div className="phase-pill" aria-live="polite">
            {phase === "menu" ? "Aperçu prêt" : phase === "playing" ? "En visite" : "En pause"}
          </div>
          <div className="world-metrics">
            <span>{city.districts.length} QUARTIERS</span>
            <span>{city.roadNetwork.segments.length} ROUTES</span>
            <span>{city.buildings.length} BÂTIMENTS</span>
          </div>
        </div>
      </header>

      <aside className="district-rail" aria-label="Quartiers de NOVA CITY">
        <p className="rail-heading">LES TERRITOIRES</p>
        <ol>
          {city.districts.map((district, index) => (
            <li key={district.id}>
              <span className="district-index">{String(index + 1).padStart(2, "0")}</span>
              <span>{district.name}</span>
            </li>
          ))}
        </ol>
      </aside>

      <section className="game-panel" aria-label="Aperçu de NOVA CITY">
        <p className="panel-kicker">VUE AÉRIENNE / GÉNÉRATION PROCÉDURALE</p>
        <h2>Une métropole à explorer.</h2>
        <p className="panel-copy">
          Huit quartiers, un réseau routier continu et des centaines de bâtiments.
          Le paysage, les façades et la végétation sont assemblés en temps réel
          à partir du plan de ville.
        </p>
        {phase === "menu" ? (
          <button className="primary-button" onClick={() => setPhase("playing")}>
            Prendre le volant <span aria-hidden="true">↗</span>
          </button>
        ) : (
          <button className="primary-button" onClick={togglePause}>
            {phase === "playing" ? "Mettre en pause" : "Reprendre"}
          </button>
        )}
        <div className="panel-footnote">
          <span className="live-dot" />
          SCÈNE 3D ACTIVE
          <span className="footnote-divider">/</span>
          VÉHICULES ET TRAFIC
        </div>
      </section>

      {phase === "playing" ? (
        <aside className="driving-hud" aria-label="Télémétrie du véhicule">
          <span className="speed-caption">VITESSE</span>
          <strong data-testid="vehicle-speed">{speedKph}</strong>
          <span className="speed-unit">KM/H</span>
          <span className="driving-keys">WASD / FLÈCHES · ESPACE FREIN · MAJ FREIN À MAIN</span>
        </aside>
      ) : null}

      <footer className="game-footer">
        <span>NOVA CITY / VISUAL BUILD 0.11</span>
        <span>DRAG / ORBIT&nbsp; · &nbsp;WHEEL / ZOOM&nbsp; · &nbsp;RIGHT DRAG / PAN</span>
      </footer>
    </main>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
