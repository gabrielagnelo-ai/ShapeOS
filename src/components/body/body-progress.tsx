"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pause, Rotate3D, Ruler } from "lucide-react";
import styles from "./body-progress.module.css";
import { GlassCard } from "@/components/ui/glass-card";
import { IconTile } from "@/components/ui/group";
import { compareBody, TAPE_FIELDS, type BodyEntry, type ChangeStatus, type TapeField } from "@/lib/body-progress";
import { lerpShape, loadBodyModel, solveBodyShape, type BodyMeasureKey, type BodyModel, type BodyShape, type Sex } from "./body-engine";
import type { BodyScene, TapeView } from "./body-scene";

const PERIODS = [7, 30, 90] as const;
const KEY_OF: Record<TapeField, BodyMeasureKey> = { chestCm: "chest", waistCm: "waist", hipCm: "hip", armCm: "arm", thighCm: "thigh", calfCm: "calf" };
const STATUS: Record<ChangeStatus, { color: string; text: string }> = {
  muscle: { color: "#b8ff00", text: "massa magra" },
  fat: { color: "#fbbf24", text: "redução de gordura" },
  warn: { color: "#f87171", text: "atenção" },
  stable: { color: "#a1a1aa", text: "estável" },
  unknown: { color: "#71717a", text: "sem comparação" },
};
const LIT: ChangeStatus[] = ["muscle", "fat", "warn"];

