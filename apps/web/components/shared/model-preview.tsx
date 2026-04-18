"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { api } from "@/lib/api";

type ModelPreviewProps = {
  file?: File | null;
  jobId?: string;
  fileName: string;
  className?: string;
};

const loadObjectFromBuffer = async (fileName: string, buffer: ArrayBuffer) => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "stl") {
    const loader = new STLLoader();
    const geometry = loader.parse(buffer);
    geometry.computeVertexNormals();
    geometry.center();
    const material = new THREE.MeshStandardMaterial({
      color: "#91d7ff",
      roughness: 0.4,
      metalness: 0.1,
    });
    return new THREE.Mesh(geometry, material);
  }

  if (extension === "obj") {
    const text = new TextDecoder().decode(buffer);
    const loader = new OBJLoader();
    const object = loader.parse(text);
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
        child.material = new THREE.MeshStandardMaterial({
          color: "#91d7ff",
          roughness: 0.45,
          metalness: 0.08,
        });
      }
    });
    return object;
  }

  throw new Error("Unsupported model format");
};

export function ModelPreview({
  file,
  jobId,
  fileName,
  className,
}: ModelPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const source = useMemo(
    () => ({ file, jobId, fileName }),
    [file, jobId, fileName],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let canceled = false;
    setLoading(true);
    setError(null);

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(0, 0, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    const keyLight = new THREE.DirectionalLight(0xb7ecff, 1.0);
    keyLight.position.set(50, 60, 70);
    scene.add(keyLight);
    scene.add(new THREE.AmbientLight(0x7ea8ff, 0.5));
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
    rimLight.position.set(-60, -40, 80);
    scene.add(rimLight);

    let model: THREE.Object3D | null = null;

    const fitCameraToObject = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const distance = maxDim * 1.7;

      camera.position.set(
        center.x + distance,
        center.y + distance * 0.6,
        center.z + distance,
      );
      camera.near = Math.max(0.01, distance / 100);
      camera.far = distance * 20;
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
    };

    const resize = () => {
      const width = host.clientWidth || 280;
      const height = host.clientHeight || 220;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let frameId = 0;
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    const load = async () => {
      try {
        let buffer: ArrayBuffer;
        if (source.file) {
          buffer = await source.file.arrayBuffer();
        } else if (source.jobId) {
          const blob = await api.fetchJobFileBlob(source.jobId);
          buffer = await blob.arrayBuffer();
        } else {
          throw new Error("No model source available");
        }

        if (canceled) {
          return;
        }

        model = await loadObjectFromBuffer(source.fileName, buffer);
        if (canceled) {
          return;
        }

        scene.add(model);
        fitCameraToObject(model);
        resize();
        animate();
      } catch (loadError) {
        setError((loadError as Error).message || "Unable to render preview");
      } finally {
        setLoading(false);
      }
    };

    void load();

    return () => {
      canceled = true;
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      if (model) {
        scene.remove(model);
      }
      renderer.dispose();
      host.innerHTML = "";
    };
  }, [source]);

  return (
    <div className={className}>
      <div
        ref={hostRef}
        className="relative h-full min-h-[180px] w-full overflow-hidden rounded-2xl border border-blue-mid/35 bg-space-900/55"
      />
      {loading ? (
        <p className="mt-2 text-xs text-cream/65">Rendering model preview...</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-rose-300">
          Preview unavailable: {error}
        </p>
      ) : null}
    </div>
  );
}
