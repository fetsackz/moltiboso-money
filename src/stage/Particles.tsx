import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { STAGE_H, STAGE_W } from "./hooks";

export interface ParticlesHandle {
  /** Gold coins bursting up from a point on the Stage. */
  coins(x: number, y: number, count?: number): void;
  /** Confetti raining from the top for `seconds`. */
  confetti(seconds?: number): void;
}

interface Particle {
  kind: "coin" | "confetti";
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  size: number;
  color: string;
  life: number;
}

const CONFETTI_COLORS = ["#f6e27a", "#d4a93c", "#2fbf7f", "#1f7a52", "#fff3c4", "#e9c46a"];

export const Particles = forwardRef<ParticlesHandle>(function Particles(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const rain = useRef(0);

  useImperativeHandle(ref, () => ({
    coins(x, y, count = 40) {
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const speed = 14 + Math.random() * 14;
        particles.current.push({
          kind: "coin",
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          spin: 0.15 + Math.random() * 0.25,
          angle: Math.random() * Math.PI,
          size: 16 + Math.random() * 12,
          color: "",
          life: 1,
        });
      }
    },
    confetti(seconds = 6) {
      rain.current = performance.now() + seconds * 1000;
    },
  }));

  useEffect(() => {
    const ctx = canvas.current!.getContext("2d")!;
    let frame = 0;
    const tick = (t: number) => {
      if (rain.current > t) {
        for (let i = 0; i < 6; i++) {
          particles.current.push({
            kind: "confetti",
            x: Math.random() * STAGE_W,
            y: -20,
            vx: (Math.random() - 0.5) * 4,
            vy: 4 + Math.random() * 5,
            spin: (Math.random() - 0.5) * 0.3,
            angle: Math.random() * Math.PI,
            size: 10 + Math.random() * 10,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            life: 1,
          });
        }
      }
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      particles.current = particles.current.filter((p) => p.y < STAGE_H + 60 && p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        if (p.kind === "coin") {
          p.vy += 0.9;
          p.vx *= 0.99;
          drawCoin(ctx, p);
        } else {
          p.vx += Math.sin(t / 300 + p.y / 50) * 0.05;
          drawConfetti(ctx, p);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} className="particles" width={STAGE_W} height={STAGE_H} />;
});

function drawCoin(ctx: CanvasRenderingContext2D, p: Particle) {
  const squash = Math.abs(Math.cos(p.angle));
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(Math.max(0.12, squash), 1);
  const g = ctx.createRadialGradient(-p.size * 0.3, -p.size * 0.3, 1, 0, 0, p.size);
  g.addColorStop(0, "#fff6c8");
  g.addColorStop(0.45, "#f1cf66");
  g.addColorStop(1, "#9c7425");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, p.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(110, 76, 18, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, p.size * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawConfetti(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.scale(1, Math.cos(p.angle * 2));
  ctx.fillStyle = p.color;
  ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  ctx.restore();
}
