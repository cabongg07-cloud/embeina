import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: 'dot' | 'star' | 'heart';
  bornAt: number;
  lifeMs: number;
  rotation: number;
  rotationSpeed: number;
}

interface FloatingMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  type: 'dot' | 'star';
  rotation: number;
}

interface SparkleCanvasProps {
  sparkleEnabled?: boolean;
  floatingParticlesEnabled?: boolean;
}

export const SparkleCanvas: React.FC<SparkleCanvasProps> = ({
  sparkleEnabled = true,
  floatingParticlesEnabled = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparkleEnabledRef = useRef(sparkleEnabled);
  const floatingEnabledRef = useRef(floatingParticlesEnabled);

  useEffect(() => {
    sparkleEnabledRef.current = sparkleEnabled;
  }, [sparkleEnabled]);

  useEffect(() => {
    floatingEnabledRef.current = floatingParticlesEnabled;
  }, [floatingParticlesEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let floatingMotes: FloatingMote[] = [];
    let lastEmitTime = 0;
    let lastPos = { x: -100, y: -100 };
    let cachedAccent = '#f4a3b0';
    let lastColorCheck = 0;
    let isMobile = window.innerWidth < 768;

    const initFloatingMotes = () => {
      const count = isMobile ? 8 : 18;
      floatingMotes = Array.from({ length: count }).map(() => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -0.15 - Math.random() * 0.25,
        size: 1.5 + Math.random() * 2.2,
        alpha: 0.15 + Math.random() * 0.25,
        type: Math.random() > 0.65 ? 'star' : 'dot',
        rotation: Math.random() * Math.PI,
      }));
    };

    const resizeCanvas = () => {
      isMobile = window.innerWidth < 768;
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (floatingMotes.length === 0) {
        initFloatingMotes();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const getAccentColor = (now: number) => {
      if (now - lastColorCheck > 150) {
        const val = getComputedStyle(document.documentElement)
          .getPropertyValue('--accent')
          .trim();
        if (val) cachedAccent = val;
        lastColorCheck = now;
      }
      return cachedAccent;
    };

    const spawnParticles = (x: number, y: number, count: number) => {
      if (motionQuery.matches || !sparkleEnabledRef.current) return;
      const maxParticles = isMobile ? 18 : 65;
      if (particles.length >= maxParticles) return;

      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        const pType: Particle['type'] =
          roll < 0.36 ? 'dot' : roll < 0.72 ? 'star' : 'heart';
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 0.6;
        particles.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.12,
          size:
            pType === 'dot'
              ? 1.8 + Math.random() * 2.0
              : pType === 'star'
              ? 4.0 + Math.random() * 3.2
              : 4.2 + Math.random() * 3.0,
          type: pType,
          bornAt: now,
          lifeMs: 700 + Math.random() * 220, // ~800ms fade
          rotation: (Math.random() - 0.5) * 0.5,
          rotationSpeed: (Math.random() - 0.5) * 0.02,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!sparkleEnabledRef.current) return;
      const now = performance.now();
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      const dist = Math.hypot(dx, dy);
      const minInterval = isMobile ? 65 : 22;

      if (now - lastEmitTime > minInterval && dist > 4) {
        const count = !isMobile && dist > 28 ? 2 : 1;
        spawnParticles(e.clientX, e.clientY, count);
        lastEmitTime = now;
        lastPos = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!sparkleEnabledRef.current) return;
      spawnParticles(e.clientX, e.clientY, isMobile ? 3 : 6);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });

    const drawFourPointStar = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      outerRadius: number,
      rotation: number
    ) => {
      const innerRadius = outerRadius * 0.32;
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      context.beginPath();
      for (let i = 0; i < 4; i++) {
        const outerAngle = (i * Math.PI) / 2;
        const innerAngle = outerAngle + Math.PI / 4;
        const ox = Math.cos(outerAngle) * outerRadius;
        const oy = Math.sin(outerAngle) * outerRadius;
        const ix = Math.cos(innerAngle) * innerRadius;
        const iy = Math.sin(innerAngle) * innerRadius;
        if (i === 0) {
          context.moveTo(ox, oy);
        } else {
          context.lineTo(ox, oy);
        }
        context.lineTo(ix, iy);
      }
      context.closePath();
      context.fill();
      context.restore();
    };

    const drawMiniHeart = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      rotation: number
    ) => {
      context.save();
      context.translate(x, y);
      context.rotate(rotation * 0.5);
      const s = size * 0.14;
      context.beginPath();
      context.moveTo(0, s * 3);
      context.bezierCurveTo(0, s * 2, -s * 5, -s * 2, -s * 5, -s * 5);
      context.bezierCurveTo(-s * 5, -s * 8.5, -s * 1, -s * 9, 0, -s * 5.5);
      context.bezierCurveTo(s * 1, -s * 9, s * 5, -s * 8.5, s * 5, -s * 5);
      context.bezierCurveTo(s * 5, -s * 2, 0, s * 2, 0, s * 3);
      context.closePath();
      context.fill();
      context.restore();
    };

    const render = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const accentColor = getAccentColor(now);

      // 1. Vẽ các hạt bay lơ lửng nền (nếu bật floatingParticlesEnabled)
      if (floatingEnabledRef.current && floatingMotes.length > 0) {
        for (let i = 0; i < floatingMotes.length; i++) {
          const m = floatingMotes[i];
          m.x += m.vx;
          m.y += m.vy;
          m.rotation += 0.005;

          if (m.y < -10) {
            m.y = window.innerHeight + 10;
            m.x = Math.random() * window.innerWidth;
          }
          if (m.x < -10) m.x = window.innerWidth + 10;
          if (m.x > window.innerWidth + 10) m.x = -10;

          ctx.save();
          ctx.globalAlpha = m.alpha;
          ctx.fillStyle = accentColor;
          if (m.type === 'star') {
            drawFourPointStar(ctx, m.x, m.y, m.size * 1.4, m.rotation);
          } else {
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // 2. Vẽ các hạt lấp lánh theo con trỏ chuột (nếu bật sparkleEnabled)
      if (sparkleEnabledRef.current && particles.length > 0) {
        const alive: Particle[] = [];

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const age = now - p.bornAt;
          if (age >= p.lifeMs) continue;

          const progress = age / p.lifeMs;
          const alpha =
            progress < 0.15
              ? (progress / 0.15) * 0.9
              : (1 - (progress - 0.15) / 0.85) * 0.9;

          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.rotationSpeed;

          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = accentColor;
          if (!isMobile) {
            ctx.shadowColor = accentColor;
            ctx.shadowBlur = 6;
          }

          const currentSize = p.size * (1 - progress * 0.22);

          if (p.type === 'star') {
            drawFourPointStar(ctx, p.x, p.y, currentSize, p.rotation);
          } else if (p.type === 'heart') {
            drawMiniHeart(ctx, p.x, p.y, currentSize, p.rotation);
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
          alive.push(p);
        }

        particles = alive;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ pointerEvents: 'none' }}
      className="fixed inset-0 z-50 pointer-events-none"
      aria-hidden="true"
    />
  );
};
