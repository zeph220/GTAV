import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Lightweight desktop orbit camera. Left mouse drag orbits, right mouse drag
 * pans, and the wheel zooms. UI overlays are excluded from drag initiation.
 */
export function CityCameraControls({ enabled = true }: { enabled?: boolean }) {
  const { camera, gl, invalidate } = useThree();

  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;
    const eventSurface = canvas.parentElement ?? canvas;
    const target = new THREE.Vector3(0, 0, 0);
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(target),
    );
    let activeButton: number | null = null;

    const updateCamera = () => {
      camera.position.copy(
        new THREE.Vector3().setFromSpherical(spherical).add(target),
      );
      camera.lookAt(target);
      camera.updateMatrixWorld();
      invalidate();
    };

    const isUiTarget = (event: MouseEvent) =>
      event.target instanceof Element &&
      Boolean(event.target.closest(".game-panel, .game-header, .district-rail, .game-footer, button"));

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 && event.button !== 2) return;
      if (isUiTarget(event)) return;
      activeButton = event.button;
      canvas.style.cursor = "grabbing";
      eventSurface.style.cursor = "grabbing";
      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (activeButton === null) return;

      if (activeButton === 0) {
        spherical.theta -= event.movementX * 0.004;
        spherical.phi = THREE.MathUtils.clamp(
          spherical.phi - event.movementY * 0.003,
          0.16,
          1.46,
        );
      } else {
        camera.updateMatrixWorld();
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        const panSpeed = spherical.radius * 0.00115;
        target.addScaledVector(right, -event.movementX * panSpeed);
        target.addScaledVector(up, event.movementY * panSpeed);
      }

      updateCamera();
    };

    const resetDrag = () => {
      if (activeButton === null) return;
      activeButton = null;
      canvas.style.cursor = "grab";
      eventSurface.style.cursor = "grab";
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (activeButton === null) return;
      if (event.button === activeButton || event.buttons === 0) resetDrag();
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      spherical.radius = THREE.MathUtils.clamp(
        spherical.radius * Math.exp(event.deltaY * 0.001),
        360,
        3200,
      );
      updateCamera();
    };

    const preventContextMenu = (event: MouseEvent) => event.preventDefault();

    canvas.style.cursor = "grab";
    eventSurface.style.cursor = "grab";
    updateCamera();
    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("blur", resetDrag);
    eventSurface.addEventListener("wheel", handleWheel, { passive: false });
    eventSurface.addEventListener("contextmenu", preventContextMenu);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("blur", resetDrag);
      eventSurface.removeEventListener("wheel", handleWheel);
      eventSurface.removeEventListener("contextmenu", preventContextMenu);
      canvas.style.cursor = "";
      eventSurface.style.cursor = "";
    };
  }, [camera, enabled, gl, invalidate]);

  return null;
}
