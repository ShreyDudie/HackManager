import { useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { motion, useInView, useSpring, useMotionTemplate } from "framer-motion";
import {
  ArrowUpRight,
  Braces,
  Check,
  Code2,
  MousePointer2,
  Pause,
  Play,
  Sparkles,
  Zap,
} from "lucide-react";

const motionPreference = "(prefers-reduced-motion: reduce)";
function subscribeMotionPreference(onChange: () => void) {
  const query = window.matchMedia(motionPreference);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export default function BuildScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sceneRef);
  const reducedMotion = useSyncExternalStore(subscribeMotionPreference, () => window.matchMedia(motionPreference).matches, () => true);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rotateX = useSpring(0, { stiffness: 75, damping: 22 });
  const rotateY = useSpring(0, { stiffness: 75, damping: 22 });
  const lightX = useSpring(35, { stiffness: 60, damping: 25 });
  const lightY = useSpring(25, { stiffness: 60, damping: 25 });
  const lighting = useMotionTemplate`radial-gradient(circle at ${lightX}% ${lightY}%, #becaff55, transparent 62%)`;
  const still = reducedMotion || paused || !inView;

  function moveScene(event: PointerEvent<HTMLDivElement>) {
    if (still || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    rotateX.set(((event.clientY - bounds.top) / bounds.height - 0.5) * -12);
    rotateY.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 16);
    lightX.set(((event.clientX - bounds.left) / bounds.width) * 100);
    lightY.set(((event.clientY - bounds.top) / bounds.height) * 100);
  }

  function resetScene() {
    rotateX.set(0);
    rotateY.set(0);
    lightX.set(35);
    lightY.set(25);
  }

  return (
    <div
      className={`build-scene ${still ? "scene-still" : ""} ${expanded ? "scene-expanded" : ""}`}
      ref={sceneRef}
      onPointerMove={moveScene}
      onPointerLeave={resetScene}
    >
      <div className="scene-grid" aria-hidden="true" />
      <motion.div className="scene-light" style={{ background: lighting }} aria-hidden="true" />
      <span className="scene-coordinate" aria-hidden="true">
        IDEA → REALITY
      </span>
      <div
        className="scene-perspective"
        role="img"
        aria-label="A floating three-dimensional build kit: a cobalt code cube, a project board, and colorful building blocks."
      >
        <motion.div
          className="scene-objects"
          style={{ rotateX, rotateY }}
          aria-hidden="true"
        >
          <div className="scene-orbit" />
          <div className="scene-orbit scene-orbit-cross" />
          <div className="scene-floor" />
          <div className="code-cube-float">
            <div className="code-cube">
              <div className="cube-face cube-front">
                <Code2 strokeWidth={1.4} />
              </div>
              <div className="cube-face cube-back" />
              <div className="cube-face cube-right">
                <Braces strokeWidth={1.3} />
              </div>
              <div className="cube-face cube-left" />
              <div className="cube-face cube-top">
                <Sparkles strokeWidth={1.1} />
              </div>
              <div className="cube-face cube-bottom" />
              <div className="cube-core"><Zap strokeWidth={1.2} /></div>
            </div>
          </div>
          <div className="scene-sphere" />
          <div className="scene-ring">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="mini-cube">
            <span />
            <span />
            <span />
          </div>
          <div className="scene-board">
            <div className="board-toolbar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <span>your-next-big-idea</span>
              <ArrowUpRight size={15} />
            </div>
            <div className="board-content">
              <span className="board-tag">
                <Zap size={11} /> BUILD MODE: ON
              </span>
              <h3>
                Hello, possibility<span>_</span>
              </h3>
              <div className="board-code">
                <span>const</span> nextBigThing = &#123;
                <br />
                &nbsp; idea: <em>"a little ambitious"</em>,<br />
                &nbsp; team: <em>"all in"</em>,<br />
                &nbsp; possibilities: <strong>Infinity</strong>
                <br />
                &#125;;
              </div>
              <div className="board-bottom">
                <span>
                  <i /> All systems go
                </span>
                <span>⌘ + imagination</span>
              </div>
            </div>
          </div>
          <div className="scene-sticker sticker-team">
            <span className="sticker-icon">
              <Check size={17} />
            </span>
            <div>
              Team assembled<span>Let the good ideas begin.</span>
            </div>
          </div>
          <div className="scene-sticker sticker-idea">
            <Sparkles size={17} />
            <span>One idea. Infinite possibilities.</span>
          </div>
          <span className="scene-star star-one">✳</span>
          <span className="scene-star star-two">+</span>
          <span className="scene-cursor">
            <MousePointer2 size={23} fill="currentColor" />
            <span>you, building cool stuff</span>
          </span>
        </motion.div>
      </div>
      <div className="scene-caption">
        <span>
          <span className="scene-caption-dot" /> {expanded ? "EVERY BIG IDEA HAS LAYERS" : "MOVE YOUR CURSOR. EXPLORE THE KIT."}
        </span>
        <div className="scene-controls">
        <button type="button" className="scene-explore" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Assemble cube" : "Explore cube"}
        </button>
        <button
          type="button"
          aria-label={paused ? "Play 3D animation" : "Pause 3D animation"}
          aria-pressed={paused}
          onClick={() => {
            setPaused(!paused);
            resetScene();
          }}
          disabled={Boolean(reducedMotion)}
        >
          {paused || reducedMotion ? <Play size={13} /> : <Pause size={13} />}
        </button>
        </div>
      </div>
    </div>
  );
}
