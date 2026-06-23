import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Animated neural-network / blockchain verification engine background.
// Raw Three.js (no extra deps). Floating nodes connected by glowing lines,
// slow drift + mouse parallax. Performant + mobile-aware.
export default function Hero3DBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const isMobile = window.innerWidth < 768;
    const NODE_COUNT = isMobile ? 42 : 88;
    const CONNECT_DIST = isMobile ? 2.7 : 2.45;
    const RADIUS = 8;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 14;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // soft glowing circular sprite for nodes
    const makeSprite = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(167,139,250,0.85)');
      g.addColorStop(1, 'rgba(124,58,237,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    };
    const sprite = makeSprite();

    const positions = [];
    const velocities = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const r = RADIUS * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      velocities.push((Math.random() - 0.5) * 0.005);
    }

    const nodeGeom = new THREE.BufferGeometry();
    nodeGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const nodeMat = new THREE.PointsMaterial({
      size: isMobile ? 0.3 : 0.24,
      map: sprite,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      color: 0xc4b5fd,
    });
    const points = new THREE.Points(nodeGeom, nodeMat);
    scene.add(points);

    // preallocate a reusable buffer (worst case: all pairs connected) to avoid per-frame allocation
    const maxSegs = (NODE_COUNT * (NODE_COUNT - 1)) / 2;
    const lineBuf = new Float32Array(maxSegs * 6);
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(lineBuf, 3));
    lineGeom.setDrawRange(0, 0);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeom, lineMat);
    scene.add(lines);

    const posAttr = nodeGeom.attributes.position;
    const linePosAttr = lineGeom.attributes.position;
    const updateConnections = () => {
      const arr = posAttr.array;
      let n = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        const ix = arr[i * 3], iy = arr[i * 3 + 1], iz = arr[i * 3 + 2];
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const dx = ix - arr[j * 3], dy = iy - arr[j * 3 + 1], dz = iz - arr[j * 3 + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < CONNECT_DIST) {
            lineBuf[n++] = ix; lineBuf[n++] = iy; lineBuf[n++] = iz;
            lineBuf[n++] = arr[j * 3]; lineBuf[n++] = arr[j * 3 + 1]; lineBuf[n++] = arr[j * 3 + 2];
          }
        }
      }
      linePosAttr.needsUpdate = true;
      lineGeom.setDrawRange(0, n / 3);
    };
    updateConnections();

    let mouseX = 0, mouseY = 0;
    const onMouse = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 0.5;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 0.5;
    };
    window.addEventListener('mousemove', onMouse);

    let frame;
    let connTick = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const arr = posAttr.array;
      for (let i = 0; i < NODE_COUNT; i++) {
        arr[i * 3 + 1] += velocities[i];
        if (arr[i * 3 + 1] > RADIUS) arr[i * 3 + 1] = -RADIUS;
        if (arr[i * 3 + 1] < -RADIUS) arr[i * 3 + 1] = RADIUS;
      }
      posAttr.needsUpdate = true;
      connTick++;
      if (connTick % 3 === 0) updateConnections();

      points.rotation.y += 0.0008;
      lines.rotation.y = points.rotation.y;
      camera.position.x += (mouseX * 2.5 - camera.position.x) * 0.03;
      camera.position.y += (-mouseY * 2.5 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      nodeGeom.dispose();
      nodeMat.dispose();
      lineGeom.dispose();
      lineMat.dispose();
      sprite.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}