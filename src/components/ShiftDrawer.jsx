import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../state/AppState";

export default function ShiftDrawer() {
  const ctx = useAppState();

  const { state } = ctx;
  const uiLocked = state?.uiLocked ?? true;

  const clockOn = ctx.clockOn || (() => {});
  const pauseShift = ctx.pauseShift || (() => {});
  const resumeShift = ctx.resumeShift || (() => {});
  const clockOff = ctx.clockOff || (() => {});

  const shift = state?.shift || { status: "OFF", workedSeconds: 0 };
  const stages = state?.stages || {};

  /**
   * Drawer geometry (keep consistent with CSS)
   */
  const SHEET_HEIGHT = 160;
  const PEEK_HEIGHT = 80;
  const MAX_TRANSLATE = SHEET_HEIGHT - PEEK_HEIGHT;

  const [open, setOpen] = useState(false);
  const [translateY, setTranslateY] = useState(MAX_TRANSLATE);
  const [dragging, setDragging] = useState(false);

  // Sync local open state to global shiftDrawerOpen
  const setShiftDrawerOpen = ctx.setShiftDrawerOpen || (() => {});
  useEffect(() => {
    setShiftDrawerOpen(open);
  }, [open, setShiftDrawerOpen]);

  // When app locks: force-close drawer immediately (non-negotiable)
  useEffect(() => {
    if (!uiLocked) return;
    setOpen(false);
    setDragging(false);
    setTranslateY(MAX_TRANSLATE);
  }, [uiLocked, MAX_TRANSLATE]);

  // Keep translateY in sync with open state when NOT dragging
  useEffect(() => {
    if (dragging) return;
    setTranslateY(open ? 0 : MAX_TRANSLATE);
  }, [open, dragging, MAX_TRANSLATE]);

  const anyStageRunning = useMemo(() => {
    try {
      return Object.values(stages).some((jobStages) =>
        Object.values(jobStages).some((s) => s?.running && !s?.completed)
      );
    } catch {
      return false;
    }
  }, [stages]);

  const formatTime = (secs = 0) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Drag refs
  const startYRef = useRef(0);
  const startTranslateRef = useRef(MAX_TRANSLATE);
  const movedRef = useRef(false);
  const rafRef = useRef(null);
  const pendingTranslateRef = useRef(MAX_TRANSLATE);
  const pointerIdRef = useRef(null);

  const commitTranslate = (v) => {
    pendingTranslateRef.current = v;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setTranslateY(pendingTranslateRef.current);
    });
  };

  // Track interaction for auto-lock timer
  const touch = ctx.registerUserInteraction || (() => {});
  const touchAnd = (fn) => () => {
    touch();
    fn();
  };

  const startDrag = (e) => {
    // LOCKED: drawer must not open or drag at all
    if (uiLocked) return;

    if (e.pointerType === "mouse" && e.button !== 0) return;

    movedRef.current = false;
    setDragging(true);
    startYRef.current = e.clientY;
    startTranslateRef.current = translateY;
    pointerIdRef.current = e.pointerId;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const moveDrag = (e) => {
    if (uiLocked) return;
    if (!dragging) return;
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;

    const dy = e.clientY - startYRef.current;
    if (Math.abs(dy) > 6) movedRef.current = true;

    const next = clamp(startTranslateRef.current + dy, 0, MAX_TRANSLATE);
    commitTranslate(next);
  };

  const endDrag = () => {
    if (uiLocked) return;
    if (!dragging) return;

    setDragging(false);
    pointerIdRef.current = null;

    // Tap toggles
    if (!movedRef.current) {
      setOpen((v) => !v);
      return;
    }

    // Drag snaps
    const threshold = MAX_TRANSLATE * 0.5;
    const shouldOpen = pendingTranslateRef.current < threshold;

    setOpen(shouldOpen);
    setTranslateY(shouldOpen ? 0 : MAX_TRANSLATE);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onPauseShift = () => {
    if (uiLocked) return;
    pauseShift();
  };

  const leftLabel = shift.status === "OFF" ? "SHIFT OFF" : "STARTED";
  const leftValue = shift.status === "OFF" ? "--:--" : formatTime(shift.workedSeconds);

  const rightLabel = shift.status === "ON" ? "CLOCKED ON" : shift.status === "PAUSED" ? "PAUSED" : "OFF";

  return (
    <div
      className={`shift-drawer ${open ? "open" : "closed"} ${dragging ? "dragging" : ""} ${
        uiLocked ? "shift-drawer--locked" : ""
      }`}
      style={{
        height: `${SHEET_HEIGHT}px`,
        transform: `translateY(${translateY}px)`,
        transition: dragging ? "none" : "transform 220ms ease",
        willChange: "transform",
      }}
    >
      {/* Handle */}
      <div
        className="shift-drawer-handle"
        onPointerDown={(e) => {
          touch();
          startDrag(e);
        }}
        onPointerMove={(e) => {
          touch();
          moveDrag(e);
        }}
        onPointerUp={(e) => {
          touch();
          endDrag(e);
        }}
        onPointerCancel={(e) => {
          touch();
          endDrag(e);
        }}
        style={{ touchAction: "none" }}
      >
        <div className="shift-drawer-grab" />
      </div>

      {/* Collapsed strip */}
      <div
        className="shift-drawer-collapsed"
        onPointerDown={(e) => {
          touch();
          startDrag(e);
        }}
        onPointerMove={(e) => {
          touch();
          moveDrag(e);
        }}
        onPointerUp={(e) => {
          touch();
          endDrag(e);
        }}
        onPointerCancel={(e) => {
          touch();
          endDrag(e);
        }}
        style={{ touchAction: "none" }}
      >
        <div className="shift-kpi">
          <span className="material-icons">schedule</span>
          <div className="shift-kpi-text">
            <div className="shift-kpi-title">{leftLabel}</div>
            <div className="shift-kpi-value">{leftValue}</div>
          </div>
        </div>

        <div className="shift-kpi shift-kpi-right">
          <span className="material-icons">person</span>
          <div className="shift-kpi-text">
            <div className="shift-kpi-title">{rightLabel}</div>
            <div className="shift-kpi-value">{shift.status}</div>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      <div className="shift-drawer-expanded">
        {/* LOCKED: show nothing actionable (drawer can't open anyway) */}
        {uiLocked ? null : (
          <div className="shift-actions">
            {shift.status === "OFF" && (
              <button className="btn-pause resumed" onClick={touchAnd(clockOn)}>
                <span className="material-icons">login</span>
                CLOCK ON
              </button>
            )}

            {shift.status === "ON" && (
              <>
                <button className="btn-pause" onClick={touchAnd(onPauseShift)}>
                  <span className="material-icons">pause</span>
                  PAUSE SHIFT
                </button>
                <button className="btn-signoff" onClick={touchAnd(clockOff)}>
                  <span className="material-icons">logout</span>
                  CLOCK OFF
                </button>
              </>
            )}

            {shift.status === "PAUSED" && (
              <>
                <button className="btn-pause resumed" onClick={touchAnd(resumeShift)}>
                  <span className="material-icons">play_arrow</span>
                  RESUME SHIFT
                </button>
                <button className="btn-signoff" onClick={touchAnd(clockOff)}>
                  <span className="material-icons">logout</span>
                  CLOCK OFF
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}