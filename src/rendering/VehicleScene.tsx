import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GeneratedCity } from "../world/world-types";
import type { PedestrianThreat } from "../ai/systems/pedestrian-system";
import { Transform } from "../gameplay/ecs/components";
import type { World } from "../gameplay/ecs/world";
import { VehicleControls, VehicleDynamics } from "../vehicles/vehicle-components";
import { createVehicleSession } from "../vehicles/create-vehicle-session";
import { setVehicleControls } from "../vehicles/create-vehicle";

interface VehicleSceneProps {
  city: GeneratedCity;
  active: boolean;
  onSpeedChange?: (speedKph: number) => void;
  onThreatsChange?: (threats: readonly PedestrianThreat[]) => void;
}

export function VehicleScene({
  city,
  active,
  onSpeedChange,
  onThreatsChange,
}: VehicleSceneProps) {
  const session = useMemo(() => createVehicleSession(city), [city]);
  const { camera, invalidate } = useThree();
  const telemetryElapsed = useRef(0);
  const lastReportedSpeed = useRef(-1);
  const cameraPosition = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    const { world, playerVehicleId } = session;
    const pressed = new Set<string>();
    const handledCodes = new Set([
      "KeyW", "KeyA", "KeyS", "KeyD",
      "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
      "Space", "ShiftLeft", "ShiftRight",
    ]);

    const publishControls = () => {
      const forward = pressed.has("KeyW") || pressed.has("ArrowUp");
      const reverse = pressed.has("KeyS") || pressed.has("ArrowDown");
      const left = pressed.has("KeyA") || pressed.has("ArrowLeft");
      const right = pressed.has("KeyD") || pressed.has("ArrowRight");
      setVehicleControls(world, playerVehicleId, {
        throttle: Number(forward) - Number(reverse),
        brake: Number(pressed.has("Space")),
        steering: Number(right) - Number(left),
        handbrake: pressed.has("ShiftLeft") || pressed.has("ShiftRight"),
      });
      invalidate();
    };

    const clearControls = () => {
      pressed.clear();
      publishControls();
    };

    if (!active) {
      clearControls();
      onThreatsChange?.([]);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!handledCodes.has(event.code)) return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
      ) return;
      event.preventDefault();
      pressed.add(event.code);
      publishControls();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!handledCodes.has(event.code)) return;
      event.preventDefault();
      pressed.delete(event.code);
      publishControls();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearControls);
    invalidate();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearControls);
      pressed.clear();
      setVehicleControls(world, playerVehicleId, {
        throttle: 0,
        brake: 0,
        steering: 0,
        handbrake: false,
      });
      onThreatsChange?.([]);
      invalidate();
    };
  }, [active, invalidate, onThreatsChange, session]);

  useFrame((_, delta) => {
    if (!active) return;

    session.simulation.advance(delta);

    const transform = session.world.getComponent(session.playerVehicleId, Transform);
    const dynamics = session.world.getComponent(session.playerVehicleId, VehicleDynamics);
    if (!transform || !dynamics) return;

    const forwardX = Math.sin(transform.rotationY);
    const forwardZ = -Math.cos(transform.rotationY);
    cameraPosition.current.set(
      transform.position.x - forwardX * 13,
      transform.position.y + 7.2,
      transform.position.z - forwardZ * 13,
    );
    cameraTarget.current.set(
      transform.position.x + forwardX * 5.5,
      transform.position.y + 1.2,
      transform.position.z + forwardZ * 5.5,
    );

    const previousCameraDistance = camera.position.distanceToSquared(cameraPosition.current);
    const blend = 1 - Math.exp(-5.5 * Math.min(delta, 0.1));
    camera.position.lerp(cameraPosition.current, blend);
    camera.lookAt(cameraTarget.current);

    telemetryElapsed.current += delta;
    if (telemetryElapsed.current >= 0.12) {
      telemetryElapsed.current = 0;
      const speedKph = Math.round(Math.abs(dynamics.speedMps) * 3.6);
      if (speedKph !== lastReportedSpeed.current) {
        lastReportedSpeed.current = speedKph;
        onSpeedChange?.(speedKph);
      }

      const playerThreatRadius = Math.abs(dynamics.speedMps) >= 0.5 ? 15 : 5;
      const threats: PedestrianThreat[] = [{
        position: { ...transform.position },
        radius: playerThreatRadius,
      }];
      for (const entityId of session.trafficVehicleIds) {
        const trafficTransform = session.world.getComponent(entityId, Transform);
        const trafficDynamics = session.world.getComponent(entityId, VehicleDynamics);
        if (!trafficTransform || !trafficDynamics) continue;
        threats.push({
          position: { ...trafficTransform.position },
          radius: Math.abs(trafficDynamics.speedMps) >= 0.5 ? 12 : 4,
        });
      }
      onThreatsChange?.(threats);
    }

    const playerControls = session.world.getComponent(
      session.playerVehicleId,
      VehicleControls,
    );
    const trafficMoving = session.trafficVehicleIds.some((entityId) => {
      const traffic = session.world.getComponent(entityId, VehicleDynamics);
      return traffic !== undefined && Math.abs(traffic.speedMps) > 0.02;
    });

    if (
      Math.abs(dynamics.speedMps) > 0.02 ||
      Boolean(playerControls && (
        playerControls.throttle !== 0 ||
        playerControls.steering !== 0 ||
        playerControls.brake !== 0 ||
        playerControls.handbrake
      )) ||
      trafficMoving ||
      previousCameraDistance > 0.0025
    ) {
      invalidate();
    }
  });

  return (
    <>
      <VehicleModel
        world={session.world}
        entityId={session.playerVehicleId}
        color="#b9d7df"
      />
      {session.trafficVehicleIds.map((entityId) => (
        <VehicleModel
          key={entityId}
          world={session.world}
          entityId={entityId}
          color="#c46e4f"
        />
      ))}
    </>
  );
}

