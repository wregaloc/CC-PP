import { useEffect, useRef } from "react";
import * as THREE from "three";

const GOLD_LIGHT = "#d8bc82";
const GOLD = "#b4975a";
const GOLD_DEEP = "#8a6f3c";

/** Fondo animado del login — gema facetada en bronce oscuro orbitada por
 * satélites y polvo dorado, con parallax de mouse. Puramente decorativo, sin
 * conocimiento de autenticación (ver LoginPage para el formulario real). */
export function GemBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 6.5);

    // Puramente decorativo — si el entorno no soporta WebGL (navegadores/
    // dispositivos viejos, o jsdom en tests), se degrada con gracia: el
    // login sigue siendo 100% funcional, solo sin el fondo animado.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Luces: oro cálido de key, marfil de fill, oro profundo de rim — las tres orbitan.
    scene.add(new THREE.AmbientLight(0x2a2418, 1.2));

    const lightGold = new THREE.PointLight(0xd8bc82, 3.0, 20);
    const lightIvory = new THREE.PointLight(0xf5f1e8, 2.0, 20);
    const lightDeep = new THREE.PointLight(0x8a6f3c, 2.4, 20);
    scene.add(lightGold, lightIvory, lightDeep);

    // Núcleo: gema facetada en bronce oscuro, las luces oro pintan las facetas.
    const coreGeo = new THREE.IcosahedronGeometry(1.35, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x241d12,
      metalness: 0.95,
      roughness: 0.22,
      flatShading: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Brillo interior: oro cálido "respirando" adentro.
    const glowGeo = new THREE.IcosahedronGeometry(1.15, 1);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xb4975a,
      transparent: true,
      opacity: 0.1,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    // Doble cáscara de wireframe en tonos oro.
    const shell1Geo = new THREE.IcosahedronGeometry(2.05, 1);
    const shell1Mat = new THREE.MeshBasicMaterial({
      color: 0xb4975a,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const shell1 = new THREE.Mesh(shell1Geo, shell1Mat);
    scene.add(shell1);

    const shell2Geo = new THREE.IcosahedronGeometry(2.55, 1);
    const shell2Mat = new THREE.MeshBasicMaterial({
      color: 0xd8bc82,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const shell2 = new THREE.Mesh(shell2Geo, shell2Mat);
    scene.add(shell2);

    // Satélites: tres esferas doradas pequeñas en órbitas inclinadas.
    const satellites: THREE.Mesh[] = [];
    const satColors = [0xd8bc82, 0xb4975a, 0xf5f1e8];
    for (let i = 0; i < 3; i++) {
      const satGeo = new THREE.SphereGeometry(0.05, 12, 12);
      const satMat = new THREE.MeshBasicMaterial({ color: satColors[i] });
      const sat = new THREE.Mesh(satGeo, satMat);
      sat.userData = { phase: (i / 3) * Math.PI * 2, tilt: 0.4 + i * 0.5, radius: 2.05 };
      scene.add(sat);
      satellites.push(sat);
    }

    // Partículas: polvo dorado.
    const pCount = 180;
    const pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(pCount * 3);
    const col = new Float32Array(pCount * 3);
    const cA = new THREE.Color(GOLD_LIGHT);
    const cB = new THREE.Color(GOLD);
    const cC = new THREE.Color(GOLD_DEEP);
    for (let i = 0; i < pCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      const t = Math.random();
      const c = new THREE.Color();
      if (t < 0.5) c.lerpColors(cA, cB, t * 2);
      else c.lerpColors(cB, cC, (t - 0.5) * 2);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Parallax de mouse.
    let mouseX = 0;
    let mouseY = 0;
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);

    let raf: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const t = clock.getElapsedTime();

      core.rotation.y = t * 0.3;
      core.rotation.x = Math.sin(t * 0.2) * 0.12;
      core.position.y = Math.sin(t * 0.8) * 0.12;
      glow.rotation.y = -t * 0.2;
      glow.position.y = core.position.y;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.07 + Math.abs(Math.sin(t * 1.2)) * 0.09;

      shell1.rotation.y = -t * 0.16;
      shell1.rotation.x = t * 0.1;
      shell2.rotation.y = t * 0.09;
      shell2.rotation.z = -t * 0.07;

      lightGold.position.set(Math.cos(t * 0.5) * 4, 2.5, Math.sin(t * 0.5) * 4);
      lightIvory.position.set(
        Math.cos(t * 0.35 + 2) * 4.5,
        -1 + Math.sin(t * 0.6),
        Math.sin(t * 0.35 + 2) * 4.5,
      );
      lightDeep.position.set(Math.cos(t * 0.42 + 4) * 4, 1.5 * Math.sin(t * 0.3), Math.sin(t * 0.42 + 4) * 4);

      satellites.forEach((sat) => {
        const { phase, tilt, radius } = sat.userData as { phase: number; tilt: number; radius: number };
        const a = t * 0.6 + phase;
        sat.position.set(
          Math.cos(a) * radius,
          Math.sin(a) * Math.sin(tilt) * radius * 0.6 + core.position.y,
          Math.sin(a) * Math.cos(tilt) * radius,
        );
      });

      particles.rotation.y = t * 0.018;

      camera.position.x += (mouseX * 0.7 - camera.position.x) * 0.035;
      camera.position.y += (0.4 - mouseY * 0.35 - camera.position.y) * 0.035;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      [coreGeo, glowGeo, shell1Geo, shell2Geo, pGeo].forEach((g) => g.dispose());
      [coreMat, glowMat, shell1Mat, shell2Mat, pMat].forEach((m) => m.dispose());
      satellites.forEach((s) => {
        s.geometry.dispose();
        (s.material as THREE.Material).dispose();
      });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