const fmt = (n: number, digits = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
const ease = (k: number) => 1 - Math.pow(1 - k, 3);

function label(field: TapeField, sex: Sex) {
  return { chestCm: sex === "female" ? "Busto" : "Peito", waistCm: "Cintura", hipCm: "Quadril", armCm: "Braço", thighCm: "Coxa", calfCm: "Panturrilha" }[field];
}

type Engine = {
  model: BodyModel;
  scene: BodyScene;
  shapes: Map<string, BodyShape>;
  morph: { from: BodyShape; to: BodyShape; start: number; duration: number } | null;
  shown: BodyShape | null;
  tapes: TapeView[];
  requestRender: () => void;
};

export function BodyProgress({ sex, heightCm, timeline, goal, className = "mt-8" }: { sex: Sex; heightCm: number; timeline: BodyEntry[]; goal?: ReactNode; className?: string }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [view, setView] = useState<"front" | "side" | "back" | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const comparison = useMemo(() => compareBody(timeline, period), [timeline, period]);
  const figureRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagRefs = useRef<Partial<Record<TapeField, HTMLDivElement | null>>>({});
  const engine = useRef<Engine | null>(null);
  const rotation = useRef({ current: 0.2, target: 0.2, velocity: 0, auto: false });
  const dragX = useRef<number | null>(null);
  const dragTime = useRef(0);

  // Renderiza somente durante uma interação, uma transformação ou rotação solicitada.
  useEffect(() => {
    let disposed = false;
    let scene: BodyScene | null = null;
    let observer: IntersectionObserver | null = null;
    let resize: ResizeObserver | null = null;
    let visible = false;
    let running = false;
    let lastTime = 0;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = preference.matches;
    let frame: (now: number) => void = () => {};
    const stop = () => { scene?.setAnimationLoop(null); running = false; };
    const wake = () => {
      if (disposed || !scene || !visible || document.hidden || running) return;
      lastTime = performance.now();
      running = true;
      scene.setAnimationLoop(frame);
    };
    const onVisibility = () => { if (document.hidden) stop(); else wake(); };
    const onPreference = () => { reduceMotion = preference.matches; wake(); };
    document.addEventListener("visibilitychange", onVisibility);
    preference.addEventListener("change", onPreference);

    (async () => {
      const [model, { createBodyScene }] = await Promise.all([loadBodyModel(), import("./body-scene")]);
      if (disposed || !canvasRef.current || !figureRef.current) return;
      scene = createBodyScene(canvasRef.current, model);
      engine.current = { model, scene, shapes: new Map(), morph: null, shown: null, tapes: [], requestRender: wake };
      setStatus("ready");

      let width = 0, height = 0;
      frame = (now: number) => {
        const e = engine.current, figure = figureRef.current;
        if (document.hidden || !visible || !e || !figure) { stop(); return; }
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        if (figure.clientWidth !== width || figure.clientHeight !== height) {
          width = figure.clientWidth;
          height = figure.clientHeight;
          if (width && height) e.scene.resize(width, height);
        }
        if (e.morph) {
          const k = !reduceMotion && e.morph.duration ? Math.min(1, (now - e.morph.start) / e.morph.duration) : 1;
          e.shown = lerpShape(e.morph.from, e.morph.to, ease(k));
          e.scene.setShape(e.shown, e.tapes, ease(k));
          if (k >= 1) {
            e.scene.setTapes(e.shown, e.tapes);
            e.scene.setTapesVisible(true);
            e.morph = null;
          }
        }
        const r = rotation.current;
        if (dragX.current === null && !reduceMotion) {
          r.target += (r.auto ? 0.3 : r.velocity) * dt;
          r.velocity *= Math.exp(-7 * dt);
        }
        if (reduceMotion || dragX.current !== null) r.current = r.target;
        else r.current += (r.target - r.current) * (1 - Math.exp(-14 * dt));
        e.scene.render(r.current);
        for (const field of TAPE_FIELDS) {
          const tag = tagRefs.current[field];
          if (!tag) continue;
          const y = e.scene.tapeScreenY(KEY_OF[field]);
          tag.style.opacity = y == null ? "0" : "1";
          if (y != null) tag.style.transform = `translateY(${y * height}px) translateY(-50%)`;
        }
        const moving = !reduceMotion && (r.auto || Math.abs(r.target - r.current) > 0.0005 || Math.abs(r.velocity) > 0.001);
        if (!e.morph && !moving) stop();
      };
      observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) wake(); else stop();
      }, { rootMargin: "80px" });
      observer.observe(figureRef.current);
      resize = new ResizeObserver(wake);
      resize.observe(figureRef.current);
    })().catch((error) => {
      console.error(error);
      if (!disposed) setStatus("failed");
    });

    return () => {
      disposed = true;
      stop();
      observer?.disconnect();
      resize?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      preference.removeEventListener("change", onPreference);
      scene?.dispose();
      engine.current = null;
    };
  }, []);

  // ao trocar o período, o corpo se transforma do registro anterior até o atual
  useEffect(() => {
    const e = engine.current;
    if (status !== "ready" || !e || !comparison) return;
    const solve = (entry: BodyEntry) => {
      if (!e.shapes.has(entry.date)) {
        e.shapes.set(entry.date, solveBodyShape(e.model, {
          sex,
          heightCm,
          weightKg: entry.weightKg,
          leanMassKg: entry.leanMassKg,
          measures: { neck: entry.neckCm, chest: entry.chestCm, waist: entry.waistCm, hip: entry.hipCm, arm: entry.armCm, thigh: entry.thighCm, calf: entry.calfCm },
        }));
      }
      return e.shapes.get(entry.date)!;
    };
    const to = solve(comparison.current);
    const from = e.shown ?? (comparison.before ? solve(comparison.before) : to);
    e.tapes = TAPE_FIELDS.filter((f) => comparison.current[f] != null).map((f) => ({
      key: KEY_OF[f],
      color: STATUS[comparison.statuses[f]].color,
      zone: LIT.includes(comparison.statuses[f]),
    }));
    e.scene.setTapesVisible(false);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    e.morph = { from, to, start: performance.now(), duration: reduceMotion || from === to ? 0 : 700 };
    e.requestRender();
  }, [status, comparison, sex, heightCm]);

  if (!comparison) return null;
  const { current, before } = comparison;
  const missing = TAPE_FIELDS.filter((f) => current[f] == null).map((f) => label(f, sex).toLowerCase());
  const selectView = (next: "front" | "side" | "back") => {
    const angle = { front: 0, side: Math.PI / 2, back: Math.PI }[next];
    const r = rotation.current;
    r.target = r.current + Math.atan2(Math.sin(angle - r.current), Math.cos(angle - r.current));
    r.velocity = 0;
    r.auto = false;
    setView(next);
    setAutoRotate(false);
    engine.current?.requestRender();
  };

  const stat = (title: string, value: string, delta: number | null, unit: string, goodWhenUp: boolean | null) => {
    const tone = delta == null || Math.abs(delta) < 0.05 || goodWhenUp === null ? "text-text-muted" : (delta > 0) === goodWhenUp ? "text-success" : "text-danger";
    return (
      <div className="min-w-0 px-3 py-3 shadow-[-1px_0_0_var(--hairline)] sm:px-4">
        <p className="text-caption text-text-muted">{title}</p>
        <p className="mt-1 whitespace-nowrap text-body font-semibold tabular-nums sm:text-[20px] sm:leading-7">{value}</p>
        <p className={`whitespace-nowrap text-caption font-semibold tabular-nums ${tone}`}>{delta == null ? "—" : `${signed(delta)} ${unit}`}</p>
      </div>
    );
  };

  return (
    <GlassCard className={className} aria-labelledby="body-title">
      <div className="flex flex-wrap items-center gap-3">
        <IconTile icon={Ruler} colour="blue" />
        <div className="mr-auto">
          <h2 id="body-title" className="text-h4">Composição corporal</h2>
          <p className="text-body-sm text-text-muted">
            {before
              ? `Comparado ao registro de ${new Date(before.date).toLocaleDateString("pt-BR")} (${comparison.days} dias).`
              : "Faça mais um check-in para comparar a evolução."}
          </p>
        </div>
        <div role="group" aria-label="Comparar com" className={styles.segmented}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={styles.segment}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-[14px] bg-surface-tertiary">
        {stat("Peso", `${fmt(current.weightKg)} kg`, comparison.weightDelta, "kg", null)}
        {stat("Gordura", current.bodyFatPct == null ? "—" : `${fmt(current.bodyFatPct)}%`, comparison.bodyFatDelta, "pontos", false)}
        {stat("Massa magra", current.leanMassKg == null ? "—" : `${fmt(current.leanMassKg)} kg`, comparison.leanDelta, "kg", true)}
      </div>

      <div
        ref={figureRef}
        className={styles.stage}
      >
        <canvas
          ref={canvasRef}
          role="img"
          tabIndex={status === "ready" ? 0 : -1}
          aria-label="Modelo corporal 3D. Arraste ou use as setas para girar. As cores indicam mudanças nas medidas."
          className={`${styles.canvas} ${status === "ready" ? styles.ready : ""}`}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
            event.preventDefault();
            if (event.key === "Home") { selectView("front"); return; }
            rotation.current.target += event.key === "ArrowLeft" ? -Math.PI / 8 : Math.PI / 8;
            rotation.current.auto = false;
            rotation.current.velocity = 0;
            setView(null);
            setAutoRotate(false);
            engine.current?.requestRender();
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            dragX.current = event.clientX;
            dragTime.current = event.timeStamp;
            rotation.current.target = rotation.current.current;
            rotation.current.velocity = 0;
            rotation.current.auto = false;
            setAutoRotate(false);
            setView(null);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragX.current === null) return;
            const movement = (event.clientX - dragX.current) * 0.009;
            rotation.current.target += movement;
            rotation.current.velocity = Math.max(-2, Math.min(2, movement / Math.max(0.008, (event.timeStamp - dragTime.current) / 1000)));
            dragX.current = event.clientX;
            dragTime.current = event.timeStamp;
            engine.current?.requestRender();
          }}
          onPointerUp={(event) => {
            dragX.current = null;
            if (event.timeStamp - dragTime.current > 80) rotation.current.velocity = 0;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            engine.current?.requestRender();
          }}
          onPointerCancel={() => { dragX.current = null; rotation.current.velocity = 0; }}
          onLostPointerCapture={() => { dragX.current = null; }}
        />
        {status === "loading" ? <p className="absolute inset-x-0 top-[46%] text-center text-sm text-zinc-500">Carregando modelo 3D…</p> : null}
        {status === "failed" ? <p className="absolute inset-x-[10%] top-[40%] text-center text-sm text-zinc-400">Não foi possível exibir o modelo 3D neste navegador. Suas medidas estão listadas abaixo.</p> : null}
        {status === "ready" ? <p className={styles.hint}>Arraste para explorar</p> : null}

        {TAPE_FIELDS.map((field, i) => {
          const s = comparison.statuses[field];
          const delta = comparison.deltas[field];
          const left = i < 3;
          return (
            <div
              key={field}
              ref={(el) => { tagRefs.current[field] = el; }}
              aria-hidden="true"
              style={{ opacity: 0 }}
              className={`${styles.measureLabel} pointer-events-none absolute top-0 hidden flex-col gap-0.5 whitespace-nowrap text-xs text-zinc-400 transition-opacity duration-150 sm:flex ${left ? "right-[80%] items-end pr-4 text-right" : "left-[80%] pl-4"}`}
            >
              <span className={`absolute top-1/2 size-2 -translate-y-1/2 rounded-full ${left ? "right-0" : "left-0"}`} style={{ background: STATUS[s].color, boxShadow: `0 0 10px ${STATUS[s].color}` }} />
              {label(field, sex)}
              <span className="flex items-baseline gap-1.5">
                <b className="text-[13px] font-semibold text-zinc-100">{current[field] == null ? "—" : `${fmt(current[field]!)} cm`}</b>
                {delta != null ? <em className="not-italic font-semibold" style={{ color: STATUS[s].color }}>{signed(delta)}</em> : null}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.controls} aria-label="Controles do modelo 3D">
        <div className={styles.segmented} role="group" aria-label="Ângulo do modelo">
          {(["front", "side", "back"] as const).map((angle) => <button key={angle} type="button" className={styles.segment} aria-pressed={view === angle} disabled={status !== "ready"} onClick={() => selectView(angle)}>{{ front: "Frente", side: "Perfil", back: "Costas" }[angle]}</button>)}
        </div>
        <button type="button" className={styles.rotateButton} disabled={status !== "ready"} aria-pressed={autoRotate} aria-label={autoRotate ? "Pausar rotação" : "Girar automaticamente"} onClick={() => {
          rotation.current.auto = !autoRotate;
          rotation.current.velocity = 0;
          setAutoRotate(!autoRotate);
          setView(null);
          engine.current?.requestRender();
        }}>{autoRotate ? <Pause size={16} /> : <Rotate3D size={17} />}<span>{autoRotate ? "Pausar" : "Girar"}</span></button>
      </div>

      <ul className={`mt-3 grid grid-cols-2 overflow-hidden rounded-[14px] bg-surface-tertiary ${status === "failed" ? "" : "sm:hidden"}`} aria-label="Circunferências">
        {TAPE_FIELDS.map((field) => {
          const s = comparison.statuses[field];
          const delta = comparison.deltas[field];
          return (
            <li key={field} className="px-3 py-2.5 text-caption text-text-muted shadow-[-1px_0_0_var(--hairline),0_-1px_0_var(--hairline)]">
              {label(field, sex)}
              <b className="mt-0.5 block text-body-sm font-semibold text-text-primary">
                {current[field] == null ? "—" : `${fmt(current[field]!)} cm`}{" "}
                {delta != null ? <span style={{ color: STATUS[s].color }}>{signed(delta)}</span> : null}
              </b>
              {STATUS[s].text}
            </li>
          );
        })}
      </ul>

      {missing.length ? (
        <p className="mt-3 text-body-sm text-text-muted">
          Informe {missing.length > 1 ? `${missing.slice(0, -1).join(", ")} e ${missing[missing.length - 1]}` : missing[0]} no check-in para o modelo mostrar todas as regiões.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption font-normal text-text-muted">
        {(["muscle", "fat", "warn"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: STATUS[s].color }} />
            {s === "muscle" ? "Ganho de massa magra" : s === "fat" ? "Redução de gordura" : "Atenção"}
          </span>
        ))}
        <a href="/acompanhamento#novo-checkin" className="ml-auto inline-flex min-h-10 items-center rounded-full bg-fill px-4 py-2 text-body-sm font-semibold text-text-primary hover:bg-fill-strong">
          Registrar medidas
        </a>
      </div>
      {goal}
    </GlassCard>
  );
}
