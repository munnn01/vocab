import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BookOpen, Lightbulb, ArrowUpRight } from "lucide-react";

// Dữ liệu kiến thức tiếng Anh thực tế, học thuật, chuẩn bản xứ
export const ENGLISH_KNOWLEDGE_CARDS = [
  {
    id: "card-1",
    category: "Thành ngữ (Idiom)",
    accent: "amber",
    tag: "Giao tiếp tự nhiên",
    term: "A blessing in disguise",
    phonetic: "/ə ˈblesɪŋ ɪn dɪsˈɡaɪz/",
    meaning: "Một điều may mắn ẩn sau khó khăn, trắc trở",
    example: "Losing that job was a blessing in disguise; I found my true passion.",
    pos: "idiom",
    depth: 1.2,
    defaultPos: { x: -38, y: -22, z: 20 },
  },
  {
    id: "card-2",
    category: "Gốc từ (Etymology)",
    accent: "blue",
    tag: "Mở rộng vốn từ",
    term: "Gốc 'chron-' (Thời gian)",
    phonetic: "Từ tiếng Hy Lạp khronos",
    meaning: "Gốc cấu tạo nên các từ chỉ dòng thời gian",
    example: "chronological (theo thứ tự), synchronize (đồng bộ), chronic (mãn tính)",
    pos: "root",
    depth: 0.9,
    defaultPos: { x: 38, y: -26, z: -10 },
  },
  {
    id: "card-3",
    category: "Cặp từ dễ nhầm lẫn",
    accent: "rose",
    tag: "Phân biệt sắc thái",
    term: "Affect (v) vs. Effect (n)",
    phonetic: "/əˈfekt/  vs  /ɪˈfekt/",
    meaning: "Affect là tác động (hành động); Effect là kết quả/ảnh hưởng (danh từ)",
    example: "Smoking affects your health. / The law had a positive effect.",
    pos: "usage",
    depth: 1.4,
    defaultPos: { x: -40, y: 22, z: 30 },
  },
  {
    id: "card-4",
    category: "Collocation tự nhiên",
    accent: "emerald",
    tag: "Cách nói bản xứ",
    term: "Heavy rain (không dùng 'strong rain')",
    phonetic: "Tính từ đi kèm danh từ",
    meaning: "Trong tiếng Anh, mưa to luôn dùng 'heavy rain' hoặc 'torrential rain'",
    example: "We were delayed by heavy rain on the highway.",
    pos: "collocation",
    depth: 0.8,
    defaultPos: { x: 42, y: 20, z: 15 },
  },
  {
    id: "card-5",
    category: "Từ vựng học thuật C1",
    accent: "purple",
    tag: "IELTS / Học thuật",
    term: "Feasible (adj)",
    phonetic: "/ˈfiːzəbl/",
    meaning: "Khả thi, có thể thực hiện được một cách hiệu quả",
    example: "The committee agreed that the proposal was economically feasible.",
    pos: "vocab",
    depth: 1.1,
    defaultPos: { x: 0, y: -40, z: -25 },
  },
];

// Các từ vựng/khái niệm mini trôi nổi tạo chiều sâu không gian
export const FLOATING_PILLS = [
  { text: "Bite the bullet · Chấp nhận gian nan", x: 18, y: -48, z: -40, accent: "amber" },
  { text: "Draw a conclusion · Rút ra kết luận", x: -22, y: -46, z: -30, accent: "emerald" },
  { text: "Meticulous /məˈtɪkjələs/ · Tỉ mỉ", x: -46, y: -2, z: -50, accent: "purple" },
  { text: "Gốc 'bene-' (Tốt) → Benefit, Benevolent", x: 44, y: -4, z: -35, accent: "blue" },
  { text: "Principal (chính) vs Principle (nguyên tắc)", x: 26, y: 44, z: -45, accent: "rose" },
  { text: "Hit the nail on the head · Nói trúng đích", x: -28, y: 42, z: -35, accent: "amber" },
];

