import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Danh sách từ vựng & thành ngữ tiếng Anh ý nghĩa trôi cùng các đám mây
const CLOUD_WORDS = [
  { word: "Serendipity", pos: "n", meaning: "Sự tình cờ may mắn" },
  { word: "Resilient", pos: "adj", meaning: "Kiên cường, bền bỉ" },
  { word: "Ephemeral", pos: "adj", meaning: "Phù du, thoáng qua" },
  { word: "Luminous", pos: "adj", meaning: "Tỏa sáng rực rỡ" },
  { word: "Perseverance", pos: "n", meaning: "Sự kiên trì bền chí" },
  { word: "Eloquent", pos: "adj", meaning: "Hùng biện, lưu loát" },
  { word: "Wanderlust", pos: "n", meaning: "Niềm khao khát khám phá" },
  { word: "In a nutshell", pos: "idiom", meaning: "Tóm gọn lại là" },
  { word: "Break a leg", pos: "idiom", meaning: "Chúc may mắn thành công" },
  { word: "Keep an eye on", pos: "phrase", meaning: "Để mắt, chú ý tới" },
  { word: "Meet the deadline", pos: "colloc", meaning: "Kịp thời hạn nộp bài" },
  { word: "Draw a conclusion", pos: "colloc", meaning: "Rút ra kết luận" },
  { word: "Make an effort", pos: "colloc", meaning: "Nỗ lực hết mình" },
  { word: "Meticulous", pos: "adj", meaning: "Tỉ mỉ, cẩn trọng" },
  { word: "Synchronize", pos: "v", meaning: "Đồng bộ hóa" },
  { word: "Feasible", pos: "adj", meaning: "Khả thi, thực tế" },
];

/**
 * Hàm tạo Texture chứa chữ tiếng Anh sắc nét trên Canvas 2D
 */
function createTextSprite(item) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  // Nền bo tròn dạng capsule kính mờ
  ctx.fillStyle = "rgba(12, 19, 38, 0.82)";
  ctx.strokeStyle = "rgba(163, 230, 53, 0.4)";
  ctx.lineWidth = 4;

  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  roundRect(8, 8, 496, 144, 28);

  // Huy hiệu loại từ
  ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
  ctx.lineWidth = 2;
  roundRect(28, 22, 90, 36, 10);

  ctx.fillStyle = "#7dd3fc";
  ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(item.pos.toUpperCase(), 73, 47);

  // Từ vựng tiếng Anh
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(item.word, 134, 52);

  // Nghĩa tiếng Việt
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "24px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(item.meaning, 32, 114);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(9.5, 3.0, 1);
  return sprite;
}

/**
 * Hàm tạo một cụm đám mây 3D bồng bềnh từ nhiều quả cầu mềm mại
 */
function createCloudMesh(cloudMaterial) {
  const group = new THREE.Group();
  const sphereGeo = new THREE.SphereGeometry(1, 16, 16);

  // Tạo các khối phồng (puffs) của đám mây
  const puffConfigs = [
    { x: 0, y: 0, z: 0, s: 2.2 },
    { x: -1.6, y: -0.3, z: 0.2, s: 1.7 },
    { x: 1.6, y: -0.2, z: -0.2, s: 1.8 },
    { x: -0.9, y: 0.8, z: 0.1, s: 1.5 },
    { x: 0.9, y: 0.7, z: -0.1, s: 1.6 },
    { x: 0, y: 0.9, z: 0.3, s: 1.4 },
    { x: -2.6, y: -0.6, z: 0, s: 1.1 },
    { x: 2.5, y: -0.5, z: 0.1, s: 1.2 },
  ];

  puffConfigs.forEach((cfg) => {
    const puff = new THREE.Mesh(sphereGeo, cloudMaterial);
    puff.position.set(cfg.x, cfg.y, cfg.z);
    puff.scale.set(cfg.s, cfg.s * 0.82, cfg.s * 0.9);
    group.add(puff);
  });

  return group;
}

