import { Canvas } from "@react-three/fiber";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useGameStore } from "./app/game-store";
import "./style.css";

function StarterScene() {
  return (
    <>
      <color attach="background" args={["#0b1220"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[8, 12, 5]} intensity={2.1} castShadow />
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[1.1, 1.6, 1.1]} />
        <meshStandardMaterial color="#d8e4ef" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#182536" roughness={0.95} />
      </mesh>
      <gridHelper args={[100, 100, "#496176", "#26384a"]} />
    </>
  );
}

function App() {
  const phase = useGameStore((state) => state.phase);
  const setPhase = useGameStore((state) => state.setPhase);
  const togglePause = useGameStore((state) => state.togglePause);

  return (
    <main className="game-shell">
      <Canvas
        shadows
        camera={{ position: [7, 5, 8], fov: 48 }}
        dpr={[1, 1.75]}
      >
        <StarterScene />
      </Canvas>
      <header className="game-header">
        <div>
          <p className="eyebrow">PROJECT PHOENIX</p>
          <h1>NOVA CITY</h1>
        </div>
        <div className="phase-pill" aria-live="polite">
          {phase === "menu" ? "Initialisation" : phase === "playing" ? "En jeu" : "En pause"}
        </div>
      </header>
      <section className="game-panel" aria-label="Commandes de démarrage">
        <p className="panel-kicker">MONDE OUVERT</p>
        <h2>Une ville à découvrir.</h2>
        <p className="panel-copy">
          Les fondations du navigateur sont opérationnelles. Le monde et ses
          systèmes seront raccordés aux modules dédiés de NOVA CITY.
        </p>
        {phase === "menu" ? (
          <button className="primary-button" onClick={() => setPhase("playing")}>
            Démarrer
          </button>
        ) : (
          <button className="primary-button" onClick={togglePause}>
            {phase === "playing" ? "Mettre en pause" : "Reprendre"}
          </button>
        )}
      </section>
      <footer className="game-footer">
        <span>BUILD LOCAL</span>
        <span>Y ↑ · AVANT −Z</span>
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
