import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GeneratedCity, BuildingLot, BuildingStyle } from "../world/world-types";
import { CityCameraControls } from "./CityCameraControls";
import {
  createAsphaltGeometry,
  createBuildingWindowInstances,
  createRoadBedGeometry,
  createRoadMarkingGeometry,
  createStreetTreePositions,
  createTerrainGeometry,
} from "./city-geometry";

const BUILDING_STYLES: readonly BuildingStyle[] = [
  "residential",
  "office",
  "warehouse",
  "campus",
  "hangar",
  "historic",
  "civic",
  "retail",
];

const BUILDING_PALETTES: Record<BuildingStyle, readonly number[]> = {
  residential: [0xb39a7e, 0x96816d, 0xc0aa8d],
  office: [0x657f91, 0x7f98a8, 0x526b7d],
  warehouse: [0x79858a, 0x92999a, 0x687579],
  campus: [0x9aab91, 0x839982, 0xb0b69a],
  hangar: [0x9aa5a8, 0x7e8d91, 0xb0b8b5],
  historic: [0xb79a78, 0x9d8065, 0xc3ad8c],
  civic: [0x8a9aa2, 0xa8b5b4, 0x71858e],
  retail: [0xb28e70, 0x997b68, 0xc0a183],
};

interface CitySceneProps {
  city: GeneratedCity;
}

export function CityScene({ city }: CitySceneProps) {
  const terrainGeometry = useMemo(
    () => createTerrainGeometry(city.terrain),
    [city],
  );
  const roadBedGeometry = useMemo(
    () => createRoadBedGeometry(city.roadNetwork),
    [city],
  );
  const asphaltGeometry = useMemo(
    () => createAsphaltGeometry(city.roadNetwork),
    [city],
  );
  const arterialMarkings = useMemo(
    () => createRoadMarkingGeometry(city.roadNetwork, "arterial"),
    [city],
  );
  const localMarkings = useMemo(
    () => createRoadMarkingGeometry(city.roadNetwork, "local"),
    [city],
  );
  const windows = useMemo(
    () => createBuildingWindowInstances(
      city.buildings.filter((building) =>
        building.style !== "warehouse" && building.style !== "hangar"
      ),
    ),
    [city],
  );
  const trees = useMemo(
    () => createStreetTreePositions(city.roadNetwork),
    [city],
  );
  const lotsByStyle = useMemo(() => {
    const groups = new Map<BuildingStyle, BuildingLot[]>();
    for (const style of BUILDING_STYLES) groups.set(style, []);
    for (const building of city.buildings) groups.get(building.style)?.push(building);
    return groups;
  }, [city]);

  return (
    <>
      <CityCameraControls />
      <color attach="background" args={["#aebfc5"]} />
      <fog attach="fog" args={["#b8c8ca", 760, 2350]} />
      <hemisphereLight args={["#e3edf5", "#34473b", 1.05]} />
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[-460, 740, 360]}
        intensity={2.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-850}
        shadow-camera-right={850}
        shadow-camera-top={650}
        shadow-camera-bottom={-650}
        shadow-bias={-0.00012}
      />

      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.96} />
      </mesh>

      <mesh geometry={roadBedGeometry} receiveShadow>
        <meshStandardMaterial color="#777f7e" roughness={0.94} />
      </mesh>
      <mesh geometry={asphaltGeometry} receiveShadow>
        <meshStandardMaterial color="#27333a" roughness={0.91} metalness={0.04} />
      </mesh>
      <mesh geometry={arterialMarkings}>
        <meshStandardMaterial
          color="#f0c56b"
          roughness={0.7}
          emissive="#8c6428"
          emissiveIntensity={0.08}
        />
      </mesh>
      <mesh geometry={localMarkings}>
        <meshStandardMaterial color="#d9e0d9" roughness={0.76} />
      </mesh>

      {BUILDING_STYLES.map((style) => {
        const buildings = lotsByStyle.get(style) ?? [];
        return buildings.length > 0 ? (
          <BuildingInstances key={style} style={style} buildings={buildings} />
        ) : null;
      })}
      <BuildingWindows windows={windows} />
      <StreetTrees positions={trees} />
    </>
  );
}

function BuildingInstances({
  style,
  buildings,
}: {
  style: BuildingStyle;
  buildings: readonly BuildingLot[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: style === "office" ? 0.42 : 0.78,
      metalness: style === "office" ? 0.24 : 0.08,
    }),
    [style],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    const palettes = BUILDING_PALETTES[style];

    buildings.forEach((building, index) => {
      transform.position.set(
        building.position.x,
        building.position.y + building.height / 2,
        building.position.z,
      );
      transform.rotation.set(0, building.rotationY, 0);
      transform.scale.set(
        building.footprint.width,
        building.height,
        building.footprint.depth,
      );
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, new THREE.Color(palettes[index % palettes.length]));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [buildings, style]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, buildings.length]}
      castShadow
      receiveShadow
    />
  );
}

function BuildingWindows({
  windows,
}: {
  windows: ReturnType<typeof createBuildingWindowInstances>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#a9c9d5",
      roughness: 0.23,
      metalness: 0.62,
      emissive: "#284b5a",
      emissiveIntensity: 0.16,
    }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    windows.forEach((window, index) => {
      transform.position.set(
        window.position.x,
        window.position.y,
        window.position.z,
      );
      transform.rotation.set(0, window.rotationY, 0);
      transform.scale.set(window.width, window.height, window.depth);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [windows]);

  return windows.length > 0 ? (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, windows.length]}
      castShadow
    />
  ) : null;
}

function StreetTrees({ positions }: { positions: readonly THREE.Vector3[] | readonly { x: number; y: number; z: number }[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const trunkGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.22, 0.34, 2.4, 7),
    [],
  );
  const crownGeometry = useMemo(
    () => new THREE.DodecahedronGeometry(1.65, 0),
    [],
  );
  const trunkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#5e4937", roughness: 0.96 }),
    [],
  );
  const crownMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#547d4c",
      roughness: 0.92,
      flatShading: true,
    }),
    [],
  );

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const crown = crownRef.current;
    if (!trunk || !crown) return;
    const transform = new THREE.Object3D();

    positions.forEach((position, index) => {
      transform.position.set(position.x, position.y + 1.2, position.z);
      transform.rotation.set(0, (index % 7) * 0.31, 0);
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      trunk.setMatrixAt(index, transform.matrix);

      transform.position.set(position.x, position.y + 3.05, position.z);
      transform.scale.set(
        0.92 + (index % 3) * 0.08,
        0.94 + (index % 4) * 0.05,
        0.92 + (index % 2) * 0.1,
      );
      transform.updateMatrix();
      crown.setMatrixAt(index, transform.matrix);
    });

    trunk.instanceMatrix.needsUpdate = true;
    crown.instanceMatrix.needsUpdate = true;
    trunk.computeBoundingSphere();
    crown.computeBoundingSphere();
  }, [positions]);

  return positions.length > 0 ? (
    <>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeometry, trunkMaterial, positions.length]}
        castShadow
      />
      <instancedMesh
        ref={crownRef}
        args={[crownGeometry, crownMaterial, positions.length]}
        castShadow
        receiveShadow
      />
    </>
  ) : null;
}
