import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hàm tạo một cụm đám mây 3D bồng bềnh hữu cơ (Organic Cumulus Cloud Cluster)
 * Lấy cảm hứng từ phong cách 3D Sky của các Three.js portfolio cao cấp
 */
function createVolumetricCloud(material, scaleMultiplier = 1) {
  const group = new THREE.Group();
  const sphereGeo = new THREE.SphereGeometry(1, 20, 20);

  // Cấu trúc các khối phồng tạo dáng mây tự nhiên (đáy phẳng, đỉnh phồng cao)
  const puffs = [
    // Lõi trung tâm
    { x: 0, y: 0, z: 0, sx: 2.8, sy: 1.9, sz: 2.4 },
    { x: -1.8, y: -0.2, z: 0.3, sx: 2.2, sy: 1.6, sz: 2.0 },
    { x: 1.9, y: -0.2, z: -0.2, sx: 2.3, sy: 1.6, sz: 2.1 },
    
    // Đỉnh mây bồng bềnh
    { x: -0.8, y: 1.1, z: 0.1, sx: 2.1, sy: 1.8, sz: 1.9 },
    { x: 0.9, y: 1.2, z: -0.1, sx: 2.2, sy: 1.9, sz: 2.0 },
    { x: 0.1, y: 1.5, z: 0.2, sx: 1.8, sy: 1.6, sz: 1.7 },
    
    // Hai cánh mây mở rộng
    { x: -3.2, y: -0.5, z: 0.2, sx: 1.7, sy: 1.2, sz: 1.5 },
    { x: 3.3, y: -0.4, z: -0.1, sx: 1.8, sy: 1.3, sz: 1.6 },
    { x: -2.3, y: 0.6, z: 0.4, sx: 1.6, sy: 1.4, sz: 1.5 },
    { x: 2.4, y: 0.7, z: -0.3, sx: 1.7, sy: 1.4, sz: 1.6 },
    
    // Lớp đệm phía trước & sau tạo chiều sâu 3D tròn đầy
    { x: -0.4, y: -0.3, z: 1.2, sx: 1.9, sy: 1.4, sz: 1.6 },
    { x: 0.6, y: -0.2, z: -1.2, sx: 1.8, sy: 1.3, sz: 1.5 },
    { x: 1.2, y: 0.3, z: 1.0, sx: 1.5, sy: 1.2, sz: 1.4 },
  ];

  puffs.forEach((p) => {
    const puff = new THREE.Mesh(sphereGeo, material);
    puff.position.set(p.x * scaleMultiplier, p.y * scaleMultiplier, p.z * scaleMultiplier);
    puff.scale.set(
      p.sx * scaleMultiplier,
      p.sy * scaleMultiplier,
      p.sz * scaleMultiplier
    );
    puff.castShadow = true;
    puff.receiveShadow = true;
    group.add(puff);
  });

  return group;
}

