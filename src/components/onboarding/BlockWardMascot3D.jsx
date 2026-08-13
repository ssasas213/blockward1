import { useEffect, useRef } from 'react';

/**
 * Premium 3D BlockWard mascot — a translucent purple→pink crystal guardian.
 * Uses raw three.js (already installed) lazily via dynamic import so it never
 * bloats the main bundle. Falls back via onError if WebGL/3D is unavailable.
 */
export default function BlockWardMascot3D({ size = 180, onError }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let renderer, scene, camera, frame;

    (async () => {
      let THREE, RoomEnvironment;
      try {
        THREE = await import('three');
        ({ RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js'));
      } catch (e) {
        if (!disposed) onError && onError(e);
        return;
      }

      const mount = mountRef.current;
      if (!mount || disposed) return;

      let r;
      try {
        r = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      } catch (e) {
        if (!disposed) onError && onError(e);
        return;
      }
      renderer = r;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, size);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 5.2);

      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      } catch { /* env optional */ }

      const root = new THREE.Group();      // float position only
      scene.add(root);
      const crystalGroup = new THREE.Group(); // rotates
      root.add(crystalGroup);
      const faceGroup = new THREE.Group();    // faces camera
      root.add(faceGroup);

      const purple = new THREE.Color('#8B5CF6');
      const pink = new THREE.Color('#EC4899');

      const crystalGeo = new THREE.OctahedronGeometry(1.3, 0);
      crystalGeo.scale(1, 1.28, 1);
      const crystalMat = new THREE.MeshPhysicalMaterial({
        color: purple,
        transmission: 0.92,
        roughness: 0.07,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        ior: 1.6,
        thickness: 1.7,
        attenuationColor: pink,
        attenuationDistance: 1.0,
        iridescence: 0.75,
        iridescenceIOR: 1.3,
        emissive: new THREE.Color('#7C3AED'),
        emissiveIntensity: 0.2,
        transparent: true,
      });
      crystalGroup.add(new THREE.Mesh(crystalGeo, crystalMat));

      // glowing inner core
      const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#F472B6'), transparent: true, opacity: 0.55 });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), coreMat);
      crystalGroup.add(core);

      // facet wireframe
      const wireGeo = new THREE.OctahedronGeometry(1.38, 0);
      wireGeo.scale(1, 1.28, 1);
      crystalGroup.add(new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color('#C4B5FD'), wireframe: true, transparent: true, opacity: 0.16,
      })));

      // eyes (face the camera, don't rotate away)
      const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#160F24') });
      const eyeGeo = new THREE.SphereGeometry(0.085, 16, 16);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.3, 0.06, 1.12);
      eyeR.position.set(0.3, 0.06, 1.12);
      faceGroup.add(eyeL, eyeR);

      // soft halo
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.85, 32, 32),
        new THREE.MeshBasicMaterial({ color: purple, transparent: true, opacity: 0.05, side: THREE.BackSide })
      );
      scene.add(halo);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const p1 = new THREE.PointLight(0x8B5CF6, 8, 20); p1.position.set(-3, 3, 3); scene.add(p1);
      const p2 = new THREE.PointLight(0xEC4899, 6, 20); p2.position.set(3, -2, 2); scene.add(p2);
      const dir = new THREE.DirectionalLight(0xffffff, 1.4); dir.position.set(2, 4, 5); scene.add(dir);

      crystalGroup.rotation.y = 0.4;
      const clock = new THREE.Clock();
      const animate = () => {
        frame = requestAnimationFrame(animate);
        if (disposed) return;
        const t = clock.getElapsedTime();
        root.position.y = Math.sin(t * 1.1) * 0.13;
        crystalGroup.rotation.y = 0.4 + t * 0.28;
        crystalGroup.rotation.z = Math.sin(t * 0.8) * 0.05;
        const blink = Math.sin(t * 0.7) > 0.96 ? 0.12 : 1;
        eyeL.scale.y = blink; eyeR.scale.y = blink;
        renderer.render(scene, camera);
      };
      animate();
    })();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, [size, onError]);

  return <div ref={mountRef} style={{ width: size, height: size }} className="blockward-mascot-3d" aria-hidden="true" />;
}