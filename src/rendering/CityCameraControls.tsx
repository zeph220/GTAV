import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Lightweight pointer-driven orbit camera. It intentionally avoids an extra
 * controls dependency and keeps all navigation state local to the renderer.
 */
export function CityCameraControls() {
  const { camera, gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const eventSurface = canvas.parentElement ?? canvas;
    const target = new THREE.Vector3(0, 0, 0);
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(target),
    );
    let activePointerId: number | null = null;
    let activeButton: number | null = null;

    const updateCamera = () => {
      camera.position.copy(
        new THREE.Vector3().setFromSpherical(spherical).add(target),
      );
      camera.lookAt(target);
      camera.updateMatrixWorld();
    };

    const handlePointerDown = (event: PointerEvent) => {
      const eventTarget = event.target;
      if (
        !(eventTarget instanceof Node) ||
        !(eventTarget === eventSurface || eventSurface.contains(eventTarget))
      ) return;
      if (event.button !== 0 && event.button !== 2) return;
      activePointerId = event.pointerId;
      activeButton = event.button;
      canvas.style.cursor = "grabbing";
      eventSurface.style.cursor = "grabbing";
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId || activeButton === null) return;

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

    const releasePointer = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      activePointerId = null;
      activeButton = null;
      canvas.style.cursor = "grab";
      eventSurface.style.cursor = "grab";
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
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", preventContextMenu);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("contextmenu", preventContextMenu);
      canvas.style.cursor = "";
      eventSurface.style.cursor = "";
    };
  }, [camera, gl]);

  return null;
}