export function English3DScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Khởi tạo Three.js WebGL Renderer
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

    // Sương mù khí quyển êm dịu (Atmospheric Fog)
    scene.fog = new THREE.FogExp2(0x0a1024, 0.012);

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 55);

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // ==========================================
    // ÁNH SÁNG BẦU TRỜI & MẶT TRỜI / ÁNH TRĂNG
    // ==========================================
    // Ánh sáng môi trường hai màu (Hemisphere Light) tạo gradient sáng đỉnh - tối đáy cho mây
    const hemiLight = new THREE.HemisphereLight(0xcde9ff, 0x141e38, 2.2);
    scene.add(hemiLight);

    // Nguồn sáng định hướng (Sun/Moon Directional Light) tạo vệt bóng & viền sáng xốp
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
    sunLight.position.set(45, 55, 35);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Ánh sáng viền bầu trời màu Cyan & Vàng hoàng hôn mềm mại
    const rimLightBlue = new THREE.PointLight(0x38bdf8, 3.2, 140);
    rimLightBlue.position.set(-45, 25, 20);
    scene.add(rimLightBlue);

    const rimLightGold = new THREE.PointLight(0xfcd34d, 2.0, 120);
    rimLightGold.position.set(50, -20, 15);
    scene.add(rimLightGold);

    // ==========================================
    // VẬT LIỆU MÂY 3D (Fluffy Cloud Materials)
    // ==========================================
    // Lớp mây chính gần camera
    const mainCloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3f7fc,
      roughness: 0.92,
      metalness: 0.02,
      flatShading: false,
      transparent: true,
      opacity: 0.94,
    });

    // Lớp mây xa (nền sau)
    const distantCloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6e4f7,
      roughness: 0.95,
      metalness: 0.01,
      flatShading: false,
      transparent: true,
      opacity: 0.76,
    });

    // ==========================================
    // TẠO CÁC CỤM ĐÁM MÂY 3D TRÔI TRONG BẦU TRỜI
    // ==========================================
    const cloudsGroup = new THREE.Group();
    scene.add(cloudsGroup);

    const clouds = [];

    // 1. Tầng mây trung tâm & tiền cảnh (Foreground & Midground Clouds)
    const mainCloudCount = 12;
    for (let i = 0; i < mainCloudCount; i++) {
      const scaleMult = 0.85 + Math.random() * 0.7;
      const cloud = createVolumetricCloud(mainCloudMaterial, scaleMult);

      // Phân bổ rộng khắp không gian để không che khuất tâm giữa
      const isLeftSide = i % 2 === 0;
      const x = isLeftSide
        ? -20 - Math.random() * 38
        : 20 + Math.random() * 38;
      const y = (Math.random() - 0.5) * 36 + (i % 3 === 0 ? 5 : -4);
      const z = (Math.random() - 0.5) * 28 - 2;

      cloud.position.set(x, y, z);
      // Xoay nhẹ tự nhiên
      cloud.rotation.y = Math.random() * Math.PI;

      cloudsGroup.add(cloud);

      clouds.push({
        mesh: cloud,
        speed: 0.018 + Math.random() * 0.018,
        baseY: y,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.4 + Math.random() * 0.4,
        driftLimitX: 68,
      });
    }

    // 2. Tầng mây xa xăm (Distant Background Clouds)
    const distantCloudCount = 9;
    for (let i = 0; i < distantCloudCount; i++) {
      const scaleMult = 1.4 + Math.random() * 0.9;
      const cloud = createVolumetricCloud(distantCloudMaterial, scaleMult);

      const x = (Math.random() - 0.5) * 140;
      const y = (Math.random() - 0.5) * 48 + 8;
      const z = -28 - Math.random() * 32;

      cloud.position.set(x, y, z);
      cloud.rotation.y = Math.random() * Math.PI;

      cloudsGroup.add(cloud);

      clouds.push({
        mesh: cloud,
        speed: 0.008 + Math.random() * 0.01,
        baseY: y,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.25 + Math.random() * 0.3,
        driftLimitX: 85,
      });
    }

    // ==========================================
    // BỤI SAO & HẠT BẦU TRỜI LẤP LÁNH (Sky Dust)
    // ==========================================
    const starCount = 240;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 180;
      starPositions[i + 1] = (Math.random() - 0.5) * 120 + 10;
      starPositions[i + 2] = (Math.random() - 0.5) * 90 - 15;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.2,
      color: 0xbfe3ff,
      transparent: true,
      opacity: 0.65,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ==========================================
    // TƯƠNG TÁC CHUỘT (Mouse Parallax mượt mà)
    // ==========================================
    let targetCameraX = 0;
    let targetCameraY = 2;

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = -(e.clientY / innerHeight) * 2 + 1;
      targetCameraX = nx * 9;
      targetCameraY = 2 + ny * 6;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    // ==========================================
    // ANIMATION RENDER LOOP
    // ==========================================
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Camera di chuyển mềm mượt (Lerp) theo chuột
      camera.position.x += (targetCameraX - camera.position.x) * 0.045;
      camera.position.y += (targetCameraY - camera.position.y) * 0.045;
      camera.lookAt(0, 2, 0);

      // Mây trôi dạt êm ả qua bầu trời và bập bềnh nhẹ nhàng
      clouds.forEach((c) => {
        c.mesh.position.x += c.speed;
        c.mesh.position.y = c.baseY + Math.sin(elapsedTime * c.bobSpeed + c.bobPhase) * 0.85;

        // Vòng lặp tuần hoàn mây khi trôi khỏi màn hình
        if (c.mesh.position.x > c.driftLimitX) {
          c.mesh.position.x = -c.driftLimitX;
        }
      });

      // Bầu trời sao xoay cực chậm tạo độ sâu vô tận
      stars.rotation.y = elapsedTime * 0.008;

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

      mainCloudMaterial.dispose();
      distantCloudMaterial.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="english-3d-wrapper" aria-hidden="true">
      {/* Three.js Canvas Đám mây 3D thuần túy */}
      <div ref={mountRef} className="three-canvas-container" />

      {/* Ánh sáng mờ ảo hoàng hôn/bầu trời xanh thẳm */}
      <div className="ambient-backdrop-glows">
        <div className="glow-sphere glow-emerald" />
        <div className="glow-sphere glow-sapphire" />
        <div className="glow-sphere glow-amber" />
      </div>
    </div>
  );
}
