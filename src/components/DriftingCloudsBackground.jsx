import React, { useEffect, useRef } from "react";

/**
 * Sinh trước (pre-render) một hình mây tích tự nhiên (realistic cumulus cloud sprite)
 * lên Offscreen Canvas 2D với các cụm bông mây (soft radial puffs),
 * bóng đổ màu trời phía dưới và viền sáng trên đỉnh.
 */
function generateCloudSprite(type) {
  let width = 600;
  let height = 260;

  if (type === "majestic") {
    width = 750;
    height = 320;
  } else if (type === "wide") {
    width = 850;
    height = 230;
  } else if (type === "wispy") {
    width = 500;
    height = 190;
  } else {
    // "fluffy"
    width = 580;
    height = 250;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  function drawPuff(cx, cy, rx, ry, opacity = 1, tone = "body") {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

    const grad = ctx.createRadialGradient(
      cx - rx * 0.12,
      cy - ry * 0.22,
      Math.min(rx, ry) * 0.08,
      cx,
      cy,
      Math.max(rx, ry)
    );

    if (tone === "highlight") {
      // Đỉnh mây đón ánh mặt trời
      grad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * opacity})`);
      grad.addColorStop(0.3, `rgba(255, 255, 255, ${0.8 * opacity})`);
      grad.addColorStop(0.65, `rgba(240, 248, 255, ${0.38 * opacity})`);
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    } else if (tone === "shadow") {
      // Đáy mây hơi ánh lam xám nhạt (tán xạ bầu trời)
      grad.addColorStop(0, `rgba(185, 210, 235, ${0.62 * opacity})`);
      grad.addColorStop(0.45, `rgba(175, 202, 230, ${0.35 * opacity})`);
      grad.addColorStop(0.8, `rgba(165, 195, 225, ${0.12 * opacity})`);
      grad.addColorStop(1, "rgba(165, 195, 225, 0)");
    } else {
      // Thân mây trắng bồng bềnh
      grad.addColorStop(0, `rgba(255, 255, 255, ${0.88 * opacity})`);
      grad.addColorStop(0.35, `rgba(250, 253, 255, ${0.68 * opacity})`);
      grad.addColorStop(0.7, `rgba(225, 240, 255, ${0.3 * opacity})`);
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    }

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  const cx = width * 0.5;
  const cy = height * 0.58;

  if (type === "majestic") {
    // Mây tích đồ sộ (Tall billowing cumulus)
    for (let i = -4; i <= 4; i++) {
      const px = cx + i * 65 + (Math.random() - 0.5) * 20;
      const py = cy + 45 + (Math.random() - 0.5) * 15;
      drawPuff(px, py, 95 + Math.random() * 25, 55 + Math.random() * 15, 0.75, "shadow");
    }
    for (let i = -3; i <= 3; i++) {
      const px = cx + i * 60 + (Math.random() - 0.5) * 25;
      const py = cy + 5 + (Math.random() - 0.5) * 20;
      drawPuff(px, py, 110 + Math.random() * 30, 80 + Math.random() * 20, 0.85, "body");
    }
    drawPuff(cx - 90, cy - 55, 95, 80, 0.9, "highlight");
    drawPuff(cx + 40, cy - 80, 115, 95, 0.95, "highlight");
    drawPuff(cx + 150, cy - 40, 85, 70, 0.88, "highlight");
    drawPuff(cx - 180, cy - 20, 75, 60, 0.82, "highlight");

    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const rDistX = (width * 0.38) * (0.8 + Math.random() * 0.2);
      const rDistY = (height * 0.35) * (0.8 + Math.random() * 0.2);
      const px = cx + Math.cos(angle) * rDistX;
      const py = cy + Math.sin(angle) * rDistY * 0.75;
      drawPuff(px, py, 50 + Math.random() * 25, 38 + Math.random() * 18, 0.55, "body");
    }
  } else if (type === "wide") {
    // Mây dẹt kéo dài (Strato-cumulus)
    for (let i = -6; i <= 6; i++) {
      const px = cx + i * 58 + (Math.random() - 0.5) * 20;
      const py = cy + 25 + (Math.random() - 0.5) * 12;
      drawPuff(px, py, 90 + Math.random() * 20, 42 + Math.random() * 10, 0.65, "shadow");
    }
    for (let i = -5; i <= 5; i++) {
      const px = cx + i * 62 + (Math.random() - 0.5) * 20;
      const py = cy - 10 + (Math.random() - 0.5) * 15;
      drawPuff(px, py, 105 + Math.random() * 25, 58 + Math.random() * 15, 0.8, "body");
    }
    for (let i = -3; i <= 3; i++) {
      const px = cx + i * 85 + (Math.random() - 0.5) * 30;
      const py = cy - 35 + (Math.random() - 0.5) * 15;
      drawPuff(px, py, 80 + Math.random() * 20, 48 + Math.random() * 12, 0.85, "highlight");
    }
  } else if (type === "wispy") {
    // Mây tơ mềm nhẹ (Wispy light cloud)
    for (let i = -4; i <= 4; i++) {
      const px = cx + i * 48 + (Math.random() - 0.5) * 18;
      const py = cy + (Math.random() - 0.5) * 18;
      drawPuff(px, py, 75 + Math.random() * 25, 38 + Math.random() * 14, 0.5, "body");
    }
    for (let i = -2; i <= 2; i++) {
      const px = cx + i * 55 + (Math.random() - 0.5) * 20;
      const py = cy - 18 + (Math.random() - 0.5) * 12;
      drawPuff(px, py, 60 + Math.random() * 20, 32 + Math.random() * 10, 0.6, "highlight");
    }
  } else {
    // "fluffy"
    for (let i = -3; i <= 3; i++) {
      const px = cx + i * 58 + (Math.random() - 0.5) * 18;
      const py = cy + 28 + (Math.random() - 0.5) * 10;
      drawPuff(px, py, 85 + Math.random() * 20, 48 + Math.random() * 12, 0.7, "shadow");
    }
    for (let i = -2; i <= 2; i++) {
      const px = cx + i * 65 + (Math.random() - 0.5) * 20;
      const py = cy - 5 + (Math.random() - 0.5) * 15;
      drawPuff(px, py, 98 + Math.random() * 25, 68 + Math.random() * 15, 0.85, "body");
    }
    drawPuff(cx - 45, cy - 45, 78, 58, 0.9, "highlight");
    drawPuff(cx + 45, cy - 40, 82, 60, 0.92, "highlight");
  }

  return canvas;
}

export function DriftingCloudsBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Chuẩn bị 4 mẫu sprite mây chân thực vẽ sẵn trong bộ nhớ
    const spriteMajestic = generateCloudSprite("majestic");
    const spriteWide = generateCloudSprite("wide");
    const spriteWispy = generateCloudSprite("wispy");
    const spriteFluffy = generateCloudSprite("fluffy");
    const sprites = [spriteMajestic, spriteWide, spriteWispy, spriteFluffy];

    // Khởi tạo 14 đám mây phân bổ theo 3 tầng độ sâu
    const cloudConfigs = [
      // Tầng xa (nhẹ nhàng, lơ lửng trên cao)
      { type: 2, scale: 0.55, speed: 0.18, yRatio: 0.08, opacity: 0.55, bobSpeed: 0.0008, bobAmp: 8 },
      { type: 3, scale: 0.65, speed: 0.22, yRatio: 0.16, opacity: 0.60, bobSpeed: 0.0010, bobAmp: 10 },
      { type: 1, scale: 0.70, speed: 0.20, yRatio: 0.24, opacity: 0.58, bobSpeed: 0.0007, bobAmp: 9 },
      { type: 2, scale: 0.60, speed: 0.25, yRatio: 0.32, opacity: 0.52, bobSpeed: 0.0009, bobAmp: 11 },

      // Tầng trung (bồng bềnh rõ nét)
      { type: 0, scale: 0.95, speed: 0.38, yRatio: 0.12, opacity: 0.82, bobSpeed: 0.0012, bobAmp: 14 },
      { type: 3, scale: 1.10, speed: 0.44, yRatio: 0.28, opacity: 0.85, bobSpeed: 0.0011, bobAmp: 16 },
      { type: 1, scale: 1.05, speed: 0.40, yRatio: 0.42, opacity: 0.78, bobSpeed: 0.0014, bobAmp: 15 },
      { type: 0, scale: 1.15, speed: 0.46, yRatio: 0.52, opacity: 0.80, bobSpeed: 0.0010, bobAmp: 18 },
      { type: 3, scale: 0.90, speed: 0.42, yRatio: 0.62, opacity: 0.75, bobSpeed: 0.0013, bobAmp: 14 },

      // Tầng gần (lớn, trôi nhẹ nhàng)
      { type: 1, scale: 1.55, speed: 0.68, yRatio: 0.68, opacity: 0.65, bobSpeed: 0.0015, bobAmp: 22 },
      { type: 0, scale: 1.70, speed: 0.78, yRatio: 0.76, opacity: 0.70, bobSpeed: 0.0013, bobAmp: 25 },
      { type: 3, scale: 1.45, speed: 0.62, yRatio: 0.84, opacity: 0.62, bobSpeed: 0.0016, bobAmp: 20 },
      { type: 1, scale: 1.80, speed: 0.82, yRatio: 0.92, opacity: 0.58, bobSpeed: 0.0012, bobAmp: 26 },
      { type: 0, scale: 1.35, speed: 0.58, yRatio: 0.20, opacity: 0.72, bobSpeed: 0.0011, bobAmp: 18 }
    ];

    const clouds = cloudConfigs.map((cfg, idx) => {
      const sprite = sprites[cfg.type];
      const spreadX = (width + 1200) * (idx / cloudConfigs.length) - 500;
      return {
        ...cfg,
        sprite,
        x: spreadX,
        baseY: cfg.yRatio * height,
        phase: Math.random() * Math.PI * 2,
        renderWidth: sprite.width * cfg.scale,
        renderHeight: sprite.height * cfg.scale,
      };
    });

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e) => {
      targetMouseX = (e.clientX / width - 0.5) * 45;
      targetMouseY = (e.clientY / height - 0.5) * 30;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      clouds.forEach((c) => {
        c.baseY = c.yRatio * height;
      });
    };

    window.addEventListener("resize", handleResize);

    let lastTime = performance.now();

    function render(currentTime) {
      animId = requestAnimationFrame(render);
      const dt = Math.min(currentTime - lastTime, 64);
      lastTime = currentTime;

      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.x += c.speed * (dt / 16.66);

        if (c.x > width + c.renderWidth * 0.5) {
          c.x = -c.renderWidth - Math.random() * 180;
          c.baseY = (c.yRatio + (Math.random() - 0.5) * 0.08) * height;
        }

        const bob = Math.sin(currentTime * c.bobSpeed + c.phase) * c.bobAmp;
        const parallaxOffsetX = mouseX * (c.speed * 1.8);
        const parallaxOffsetY = mouseY * (c.speed * 1.4);

        const drawX = c.x + parallaxOffsetX;
        const drawY = c.baseY + bob + parallaxOffsetY;

        ctx.globalAlpha = c.opacity;
        ctx.drawImage(c.sprite, drawX, drawY, c.renderWidth, c.renderHeight);
      }

      ctx.globalAlpha = 1.0;
    }

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="drifting-clouds-wrapper" aria-hidden="true">
      {/* Nền Canvas 2D mây trôi tự nhiên */}
      <canvas ref={canvasRef} className="clouds-canvas-container" />

      {/* Ánh dương rực rỡ & quầng quang học trên góc trời */}
      <div className="sky-sun-glow" />

      {/* Lớp sương mờ dịu mắt chân trời */}
      <div className="sky-horizon-haze" />
    </div>
  );
}