export function English3DScene() {
  const mountRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    // Bầu trời chiều sâu và sương mù nhẹ nhàng
    scene.fog = new THREE.FogExp2(0x080c18, 0.008);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 60);

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Hệ thống ánh sáng bầu trời dịu nhẹ
    const ambientLight = new THREE.AmbientLight(0x232f4e, 2.0);
    scene.add(ambientLight);

    // Ánh sáng trăng / hoàng hôn chiếu lên viền mây
    const moonLight = new THREE.DirectionalLight(0xa5f3fc, 1.8);
    moonLight.position.set(30, 45, 40);
    scene.add(moonLight);

    const emeraldLight = new THREE.PointLight(0xa3e635, 2.2, 100);
    emeraldLight.position.set(-30, -10, 20);
    scene.add(emeraldLight);

    const sapphireLight = new THREE.PointLight(0x38bdf8, 2.5, 120);
    sapphireLight.position.set(40, -15, 10);
    scene.add(sapphireLight);

    // Chất liệu cho đám mây 3D bồng bềnh
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0e7ff,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.82,
      flatShading: false,
    });

    // Tạo các cụm mây mang từ vựng
    const cloudsGroup = new THREE.Group();
    scene.add(cloudsGroup);

    const clouds = [];
    const totalClouds = 14;

    for (let i = 0; i < totalClouds; i++) {
      const cloudItem = new THREE.Group();
      const wordData = CLOUD_WORDS[i % CLOUD_WORDS.length];

      // Thêm hình thể đám mây 3D
      const cloudMesh = createCloudMesh(cloudMaterial);
      cloudItem.add(cloudMesh);

      // Thêm từ vựng tiếng Anh trên đỉnh đám mây
      const textSprite = createTextSprite(wordData);
      textSprite.position.set(0, 2.6, 0.4);
      cloudItem.add(textSprite);

      // Định vị phân bổ trong không gian 3D
      const x = ((i / totalClouds) * 120) - 60 + (Math.random() * 8 - 4);
      const y = ((Math.random() - 0.5) * 44) + (i % 2 === 0 ? 4 : -4);
      const z = ((Math.random() - 0.5) * 35) - 5;
      const scale = 1.0 + Math.random() * 0.6;
      const speed = 0.035 + Math.random() * 0.025;

      cloudItem.position.set(x, y, z);
      cloudItem.scale.set(scale, scale, scale);

      cloudsGroup.add(cloudItem);
      clouds.push({
        group: cloudItem,
        speed,
        baseY: y,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Tinh cầu / bụi sao trôi trong không gian bầu trời
    const starCount = 180;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 160;
      starPositions[i + 1] = (Math.random() - 0.5) * 100;
      starPositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 1.1,
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.55,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Parallax theo chuột
    let targetCameraX = 0;
    let targetCameraY = 0;

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = -(e.clientY / innerHeight) * 2 + 1;
      targetCameraX = nx * 8;
      targetCameraY = ny * 5;
      setMousePos({ x: nx, y: ny });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    // Animation loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Camera di chuyển êm dịu theo chuột
      camera.position.x += (targetCameraX - camera.position.x) * 0.04;
      camera.position.y += (targetCameraY - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      // Các đám mây di chuyển ngang qua bầu trời kèm từ vựng trên mây
      clouds.forEach((c) => {
        c.group.position.x += c.speed;
        c.group.position.y = c.baseY + Math.sin(elapsedTime * 0.7 + c.phase) * 1.2;

        // Nếu mây bay quá biên phải màn hình thì xuất hiện lại ở bên trái
        if (c.group.position.x > 68) {
          c.group.position.x = -68;
        }
      });

      // Bụi sao xoay nhẹ nhàng
      stars.rotation.y = elapsedTime * 0.01;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }

      cloudMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="english-3d-wrapper" aria-hidden="false">
      {/* Three.js Canvas Đám mây 3D */}
      <div ref={mountRef} className="three-canvas-container" />

      {/* Ánh sáng mờ ảo hoàng hôn/đêm học thuật */}
      <div className="ambient-backdrop-glows">
        <div className="glow-sphere glow-emerald" />
        <div className="glow-sphere glow-sapphire" />
        <div className="glow-sphere glow-amber" />
      </div>
    </div>
  );
}
