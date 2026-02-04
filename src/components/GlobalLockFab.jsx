import { useEffect, useRef, useCallback, useState } from "react";
import { useAppState } from "../state/AppState";

/**
 * GlobalLockFab - Floating action button for global UI lock/unlock
 *
 * UNLOCK: Long-press (500ms) with progress ring animation
 * LOCK: Simple tap when unlocked
 *
 * Icon swap requirement:
 * - When the ring completes, icon swaps to lock_open immediately
 * - Swap is subtle (quick scale+fade, “modern app” feel)
 */

const LONG_PRESS_DURATION = 500; // ms

export default function GlobalLockFab() {
  const ctx = useAppState();

  const uiLocked = ctx.state?.uiLocked ?? true;
  const setUiLocked = ctx.setUiLocked || (() => {});
  const registerUserInteraction = ctx.registerUserInteraction || (() => {});

  // Local visual helpers (for instant icon swap on ring completion)
  const [optimisticUnlocked, setOptimisticUnlocked] = useState(!uiLocked);
  const [swapAnim, setSwapAnim] = useState(false);

  useEffect(() => {
    setOptimisticUnlocked(!uiLocked);
  }, [uiLocked]);

  const triggerSwapAnim = useCallback(() => {
    setSwapAnim(true);
    window.setTimeout(() => setSwapAnim(false), 180);
  }, []);

  // Progress ring refs
  const progressElementRef = useRef(null);
  const animationFrameRef = useRef(null);
  const pressStartRef = useRef(null);
  const isPressingRef = useRef(false);

  // SVG ring dimensions
  const SIZE = 64;
  const STROKE_WIDTH = 4;
  const RADIUS = (SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const updateProgressRing = useCallback(
    (progress) => {
      if (!progressElementRef.current) return;
      const offset = CIRCUMFERENCE * (1 - progress);
      progressElementRef.current.style.strokeDashoffset = String(offset);
    },
    [CIRCUMFERENCE]
  );

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const resetProgress = useCallback(() => {
    pressStartRef.current = null;
    isPressingRef.current = false;
    stopAnimation();
    updateProgressRing(0);
  }, [stopAnimation, updateProgressRing]);

  const completeUnlock = useCallback(() => {
    // Stop animation and reset immediately
    isPressingRef.current = false;
    stopAnimation();
    updateProgressRing(0);
    
    // Instant visual swap
    setOptimisticUnlocked(true);
    triggerSwapAnim();

    // Unlock immediately - no delays
    setUiLocked(false);
    registerUserInteraction();
  }, [setUiLocked, registerUserInteraction, updateProgressRing, triggerSwapAnim, stopAnimation]);

  const animateProgress = useCallback(() => {
    if (!isPressingRef.current || !pressStartRef.current) return;

    const elapsed = Date.now() - pressStartRef.current;
    const progress = Math.min(1, elapsed / LONG_PRESS_DURATION);

    updateProgressRing(progress);

    if (progress >= 1) {
      completeUnlock();
      return;
    }

    animationFrameRef.current = requestAnimationFrame(animateProgress);
  }, [updateProgressRing, stopAnimation, completeUnlock]);

  const handlePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      registerUserInteraction();

      // If already unlocked, do nothing here; lock happens on pointer up.
      if (!uiLocked) return;

      // Begin long-press
      isPressingRef.current = true;
      pressStartRef.current = Date.now();
      stopAnimation();
      animationFrameRef.current = requestAnimationFrame(animateProgress);
    },
    [uiLocked, animateProgress, stopAnimation, registerUserInteraction]
  );

  const handlePointerUp = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      registerUserInteraction();

      if (!uiLocked) {
        // Tap to lock immediately when unlocked (also do subtle swap)
        setOptimisticUnlocked(false);
        triggerSwapAnim();
        setUiLocked(true);
        return;
      }

      // Locked: releasing early cancels unlock attempt
      resetProgress();
    },
    [uiLocked, setUiLocked, resetProgress, registerUserInteraction, triggerSwapAnim]
  );

  const handlePointerCancel = useCallback(() => {
    resetProgress();
  }, [resetProgress]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  // Visual state (optimistic swaps instantly when ring completes)
  const visuallyUnlocked = optimisticUnlocked || !uiLocked;
  const lockedClass = visuallyUnlocked ? "global-lock-fab--unlocked" : "global-lock-fab--locked";
  const icon = visuallyUnlocked ? "lock_open" : "lock";

  return (
    <button
      className={`global-lock-fab ${lockedClass}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      onContextMenu={handleContextMenu}
      aria-label={uiLocked ? "Hold to unlock controls" : "Tap to lock controls"}
      style={{ touchAction: "none" }}
    >
      {/* Progress ring */}
      <svg className="global-lock-fab__progress" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          ref={progressElementRef}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#ffffff"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: "none" }}
        />
      </svg>

      {/* Icon (subtle modern swap when unlock completes) */}
      <span className={`global-lock-fab__icon material-icons ${swapAnim ? "global-lock-fab__icon--swap" : ""}`}>
        {icon}
      </span>
    </button>
  );
}