function VehicleModel({
  world,
  entityId,
  color,
}: {
  world: World;
  entityId: number;
  color: string;
}) {
  const root = useRef<THREE.Group>(null);
  const frontLeft = useRef<THREE.Group>(null);
  const frontRight = useRef<THREE.Group>(null);
  const rearLeft = useRef<THREE.Group>(null);
  const rearRight = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const group = root.current;
    const transform = world.getComponent(entityId, Transform);
    const dynamics = world.getComponent(entityId, VehicleDynamics);
    if (!group || !transform || !dynamics) return;

    group.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    group.rotation.y = transform.rotationY;

    if (frontLeft.current) {
      frontLeft.current.rotation.y = dynamics.steeringAngleRadians;
      frontLeft.current.rotation.x += (dynamics.speedMps / 0.36) * delta;
    }
    if (frontRight.current) {
      frontRight.current.rotation.y = dynamics.steeringAngleRadians;
      frontRight.current.rotation.x += (dynamics.speedMps / 0.36) * delta;
    }
    if (rearLeft.current) rearLeft.current.rotation.x += (dynamics.speedMps / 0.36) * delta;
    if (rearRight.current) rearRight.current.rotation.x += (dynamics.speedMps / 0.36) * delta;
  });

  return (
    <group ref={root}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.92, 0.72, 4.25]} />
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.48} />
      </mesh>
      <mesh position={[0, 1.32, -0.22]} castShadow>
        <boxGeometry args={[1.52, 0.78, 2.18]} />
        <meshStandardMaterial color="#263d4a" roughness={0.2} metalness={0.58} />
      </mesh>
      <mesh position={[0, 1.73, -0.18]}>
        <boxGeometry args={[1.28, 0.06, 1.65]} />
        <meshStandardMaterial color="#182b36" metalness={0.24} roughness={0.3} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.92, -2.14]}>
            <boxGeometry args={[0.32, 0.2, 0.08]} />
            <meshStandardMaterial
              color="#e7e6c8"
              emissive="#d9d39b"
              emissiveIntensity={0.6}
            />
          </mesh>
          <mesh position={[x, 0.87, 2.14]}>
            <boxGeometry args={[0.3, 0.2, 0.07]} />
            <meshStandardMaterial
              color="#9b3f35"
              emissive="#611c18"
              emissiveIntensity={0.35}
            />
          </mesh>
        </group>
      ))}
      <Wheel ref={frontLeft} position={[-0.98, 0.38, -1.36]} />
      <Wheel ref={frontRight} position={[0.98, 0.38, -1.36]} />
      <Wheel ref={rearLeft} position={[-0.98, 0.38, 1.36]} />
      <Wheel ref={rearRight} position={[0.98, 0.38, 1.36]} />
    </group>
  );
}

const wheelGeometry = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 14);
const wheelMaterial = new THREE.MeshStandardMaterial({
  color: "#20272b",
  roughness: 0.86,
  metalness: 0.08,
});
const rimGeometry = new THREE.CylinderGeometry(0.19, 0.19, 0.292, 12);
const rimMaterial = new THREE.MeshStandardMaterial({
  color: "#aeb9bc",
  roughness: 0.32,
  metalness: 0.78,
});

const Wheel = forwardRef<THREE.Group, { position: [number, number, number] }>(
  function Wheel({ position }, ref) {
    return (
      <group ref={ref} position={position}>
        <mesh rotation={[0, 0, Math.PI / 2]} geometry={wheelGeometry} material={wheelMaterial} castShadow />
        <mesh rotation={[0, 0, Math.PI / 2]} geometry={rimGeometry} material={rimMaterial} />
      </group>
    );
  },
);
