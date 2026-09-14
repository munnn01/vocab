import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Tạo texture đám mây siêu thực bằng Canvas 2D
 * Sử dụng nhiều tầng khói xốp (turbulent smoke puffs) với độ mờ viền suy giảm hàm mũ
 * để khi xếp chồng trong không gian 3D sẽ tạo thành khối mây thực tế 100% như nhìn từ máy bay
 */
function createRealisticCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 512, 512);

  // Tạo các cụm đốm khói ngẫu nhiên tích tụ thành một vệt mây tơi xốp
  const centerX = 256;
  const centerY = 256;

  // Lớp nền mờ tỏa rộng (soft ambient wisp)
  const baseGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 240);
  baseGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  baseGrad.addColorStop(0.4, "rgba(240, 246, 255, 0.22)");
  baseGrad.addColorStop(0.7, "rgba(220, 235, 255, 0.08)");
  baseGrad.addColorStop(1, "rgba(200, 220, 255, 0)");
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 240, 0, Math.PI * 2);
  ctx.fill();

  // Tạo 65 đốm hạt sương mây ngẫu nhiên đan xen tạo vân mây tự nhiên
  const puffCount = 65;
  for (let i = 0; i < puffCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.pow(Math.random(), 1.4) * 160;
    const px = centerX + Math.cos(angle) * dist;
    const py = centerY + Math.sin(angle) * dist * 0.72; // Hơi dẹt ngang theo tự nhiên
    const radius = 55 + Math.random() * 85;

    const puffGrad = ctx.createRadialGradient(px, py, 0, px, py, radius);
    const alpha = 0.12 + Math.random() * 0.18;
    puffGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    puffGrad.addColorStop(0.45, `rgba(245, 250, 255, ${alpha * 0.5})`);
    puffGrad.addColorStop(0.8, `rgba(230, 242, 255, ${alpha * 0.15})`);
    puffGrad.addColorStop(1, "rgba(215, 235, 255, 0)");

    ctx.fillStyle = puffGrad;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function English3DScene() {
  const mountRef = useRef(null);

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

    // Sương mù đường chân trời thực tế (Realistic Horizon Fog)
    // Tông màu trời hoàng hôn / chạng vạng thực tế
    const skyColor = new THREE.Color(0x0e172e);
    scene.fog = new THREE.Fog(skyColor, 25, 140);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.5, 50);

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // ==========================================
    // ÁNH SÁNG THỰC TẾ CHIẾU MÂY (Realistic Lighting)
    // ==========================================
    // Ánh sáng bầu trời tổng thể (Sky Ambient)
    const ambientLight = new THREE.AmbientLight(0x33476b, 1.8);
    scene.add(ambientLight);

    // Ánh sáng mặt trời chiếu từ trên cao xuống tạo đỉnh mây rực rỡ
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 3.2);
    sunLight.position.set(35, 60, 45);
    scene.add(sunLight);

    // Ánh phản xạ xanh lam từ bầu trời dưới đáy mây (Sky bounce)
    const skyBounceLight = new THREE.DirectionalLight(0x4770a8, 1.4);
    skyBounceLight.position.set(-20, -30, -20);
    scene.add(skyBounceLight);

    // Ánh nắng vàng nhẹ bên góc trời hoàng hôn
    const sunsetLight = new THREE.PointLight(0xf59e0b, 2.2, 160);
    sunsetLight.position.set(-45, 15, -10);
    scene.add(sunsetLight);

    // ==========================================
    // KHỞI TẠO CÁC TẦNG MÂY THỰC TẾ (Volumetric Cloud Banks)
    // ==========================================
    const cloudTexture = createRealisticCloudTexture();

    // Vật liệu mây mềm, hòa trộn khói tự nhiên
    const cloudMaterial = new THREE.MeshLambertMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    // Tạo hình học phẳng cho từng phiến mây
    const cloudGeo = new THREE.PlaneGeometry(28, 28);

    // Nhóm chứa toàn bộ các ngân mây
    const cloudsContainer = new THREE.Group();
    scene.add(cloudsContainer);

    const cloudClusters = [];
    const totalClusters = 18;

    for (let c = 0; c < totalClusters; c++) {
      const clusterGroup = new THREE.Group();

      // Mỗi cụm đám mây được tạo bởi 16-24 phiến mây xoay lệch và lồng vào nhau
      // tạo thành một khối mây có chiều sâu 3D dày dặn, xốp mịn, viền tơi như đời thực
      const puffsInCluster = 18 + Math.floor(Math.random() * 8);

      for (let p = 0; p < puffsInCluster; p++) {
        const mesh = new THREE.Mesh(cloudGeo, cloudMaterial);

        // Phân bổ các phiến mây thành một búp mây hình elip tự nhiên
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.pow(Math.random(), 1.2) * 12;
        const px = Math.cos(angle) * radius * 1.5; // Dài theo chiều ngang
        const py = (Math.random() - 0.45) * 6; // Đáy mây phẳng hơn đỉnh
        const pz = Math.sin(angle) * radius * 0.9;

        mesh.position.set(px, py, pz);
        mesh.rotation.z = Math.random() * Math.PI * 2;
        const pScale = 0.85 + Math.random() * 0.75;
        mesh.scale.set(pScale, pScale, 1);

        clusterGroup.add(mesh);
      }

      // Phân bổ các cụm mây theo độ sâu và không gian bầu trời
      // Giữ khoảng trống ở trung tâm để cổng đăng nhập nổi bật
      const isLeft = c % 2 === 0;
      const x = isLeft
        ? -22 - Math.random() * 45
        : 22 + Math.random() * 45;
      const y = (Math.random() - 0.5) * 38 + (c % 3 === 0 ? 6 : -5);
      const z = (Math.random() - 0.5) * 50 - 5;
      const clusterScale = 0.9 + Math.random() * 0.8;
      const speed = 0.014 + Math.random() * 0.016;

      clusterGroup.position.set(x, y, z);
      clusterGroup.scale.set(clusterScale, clusterScale * 0.85, clusterScale);

      cloudsContainer.add(clusterGroup);

      cloudClusters.push({
        group: clusterGroup,
        speed,
        baseY: y,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.35 + Math.random() * 0.35,
        driftLimitX: 72,
      });
    }

    // Tinh cầu / ánh sao li ti trên bầu trời đêm thực tế
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 200;
      starPos[i + 1] = (Math.random() - 0.5) * 120 + 20;
      starPos[i + 2] = (Math.random() - 0.5) * 100 - 25;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.0,
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.65,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ==========================================
    // TƯƠNG TÁC CHUỘT (Mouse Parallax)
    // ==========================================
    let targetCameraX = 0;
    let targetCameraY = 1.5;

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = -(e.clientY / innerHeight) * 2 + 1;
      targetCameraX = nx * 8.5;
      targetCameraY = 1.5 + ny * 5.5;
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

      // Camera di chuyển êm dịu theo chuột
      camera.position.x += (targetCameraX - camera.position.x) * 0.04;
      camera.position.y += (targetCameraY - camera.position.y) * 0.04;
      camera.lookAt(0, 1.5, 0);

      // Mây trôi dạt liên tục ngang bầu trời
      cloudClusters.forEach((c) => {
        c.group.position.x += c.speed;
        c.group.position.y = c.baseY + Math.sin(elapsedTime * c.bobSpeed + c.bobPhase) * 0.75;

        // Vòng lặp tuần hoàn khi mây bay khỏi màn hình
        if (c.group.position.x > c.driftLimitX) {
          c.group.position.x = -c.driftLimitX;
        }

        // Đảm bảo từng phiến mây luôn hướng về phía camera (Billboarding)
        // để tạo độ xốp tròn đầy 100% tự nhiên không bị méo góc
        c.group.children.forEach((mesh) => {
          mesh.quaternion.copy(camera.quaternion);
        });
      });

      // Bầu trời sao xoay nhè nhẹ
      stars.rotation.y = elapsedTime * 0.005;

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

      cloudTexture.dispose();
      cloudMaterial.dispose();
      cloudGeo.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="english-3d-wrapper" aria-hidden="true">
      {/* Three.js Canvas Đám mây 3D siêu thực */}
      <div ref={mountRef} className="three-canvas-container" />

      {/* Ánh sáng khí quyển dịu mắt */}
      <div className="ambient-backdrop-glows">
        <div className="glow-sphere glow-sapphire" />
        <div className="glow-sphere glow-amber" />
      </div>
    </div>
  );
}
