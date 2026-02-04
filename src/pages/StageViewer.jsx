import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useAppState,
  getJobStatus,
  getStageChipState,
  STAGE_DURATION,
  formatHrs,
  formatStartedTime,
  formatMinutes,
  isGhostOwnedStage,
  TECH_COLORS,
} from "../state/AppState.jsx";
import TopNav from "../components/TopNav.jsx";
import "../App.css";

const JOBS = [
  {
    id: "GY545476788",
    img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=60",
  },
  {
    id: "GY545476789", 
    img: "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=600&q=60",
  },
  {
    id: "GY545476790",
    img: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=600&q=60",
  },
  {
    id: "GY545476791",
    img: "https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=600&q=60",
  },
];




export default function StageViewer() {
  const navigate = useNavigate();
  const { jobId, stageNo } = useParams();
  const ctx = useAppState();

  // Global UI lock state
  const uiLocked = ctx.state?.uiLocked ?? true;

  // Drawer-open rule (shift drawer takes priority over stage controls)
  const shiftDrawerOpen = ctx.state?.shiftDrawerOpen ?? false;

  const sid = Number(stageNo);
  const jobStages = ctx.state?.stages?.[jobId];
  const stage = jobStages?.[sid];

  

  const shiftStatus = ctx.state?.shift?.status || "OFF";

  const [taskOpen, setTaskOpen] = useState(true);
  const [tasks, setTasks] = useState([
    { id: 1, text: "Connect Diagnostic tool and perform pre-repair scan.", done: true },
    { id: 2, text: "Take pre-repair photos and upload to job file.", done: false },
    { id: 3, text: "Confirm parts and labour are authorised.", done: false },
    { id: 4, text: "Mark vehicle location on lot.", done: false },
  ]);

  const [partsOpen, setPartsOpen] = useState(false);
  const parts = useMemo(
    () => [
      { id: 1, name: "Front bumper clips", qty: 6, status: "Ordered" },
      { id: 2, name: "Primer (grey)", qty: 1, status: "In stock" },
    ],
    []
  );

  const [modal, setModal] = useState(null);
  const closeModal = () => setModal(null);

  // Small "settle" guard to prevent accidental taps right after navigation
  const [controlsReady, setControlsReady] = useState(true);
  const settleTimerRef = useRef(null);

  // Completion animation tracking - lifted to parent so it persists
  const [completionAnimProgress, setCompletionAnimProgress] = useState({});
  const prevCompletedRef = useRef({});
  
  // Track completion state changes and trigger animations
  useEffect(() => {
    if (!jobStages) return;
    
    Object.entries(jobStages).forEach(([stageId, stageData]) => {
      const wasCompleted = prevCompletedRef.current[stageId];
      const isCompleted = stageData?.completed;
      
      if (isCompleted && !wasCompleted) {
        // Stage just completed - trigger animation after brief delay
        setTimeout(() => {
          setCompletionAnimProgress(prev => ({ ...prev, [stageId]: 1 }));
        }, 100);
      }
      
      prevCompletedRef.current[stageId] = isCompleted;
    });
  }, [jobStages]);

  // --- Carousel refs ---
  const carouselRef = useRef(null);
  const trackRef = useRef(null);
  const widthRef = useRef(0);
  const navAnimRef = useRef(null);

  // --- Swipe refs (no React state updates during drag) ---
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    dx: 0,
    dy: 0,
    locked: false,
  });
  const rafRef = useRef(null);

  const navKey = `${jobId}-${stageNo}`;

  const measureWidth = () => {
    const el = carouselRef.current;
    if (!el) return 0;
    const w = el.getBoundingClientRect().width || el.offsetWidth || 0;
    widthRef.current = w;
    return w;
  };

  const setTrackX = (xPx, animate = false) => {
    const track = trackRef.current;
    if (!track) return;

    track.style.transition = animate
      ? "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)"
      : "none";
    track.style.transform = `translate3d(${xPx}px, 0, 0)`;
  };

  // Reset local UI + re-center carousel on stage/job change
  useEffect(() => {
    setModal(null);

    setControlsReady(false);
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => setControlsReady(true), 100);

    const w = measureWidth();
    setTrackX(-w, false);

    return () => clearTimeout(settleTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey]);

  // Keep widthRef in sync on resize; re-center if needed
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const sync = () => {
      // Never touch transform while dragging
      if (dragRef.current.active) return;
      const w = measureWidth();
      setTrackX(-w, false);
    };

    sync();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        // Only update width ref, don't move track during drag
        measureWidth();
        if (!dragRef.current.active) {
          setTrackX(-widthRef.current, false);
        }
      });
      ro.observe(el);
    } else {
      window.addEventListener("resize", sync);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", sync);
    };
  }, []);

  // Swipe handlers (pointer events) attached to the carousel container only
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    // Interactive target check - buttons and inputs that should not trigger swipe
    // Also include the global lock FAB
    const isInteractiveTarget = (target) =>
      !!target?.closest?.(
        '.btn-pause, .btn-signoff, .shift-drawer, .global-lock-fab, button, input, a, label'
      );

    const cancelRaf = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    const scheduleApply = () => {
      cancelRaf();
      rafRef.current = requestAnimationFrame(() => {
        const d = dragRef.current;
        // Safety: only apply if we're actively dragging
        if (!d.active) return;

        const w = d.startWidth; // Use width captured at drag start
        if (!w) return;

        let appliedDx = d.dx;

        // Hard stop at boundaries
        if (sid === 1 && appliedDx > 0) appliedDx = 0;
        if (sid === 10 && appliedDx < 0) appliedDx = 0;

        setTrackX(-w + appliedDx, false);
      });
    };

    const onPointerDown = (e) => {
      // Ignore if modal is open
      if (modal) return;

      // Critical: completely ignore if starting on interactive element
      if (isInteractiveTarget(e.target)) return;

      // Only handle primary button / touch
      if (e.button !== 0 && e.pointerType === "mouse") return;

      const w = measureWidth();
      if (!w) return;

      dragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: w, // Capture width at start
        dx: 0,
        dy: 0,
        locked: false,
      };

      try {
        el.setPointerCapture(e.pointerId);
      } catch {}

      el.classList.add("is-dragging");
      // Don't call scheduleApply here — wait for first move
    };

    const onPointerMove = (e) => {
      const d = dragRef.current;

      // Must have active drag AND matching pointer — bail immediately if not
      if (!d.active || d.pointerId !== e.pointerId) return;

      const newDx = e.clientX - d.startX;
      const newDy = e.clientY - d.startY;

      d.dx = newDx;
      d.dy = newDy;

      // Decide intent once: horizontal swipe vs vertical scroll
      if (!d.locked) {
        const ax = Math.abs(newDx);
        const ay = Math.abs(newDy);

        if (ax > 8 && ax > ay * 1.2) {
          // Horizontal swipe confirmed
          d.locked = true;
        } else if (ay > 10 && ay > ax * 1.2) {
          // Vertical scroll — abort swipe entirely
          d.active = false;
          el.classList.remove("is-dragging");
          cancelRaf();
          setTrackX(-d.startWidth, true);
          try {
            el.releasePointerCapture(e.pointerId);
          } catch {}
          return;
        }
      }

      if (d.locked) {
        e.preventDefault();
        scheduleApply();
      }
    };

    const finishDrag = (e) => {
      const d = dragRef.current;
      if (!d.active) return;
      if (d.pointerId !== e.pointerId) return;

      d.active = false;
      el.classList.remove("is-dragging");
      cancelRaf();

      const w = d.startWidth;
      const dx = d.dx;

      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}

      // If never locked horizontally, just snap back
      if (!d.locked) {
        setTrackX(-w, true);
        return;
      }

      const threshold = Math.max(60, w * 0.22);

      // swipe LEFT (negative dx) => next stage
      // swipe RIGHT (positive dx) => previous stage
      const wantsNext = dx < -threshold && sid < 10;
      const wantsPrev = dx > threshold && sid > 1;

      if (wantsNext) {
        // Animate to -2w then navigate
        setTrackX(-2 * w, true);
        clearTimeout(navAnimRef.current);
        navAnimRef.current = setTimeout(() => {
          navigate(`/jobs/${jobId}/stage/${sid + 1}`, { replace: true });
        }, 240);
      } else if (wantsPrev) {
        // Animate to 0 then navigate
        setTrackX(0, true);
        clearTimeout(navAnimRef.current);
        navAnimRef.current = setTimeout(() => {
          navigate(`/jobs/${jobId}/stage/${sid - 1}`, { replace: true });
        }, 240);
      } else {
        // Snap back to center
        setTrackX(-w, true);
      }
    };

    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", finishDrag, { passive: true });
    el.addEventListener("pointercancel", finishDrag, { passive: true });

    return () => {
      clearTimeout(navAnimRef.current);
      cancelRaf();
      dragRef.current.active = false;
      el.classList.remove("is-dragging");
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finishDrag);
      el.removeEventListener("pointercancel", finishDrag);
    };
  }, [jobId, sid, stageNo, navigate, modal]);

  if (!stage) {
    return (
      <>
        <TopNav title={jobId || ""} onBack={() => navigate(-1)} />
        <div className="content" style={{ padding: 16 }}>
          Stage not found.
        </div>
      </>
    );
  }

  const R = 96;
  const C = 2 * Math.PI * R;

  const chipState = getStageChipState(stage);

  // Status text for display
  const chipText =
    chipState === "inprogress"
      ? "IN PROGRESS"
      : chipState === "paused"
      ? "PAUSED"
      : chipState === "completed"
      ? "COMPLETED"
      : chipState === "overdue"
      ? "OVERDUE"
      : "NOT STARTED";

  const formatMMSS = (secs = 0) => {
    const s = Math.max(0, Number(secs) || 0);
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  };

  const toggleTask = (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const onStart = () => {
    if (!controlsReady || uiLocked) return;

    const res = ctx.safeStartStageGlobal?.(jobId, sid);
    if (!res?.ok) {
      if (res.code === "OTHER_RUNNING") {
        setModal({
          type: "switchStage",
          running: res.running,
          nextStage: { jobId, stageId: sid, name: stage.name },
        });
      } else {
        setModal({ title: "Action blocked", body: res?.message || "You can't start this stage right now." });
      }
    }
  };

  const onPause = () => {
    if (!controlsReady || uiLocked) return;

    const res = ctx.safePauseStage?.(jobId, sid);
    if (!res?.ok) setModal({ title: "Action blocked", body: res?.message || "You can't pause this stage right now." });
  };

  const onSignOff = () => {
    if (!controlsReady || uiLocked) return;

    const res = ctx.safeCompleteStage?.(jobId, sid);
    if (!res?.ok) setModal({ title: "Action blocked", body: res?.message || "You can't sign off this stage right now." });
  };

  const handleSwitchConfirm = () => {
    if (!modal?.nextStage || uiLocked) return;

    const res = ctx.pauseRunningStageGlobalAndStart?.(modal.nextStage.jobId, modal.nextStage.stageId);
    if (!res?.ok) {
      setModal({ title: "Action blocked", body: res?.message || "Unable to switch stages." });
    } else {
      setModal(null);
    }
  };

  // Shift must be ON to control stages (existing rule)
  const shiftLocked = shiftStatus !== "ON";

  // For previews (previous/next stage) — null at boundaries to prevent duplicate ghost
  const prevSid = sid > 1 ? sid - 1 : null;
  const nextSid = sid < 10 ? sid + 1 : null;
  const prevStage = prevSid ? jobStages?.[prevSid] : null;
  const nextStage = nextSid ? jobStages?.[nextSid] : null;

  // StageContent component for rendering each panel
  const StageContent = ({ stageId, stageData, isPreview }) => {
    if (!stageData) return null;

    const allocH = stageData.allocatedHours ?? STAGE_DURATION[stageId] ?? 0.1;
    const allocS = allocH * 3600;
    const prog = allocS > 0 ? Math.min(1, (stageData.seconds || 0) / allocS) : 0;

    const cs = getStageChipState(stageData);
    const completed = cs === "completed";
    
    // Color: green when completed, red when overdue, blue otherwise
    const rc = completed ? "#178920" : cs === "overdue" ? "#d3302f" : "#0b5cab";
    
    // Use parent-level animation tracking for smooth completion animation
    // If completion animation has been triggered, use that value; otherwise use current progress
    const animatedValue = completionAnimProgress[stageId];
    const dp = completed ? (animatedValue !== undefined ? animatedValue : prog) : prog;
    const off = C * (1 - dp);

    // Status text for this stage
    const statusText =
      cs === "inprogress"
        ? "IN PROGRESS"
        : cs === "paused"
        ? "PAUSED"
        : cs === "completed"
        ? "COMPLETED"
        : cs === "overdue"
        ? "OVERDUE"
        : "NOT STARTED";

    // Determine what to show in the timer icon
    const timerIcon = completed 
      ? "check" 
      : uiLocked 
      ? "lock" 
      : stageData.running 
      ? "pause" 
      : "play_arrow";

    // Owner display logic
    const hasOwner = stageData.owner && stageData.owner.initials;
    const ownerName = hasOwner ? stageData.owner.name : "Unassigned";
    const ownerInitials = hasOwner ? stageData.owner.initials : null;
    const startedTimeStr = stageData.startedAt ? formatStartedTime(stageData.startedAt) : null;
    const elapsedMinStr = formatMinutes(stageData.seconds || 0);

    return (
      <div className={`stage-panel-content${isPreview ? " is-preview" : ""}`}>
        <div className="stage-bar">
          <div className="stage-label">
            <div className="stage-number">STAGE {stageId}</div>
            <div className="stage-name">{stageData.name}</div>
          </div>

          <div className="stage-meta">
            <div className="allocated">
              <span className="material-icons">schedule</span>
              {formatHrs(allocH)}
            </div>

            <div className={`status-chip ${cs === "inprogress" ? "in-progress" : cs}`}>
              {cs === "inprogress" && <span className="live-dot" />}
              {statusText}
            </div>
          </div>
        </div>

        <div className="timer-section">
          <div className="owner-row">
            {hasOwner ? (
              <div 
                className="owner-badge"
                style={{ backgroundColor: TECH_COLORS[ownerInitials] || '#94a3b8' }}
              >
                <span className="owner-initials">{ownerInitials}</span>
              </div>
            ) : (
              <div className="owner-icon unassigned">
                <span className="material-icons">person</span>
              </div>
            )}
            <div className="owner-meta">
              <div className="owner-text">
                <span className="owner-strong">Owner:</span> {ownerName}
              </div>
              {hasOwner && startedTimeStr && (
                <div className="owner-started">
                  Started {startedTimeStr} • {elapsedMinStr}
                </div>
              )}
            </div>
          </div>

          <div className="timer-container">
            <svg className="progress-ring" width="220" height="220">
              {/* Background ring */}
              <circle cx="110" cy="110" r={R} stroke="#d9dde3" strokeWidth="10" fill="none" />
              {/* Progress ring */}
              <circle
                cx="110"
                cy="110"
                r={R}
                stroke={rc}
                strokeWidth="10"
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={`${C} ${C}`}
                strokeDashoffset={off}
                transform="rotate(-90 110 110)"
                style={{ transition: "stroke-dashoffset 1200ms ease-out, stroke 400ms ease" }}
              />
            </svg>

            <div className="timer-inner">
              <div className="timer-icon">
                <span className="material-icons">{timerIcon}</span>
              </div>
            </div>

            {/* Progress knob - positioned outside SVG for z-index control */}
            <div
              className="progress-knob"
              style={{
                position: 'absolute',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: rc,
                border: '3px solid #fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                left: `${110 + R * Math.cos(2 * Math.PI * dp - Math.PI / 2)}px`,
                top: `${110 + R * Math.sin(2 * Math.PI * dp - Math.PI / 2)}px`,
                transform: 'translate(-50%, -50%)',
                transition: 'left 1200ms ease-out, top 1200ms ease-out, background-color 400ms ease',
                zIndex: 10,
              }}
            />
          </div>

          <div className={`time-display ${cs === "overdue" ? "overdue" : ""}`}>
            {formatMMSS(stageData.seconds || 0)}
          </div>
        </div>

        {!isPreview && (
          <>
            <div className="actions">
              {/* GHOST-OWNED: Show locked banner with owner name */}
              {isGhostOwnedStage(stageData) ? (
                <div className="stage-status-banner">
                  LOCKED – {stageData.owner.name} is working
                </div>
              ) : /* LOCKED MODE: Show status with "- READ ONLY" suffix */
              uiLocked ? (
                <div className="stage-status-banner">
                  {statusText} – READ ONLY
                </div>
              ) : completed ? (
                <div className="stage-status-banner">STAGE COMPLETE</div>
              ) : shiftLocked ? (
                <div className="stage-status-banner">CLOCK ON TO CONTROL STAGES</div>
              ) : shiftDrawerOpen ? (
                <div className="stage-status-banner">
                  {(getJobStatus(ctx.state, jobId)?.label || "NOT STARTED").toUpperCase()}
                </div>
              ) : !controlsReady ? (
                <div className="stage-status-banner">{statusText}</div>
              ) : (
                /* UNLOCKED MODE: Show action buttons */
                <>
                  <button className="btn-pause" onClick={stageData.running ? onPause : onStart}>
                    <span className="material-icons">{stageData.running ? "pause" : "play_arrow"}</span>
                    {stageData.running ? "PAUSE" : "START"}
                  </button>
                  <button className="btn-signoff" onClick={onSignOff}>
                    <span className="material-icons">check</span>
                    SIGN-OFF
                  </button>
                </>
              )}
            </div>

            <div className="task-section">
              <button className="task-header" onClick={() => setTaskOpen((v) => !v)}>
                <div className="task-title">
                  <div className="task-title-text">Task List</div>
                  <div className="task-count">
                    {tasks.filter((t) => t.done).length}/{tasks.length} TASKS COMPLETE
                  </div>
                </div>
                <span className={`material-icons chevron ${taskOpen ? "open" : ""}`}>expand_more</span>
              </button>

              {taskOpen && (
                <ul className="task-list">
                  {tasks.map((t) => (
                    <li key={t.id} className="task-item">
                      <label className="task-checkbox">
                        <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                        <span className={`checkmark ${t.done ? "checked" : ""}`}>
                          {t.done && (
                            <span className="material-icons" style={{ color: "#fff", fontSize: 18 }}>
                              check
                            </span>
                          )}
                        </span>
                        <span className={`task-text ${t.done ? "completed" : ""}`}>{t.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="task-section">
              <button className="task-header" onClick={() => setPartsOpen((v) => !v)}>
                <div className="task-title">
                  <div className="task-title-text">Parts List</div>
                  <div className="task-count">{parts.length} ITEMS</div>
                </div>
                <span className={`material-icons chevron ${partsOpen ? "open" : ""}`}>expand_more</span>
              </button>

              {partsOpen && (
                <ul className="task-list">
                  {parts.map((p) => (
                    <li key={p.id} className="task-item">
                      <div className="task-checkbox" style={{ cursor: "default" }}>
                        <span className="task-text">
                          <span className="owner-strong">{p.name}</span> • Qty {p.qty} • {p.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <TopNav title={jobId} onBack={() => navigate(-1)} />

      <div className="stage-carousel" ref={carouselRef}>
        <div className="stage-track" ref={trackRef}>
          <div className="stage-panel">
            {prevStage && <StageContent stageId={prevSid} stageData={prevStage} isPreview />}
          </div>

          <div className="stage-panel">
            <StageContent stageId={sid} stageData={stage} isPreview={false} />
          </div>

          <div className="stage-panel">
            {nextStage && <StageContent stageId={nextSid} stageData={nextStage} isPreview />}
          </div>
        </div>
      </div>

      {modal && modal.type === "switchStage" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Switch active stage?</div>
              <button className="modal-close" onClick={closeModal} aria-label="Close">
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              You're currently working on {modal.running?.name} (Job {modal.running?.jobId}). To start{" "}
              {modal.nextStage?.name} (Job {modal.nextStage?.jobId}), we'll pause your current stage.
            </div>
            <div className="modal-actions">
              <button className="modal-btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button className="modal-btn-primary" onClick={handleSwitchConfirm}>
                Pause & start
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && modal.type !== "switchStage" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal.title}</div>
              <button className="modal-close" onClick={closeModal} aria-label="Close">
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">{modal.body}</div>
            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={closeModal}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}