export function English3DScene({ onSelectKnowledge }) {
  const mountRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeCardId, setActiveCardId] = useState(null);

  // Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Kiểm tra hỗ trợ WebGL
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      // Fallback nếu môi trường không có WebGL
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 75;

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Ánh sáng êm dịu, học thuật sang trọng (Sapphire & Amber/Emerald)
    const ambientLight = new THREE.AmbientLight(0x2a3556, 1.2);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x38bdf8, 2.5, 120);
    pointLight1.position.set(-35, 25, 30);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x10b981, 2.2, 120);
    pointLight2.position.set(40, -25, 25);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xf59e0b, 1.6, 90);
    pointLight3.position.set(0, 35, 10);
    scene.add(pointLight3);

    // 1. Tạo các khối đa diện hình học pha lê 3D (Crystalline Polyhedra)
    const polyGroup = new THREE.Group();
    scene.add(polyGroup);

    const polyGeometries = [
      new THREE.IcosahedronGeometry(3.5, 0),
      new THREE.OctahedronGeometry(2.8, 0),
      new THREE.DodecahedronGeometry(3.2, 0),
      new THREE.TetrahedronGeometry(3.0, 0),
      new THREE.TorusGeometry(3.2, 0.7, 16, 40),
    ];

    const polyMaterials = [
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        metalness: 0.15,
        roughness: 0.25,
        transmission: 0.65,
        thickness: 1.2,
        transparent: true,
        opacity: 0.75,
        wireframe: false,
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0x10b981,
        metalness: 0.2,
        roughness: 0.3,
        transmission: 0.6,
        thickness: 1.0,
        transparent: true,
        opacity: 0.7,
        wireframe: false,
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0xfbbf24,
        metalness: 0.2,
        roughness: 0.35,
        transmission: 0.5,
        thickness: 0.8,
        transparent: true,
        opacity: 0.65,
        wireframe: false,
      }),
      new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        roughness: 0.4,
        wireframe: true,
      }),
    ];

    const polyhedra = [];
    const polyPositions = [
      { x: -32, y: 18, z: -15, rot: { x: 0.005, y: 0.008 } },
      { x: 34, y: 22, z: -20, rot: { x: -0.006, y: 0.005 } },
      { x: -35, y: -20, z: -25, rot: { x: 0.004, y: -0.007 } },
      { x: 36, y: -18, z: -10, rot: { x: -0.005, y: -0.005 } },
      { x: 0, y: 32, z: -30, rot: { x: 0.007, y: 0.003 } },
      { x: 0, y: -34, z: -35, rot: { x: -0.004, y: 0.006 } },
    ];

    polyPositions.forEach((pos, i) => {
      const geo = polyGeometries[i % polyGeometries.length];
      const mat = polyMaterials[i % polyMaterials.length];
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      polyGroup.add(mesh);
      polyhedra.push({ mesh, rot: pos.rot, baseY: pos.y, phase: i * 1.2 });
    });

    // 2. Mạng lưới hạt bụi vũ trụ/tinh cầu tri thức (Subtle Academic Dust Particles)
    const particleCount = 280;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const baseColors = [
      new THREE.Color(0x38bdf8),
      new THREE.Color(0x34d399),
      new THREE.Color(0xfcd34d),
      new THREE.Color(0xa78bfa),
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 110;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;

      const col = baseColors[Math.floor(Math.random() * baseColors.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Xử lý chuyển động chuột (Parallax)
    let targetCameraX = 0;
    let targetCameraY = 0;

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = -(e.clientY / innerHeight) * 2 + 1;
      targetCameraX = nx * 10;
      targetCameraY = ny * 7;
      setMousePos({ x: nx, y: ny });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Xử lý thay đổi kích thước cửa sổ
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    // Vòng lặp Render (Animation Loop)
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Camera lerp theo chuột
      camera.position.x += (targetCameraX - camera.position.x) * 0.04;
      camera.position.y += (targetCameraY - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      // Xoay các khối đa diện pha lê
      polyhedra.forEach((item) => {
        item.mesh.rotation.x += item.rot.x;
        item.mesh.rotation.y += item.rot.y;
        item.mesh.position.y = item.baseY + Math.sin(elapsedTime * 0.8 + item.phase) * 1.8;
      });

      // Xoay nhẹ mây hạt tri thức
      particles.rotation.y = elapsedTime * 0.02;
      particles.rotation.x = Math.sin(elapsedTime * 0.015) * 0.05;

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

      // Giải phóng bộ nhớ WebGL
      polyGeometries.forEach((g) => g.dispose());
      polyMaterials.forEach((m) => m.dispose());
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="english-3d-wrapper" aria-hidden="false">
      {/* Three.js WebGL Canvas Background */}
      <div ref={mountRef} className="three-canvas-container" />

      {/* Ánh sáng hào quang nền dịu mắt */}
      <div className="ambient-backdrop-glows">
        <div className="glow-sphere glow-emerald" />
        <div className="glow-sphere glow-sapphire" />
        <div className="glow-sphere glow-amber" />
      </div>

      {/* Tầng Thẻ kiến thức Tiếng Anh 3D tương tác */}
      <div
        className="english-cards-3d-space"
        style={{
          perspective: "1200px",
          transform: `rotateX(${-mousePos.y * 3.5}deg) rotateY(${mousePos.x * 4.5}deg)`,
        }}
      >
        {ENGLISH_KNOWLEDGE_CARDS.map((card) => {
          const isActive = activeCardId === card.id;
          const parallaxX = mousePos.x * card.depth * 24;
          const parallaxY = -mousePos.y * card.depth * 18;

          return (
            <div
              key={card.id}
              className={`knowledge-card-3d accent-${card.accent} ${isActive ? "active" : ""}`}
              style={{
                transform: `translate3d(calc(${card.defaultPos.x}vw + ${parallaxX}px), calc(${card.defaultPos.y}vh + ${parallaxY}px), ${card.defaultPos.z}px)`,
              }}
              onMouseEnter={() => setActiveCardId(card.id)}
              onMouseLeave={() => setActiveCardId(null)}
              onClick={() => onSelectKnowledge?.(card)}
              role="region"
              aria-label={card.term}
            >
              <div className="card-glass-body">
                <div className="card-top-row">
                  <span className="card-category-badge">
                    <BookOpen size={13} />
                    <span>{card.category}</span>
                  </span>
                  <span className="card-tag-badge">{card.tag}</span>
                </div>

                <div className="card-term-header">
                  <h3>{card.term}</h3>
                  {card.phonetic && <span className="card-phonetic">{card.phonetic}</span>}
                </div>

                <p className="card-meaning">{card.meaning}</p>

                <div className="card-example-box">
                  <span className="example-label">Ví dụ thực tế:</span>
                  <p>"{card.example}"</p>
                </div>

                <div className="card-footer-action">
                  <span>Kiến thức thực hành</span>
                  <ArrowUpRight size={14} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Các viên thuốc tri thức mini (Floating Knowledge Pills) */}
        {FLOATING_PILLS.map((pill, idx) => {
          const pillX = mousePos.x * 12;
          const pillY = -mousePos.y * 10;
          return (
            <div
              key={idx}
              className={`floating-pill accent-${pill.accent}`}
              style={{
                transform: `translate3d(calc(${pill.x}vw + ${pillX}px), calc(${pill.y}vh + ${pillY}px), ${pill.z}px)`,
              }}
            >
              <Lightbulb size={12} />
              <span>{pill.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
