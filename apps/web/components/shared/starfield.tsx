"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  drift: number;
  color: string;
  sparkle: boolean;
};

const STAR_COLORS = ["#EFECE3", "#8FABD4", "#4A70A9", "#FFFFFF"];

export function Starfield({ density = 240 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let stars: Star[] = [];

    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    const createStar = (width: number, height: number): Star => {
      const size = 0.3 + Math.random() * 2.2;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size,
        baseAlpha: 0.35 + Math.random() * 0.65,
        twinkleSpeed: 0.6 + Math.random() * 1.6,
        twinkleOffset: Math.random() * Math.PI * 2,
        drift: 0.03 + Math.random() * 0.14,
        color:
          STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)] ||
          "#FFFFFF",
        sparkle: size > 1.6 && Math.random() > 0.68,
      };
    };

    const setup = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars = Array.from({ length: density }, () => createStar(width, height));
    };

    const drawSparkle = (star: Star, alpha: number) => {
      context.strokeStyle = `rgba(239, 236, 227, ${alpha * 0.42})`;
      context.lineWidth = 0.6;
      context.beginPath();
      context.moveTo(star.x - star.size * 2.1, star.y);
      context.lineTo(star.x + star.size * 2.1, star.y);
      context.moveTo(star.x, star.y - star.size * 2.1);
      context.lineTo(star.x, star.y + star.size * 2.1);
      context.stroke();
    };

    const render = (timeMs: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const time = timeMs / 1000;

      context.clearRect(0, 0, width, height);

      for (const star of stars) {
        star.y += star.drift;
        if (star.y > height + 4) {
          star.y = -4;
          star.x = Math.random() * width;
        }

        const twinkle =
          0.58 + 0.42 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
        const alpha = star.baseAlpha * twinkle;

        context.fillStyle = star.color;
        context.globalAlpha = alpha;
        context.beginPath();
        context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        context.fill();

        if (star.sparkle) {
          drawSparkle(star, alpha);
        }
      }

      context.globalAlpha = 1;
      animationFrame = window.requestAnimationFrame(render);
    };

    const onResize = () => {
      setup();
    };

    setup();
    animationFrame = window.requestAnimationFrame(render);
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
