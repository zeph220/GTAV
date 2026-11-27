import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GeneratedCity } from "../world/world-types";
import { DEFAULT_CITY_PEDESTRIAN_POPULATION } from "../ai/session/create-pedestrian-session";
import { Transform } from "../gameplay/ecs/components";
import { Civilian } from "../ai/civilian/civilian-components";
import { createPedestrianSession } from "../ai/session/create-pedestrian-session";

const TORSO_GEOMETRY = new THREE.CapsuleGeometry(0.23, 0.62, 4, 8);
const HEAD_GEOMETRY = new THREE.SphereGeometry(0.16, 10, 8);
const LEG_GEOMETRY = new THREE.CapsuleGeometry(0.07, 0.4, 3, 6);
const ARM_GEOMETRY = new THREE.CapsuleGeometry(0.06, 0.38, 3, 6);
const CROWD_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.82,
  metalness: 0.02,
});
const SKIN_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#d0a98e",
  roughness: 0.9,
});
const ARCHETYPE_COLORS: Record<string, number> = {
  commuter: 0x496b8b,
  resident: 0x6d8462,
  visitor: 0xb28a4f,
  worker: 0x8e6661,
};

interface PedestrianSceneProps {
  city: GeneratedCity;
  active?: boolean;
  population?: number;
}

export function PedestrianScene({
  city,
  active = true,
  population = DEFAULT_CITY_PEDESTRIAN_POPULATION,
}: PedestrianSceneProps) {
  const session = useMemo(
    () => createPedestrianSession(city, { population }),
    [city, population],
  );
  const { invalidate } = useThree();
  const torsoRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const torsoDummy = useMemo(() => new THREE.Object3D(), []);
  const headDummy = useMemo(() => new THREE.Object3D(), []);
  const legDummy = useMemo(() => new THREE.Object3D(), []);
  const armDummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const tickAccumulator = useRef(0);
  const count = session.pedestrianIds.length;

  useEffect(() => {
    if (!active || count === 0) return;
    invalidate();
    const intervalId = window.setInterval(invalidate, 50);
    return () => window.clearInterval(intervalId);
  }, [active, count, invalidate]);

  useFrame((_, delta) => {
    if (!active || count === 0) return;
    tickAccumulator.current += Math.min(delta, 0.1);
    if (tickAccumulator.current < 0.05) return;
    const simulationDelta = tickAccumulator.current;
    tickAccumulator.current = 0;

    session.simulation.advance(simulationDelta);
    const stepTime = session.simulation.getSnapshot().totalSteps / 60;

    for (let index = 0; index < session.pedestrianIds.length; index += 1) {
      const entityId = session.pedestrianIds[index]!;
      const transform = session.world.getComponent(entityId, Transform);
      const civilian = session.world.getComponent(entityId, Civilian);
      if (!transform || !civilian) continue;

      const { x, y, z } = transform.position;
      const yaw = transform.rotationY;
      const walking = civilian.state === "walking" || civilian.state === "fleeing";
      const gaitPhase = walking ? stepTime * 8.5 + index * 0.83 : 0;
      const legSwing = walking ? Math.sin(gaitPhase) * 0.42 : 0;
      const armSwing = -legSwing * 0.62;
      const archetypeColor = ARCHETYPE_COLORS[civilian.archetype] ?? 0x71818a;

      torsoDummy.position.set(x, y + 1.03, z);
      torsoDummy.rotation.set(0, yaw, 0);
      torsoDummy.scale.set(1, 1, 1);
      torsoDummy.updateMatrix();
      torsoRef.current?.setMatrixAt(index, torsoDummy.matrix);
      color.setHex(archetypeColor);
      torsoRef.current?.setColorAt(index, color);

      headDummy.position.set(x, y + 1.66, z);
      headDummy.rotation.set(0, yaw, 0);
      headDummy.scale.set(1, 1, 1);
      headDummy.updateMatrix();
      headRef.current?.setMatrixAt(index, headDummy.matrix);

      for (const side of [-1, 1]) {
        const legIndex = index * 2 + (side === 1 ? 1 : 0);
        const localX = side * 0.125;
        const worldX = x + Math.cos(yaw) * localX;
        const worldZ = z - Math.sin(yaw) * localX;

        legDummy.position.set(worldX, y + 0.34, worldZ);
        legDummy.rotation.order = "YXZ";
        legDummy.rotation.set(side * legSwing, yaw, 0);
        legDummy.scale.set(1, 1, 1);
        legDummy.updateMatrix();
        legRef.current?.setMatrixAt(legIndex, legDummy.matrix);
        color.setHex(archetypeColor).multiplyScalar(0.72);
        legRef.current?.setColorAt(legIndex, color);

        const armX = x + Math.cos(yaw) * side * 0.29;
        const armZ = z - Math.sin(yaw) * side * 0.29;
        armDummy.position.set(armX, y + 1.03, armZ);
        armDummy.rotation.order = "YXZ";
        armDummy.rotation.set(side * armSwing - 0.12, yaw, side * 0.08);
        armDummy.scale.set(1, 1, 1);
        armDummy.updateMatrix();
        armRef.current?.setMatrixAt(legIndex, armDummy.matrix);
        color.setHex(archetypeColor).multiplyScalar(0.9);
        armRef.current?.setColorAt(legIndex, color);
      }
    }

    if (torsoRef.current) {
      torsoRef.current.instanceMatrix.needsUpdate = true;
      if (torsoRef.current.instanceColor) torsoRef.current.instanceColor.needsUpdate = true;
    }
    if (headRef.current) headRef.current.instanceMatrix.needsUpdate = true;
    if (legRef.current) {
      legRef.current.instanceMatrix.needsUpdate = true;
      if (legRef.current.instanceColor) legRef.current.instanceColor.needsUpdate = true;
    }
    if (armRef.current) {
      armRef.current.instanceMatrix.needsUpdate = true;
      if (armRef.current.instanceColor) armRef.current.instanceColor.needsUpdate = true;
    }
    torsoRef.current?.computeBoundingSphere();
    headRef.current?.computeBoundingSphere();
    legRef.current?.computeBoundingSphere();
    armRef.current?.computeBoundingSphere();
  });

  if (count === 0) return null;

  return (
    <>
      <instancedMesh
        ref={torsoRef}
        args={[TORSO_GEOMETRY, CROWD_MATERIAL, count]}
        castShadow
      />
      <instancedMesh
        ref={headRef}
        args={[HEAD_GEOMETRY, SKIN_MATERIAL, count]}
        castShadow
      />
      <instancedMesh
        ref={legRef}
        args={[LEG_GEOMETRY, CROWD_MATERIAL, count * 2]}
        castShadow
      />
      <instancedMesh
        ref={armRef}
        args={[ARM_GEOMETRY, CROWD_MATERIAL, count * 2]}
        castShadow
      />
    </>
  );
}
