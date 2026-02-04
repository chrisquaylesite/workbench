import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "appState_v1";
const TICK_MS = 1000;

// Current user (prototype)
export const CURRENT_USER = { initials: "CQ", name: "Chris Quayle", kind: "user" };

// Ghost techs for active-shop illusion
const GHOST_TECHS = [
  { initials: "DJ", name: "Dave Jones", kind: "ghost" },
  { initials: "JS", name: "John Smith", kind: "ghost" },
];

// Permanent avatar colors for techs (deterministic by initials)
export const TECH_COLORS = {
  "CQ": "#00BBB4", // Chris Quayle - teal
  "DJ": "#359AE9", // Dave Jones - blue
  "JS": "#F65332", // John Smith - orange/red
};

export const STAGE_DEFS = [
  { id: 1, name: "Pre Scan", allocatedHours: 0.1 },
  { id: 2, name: "Mechanical", allocatedHours: 0.1 },
  { id: 3, name: "Strip", allocatedHours: 0.1 },
  { id: 4, name: "Panel", allocatedHours: 0.1 },
  { id: 5, name: "Paint Prep", allocatedHours: 0.1 },
  { id: 6, name: "Paint", allocatedHours: 0.1 },
  { id: 7, name: "Polish", allocatedHours: 0.1 },
  { id: 8, name: "Refit", allocatedHours: 0.1 },
  { id: 9, name: "Post Scan", allocatedHours: 0.1 },
  { id: 10, name: "Final QC", allocatedHours: 3.0 },
];

export const STAGE_DURATION = STAGE_DEFS.reduce((acc, s) => {
  acc[s.id] = s.allocatedHours;
  return acc;
}, {});

export function formatHrs(hrs) {
  const n = Number(hrs || 0);
  if (Number.isNaN(n)) return "0.0hrs";
  return `${n.toFixed(1)}hrs`;
}

export function formatElapsedShort(seconds = 0) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `0m`;
}

// Format startedAt timestamp to HH:MM
export function formatStartedTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Format seconds to Xm (minutes)
export function formatMinutes(seconds = 0) {
  const m = Math.max(0, Math.floor((Number(seconds) || 0) / 60));
  return `${m}m`;
}

export function getStageChipState(stage) {
  if (!stage) return "notstarted";
  if (stage.completed) return "completed";
  const alloc = Number(stage.allocatedHours ?? 0) * 3600;
  const overdue = alloc > 0 && (stage.seconds || 0) > alloc;
  if (stage.running) return overdue ? "overdue" : "inprogress";
  if (stage.started) return overdue ? "overdue" : "paused";
  return "notstarted";
}

export function getJobStatus(state, jobId) {
  const jobStages = state?.stages?.[jobId];
  if (!jobStages) return { label: "NOT STARTED", icon: "schedule" };
  const stagesArr = Object.values(jobStages);
  const anyRunning = stagesArr.some((s) => s?.running && !s?.completed);
  const anyStarted = stagesArr.some((s) => s?.started);
  const allCompleted = stagesArr.length > 0 && stagesArr.every((s) => s?.completed);
  if (allCompleted) return { label: "COMPLETED", icon: "check_circle" };
  if (anyRunning) return { label: "IN PROGRESS", icon: "play_arrow" };
  if (anyStarted) return { label: "PAUSED", icon: "pause" };
  return { label: "NOT STARTED", icon: "schedule" };
}

// Check if a stage is owned by a ghost tech (not controllable by current user)
export function isGhostOwnedStage(stage) {
  return stage?.owner?.kind === "ghost";
}

// Check if current user can control a stage
// Returns { allowed: true } or { allowed: false, ownerName: string }
export function canUserControlStage(stage) {
  if (!stage?.owner) return { allowed: true }; // Unassigned - anyone can take it
  if (stage.owner.kind === "ghost") {
    return { allowed: false, ownerName: stage.owner.name };
  }
  if (stage.owner.initials === CURRENT_USER.initials) {
    return { allowed: true }; // Current user owns it
  }
  // Owned by another user (not ghost, not current user)
  return { allowed: false, ownerName: stage.owner.name };
}

function makeJobStages() {
  const out = {};
  for (const s of STAGE_DEFS) {
    out[s.id] = {
      name: s.name,
      allocatedHours: s.allocatedHours,
      started: false,
      running: false,
      seconds: 0,
      completed: false,
      startedAt: null,
      completedAt: null,
      owner: null,
    };
  }
  return out;
}

// Seed ghost techs across stages for "active shop" illusion
// CONSTRAINT: Ghosts can ONLY be assigned to stages 1, 2, or 3
function seedGhostTechs(stages) {
  const jobIds = Object.keys(stages);
  if (jobIds.length === 0) return stages;

  const seededStages = { ...stages };
  
  // Pick random stages to assign ghost techs - ONLY stages 1-3 allowed
  const candidates = [];
  for (const jobId of jobIds) {
    // Hard-gate: only stages 1, 2, 3 can have ghost techs
    for (let stageId = 1; stageId <= 3; stageId++) {
      candidates.push({ jobId, stageId });
    }
  }
  
  // Shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  
  // Pick 2-4 stages to seed (reduced since pool is smaller)
  const numToSeed = 2 + Math.floor(Math.random() * 3);
  const toSeed = candidates.slice(0, numToSeed);
  
  // Assign ghost techs with various states
  const states = ["paused", "inprogress", "overdue"];
  
  toSeed.forEach((item, idx) => {
    const ghost = GHOST_TECHS[idx % GHOST_TECHS.length];
    const stateType = states[idx % states.length];
    
    const jobStages = { ...seededStages[item.jobId] };
    const stage = { ...jobStages[item.stageId] };
    
    // Set owner
    stage.owner = { ...ghost };
    stage.started = true;
    stage.startedAt = Date.now() - (Math.floor(Math.random() * 3600) + 600) * 1000; // 10min-1hr ago
    
    if (stateType === "inprogress") {
      stage.running = true;
      stage.seconds = Math.floor(Math.random() * 300) + 60; // 1-6 minutes
    } else if (stateType === "paused") {
      stage.running = false;
      stage.seconds = Math.floor(Math.random() * 200) + 30; // 0.5-4 minutes
    } else if (stateType === "overdue") {
      stage.running = true;
      // Set seconds to exceed allocated time
      const allocSecs = (stage.allocatedHours || 0.1) * 3600;
      stage.seconds = allocSecs + Math.floor(Math.random() * 300) + 60;
    }
    
    jobStages[item.stageId] = stage;
    seededStages[item.jobId] = jobStages;
  });
  
  return seededStages;
}

const INITIAL_STATE = {
  // UI-only coordination state (do NOT persist)
  activeUnlock: null, // legacy; safe to keep
  shiftDrawerOpen: false, // legacy; safe to keep

  // Global lock state (replaces all slider unlocks) - UI-only (do NOT persist)
  uiLocked: true,
  lastInteractionAt: Date.now(),

  shift: {
    status: "OFF",
    workedSeconds: 0,
    startedAt: null,
  },
  stages: seedGhostTechs({
    GY545476788: makeJobStages(),
    GY545476789: makeJobStages(),
    GY545476790: makeJobStages(),
    GY545476791: makeJobStages(),
  }),
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;

    const parsed = JSON.parse(raw);
    const next = {
      ...INITIAL_STATE,
      ...parsed,
      shift: { ...INITIAL_STATE.shift, ...(parsed.shift || {}) },
      stages: { ...(parsed.stages || {}) },
    };

    // Always reset ephemeral UI coordination on load
    next.activeUnlock = null;
    next.shiftDrawerOpen = false;

    next.uiLocked = true;
    next.lastInteractionAt = Date.now();

    for (const jobId of Object.keys(next.stages)) {
      const jobStages = { ...(next.stages[jobId] || {}) };
      for (const s of STAGE_DEFS) {
        if (!jobStages[s.id]) {
          jobStages[s.id] = {
            name: s.name,
            allocatedHours: s.allocatedHours,
            started: false,
            running: false,
            seconds: 0,
            completed: false,
            startedAt: null,
            completedAt: null,
            owner: null,
          };
        } else {
          jobStages[s.id] = {
            name: s.name,
            allocatedHours: s.allocatedHours,
            started: false,
            running: false,
            seconds: 0,
            completed: false,
            startedAt: null,
            completedAt: null,
            owner: null,
            ...jobStages[s.id],
          };
        }
      }
      next.stages[jobId] = jobStages;
    }

    return next;
  } catch {
    return INITIAL_STATE;
  }
}

function saveState(state) {
  try {
    // Do not persist ephemeral UI state
    const { activeUnlock, shiftDrawerOpen, uiLocked, lastInteractionAt, ...persistable } = state || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {}
}

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, setState] = useState(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Track user activity globally (for auto-lock)
  // Only track when unlocked to avoid unnecessary state updates
  useEffect(() => {
    // Don't attach listeners when locked - no point tracking activity
    if (state.uiLocked) return;

    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];
    const onActivity = () => {
      setState((prev) => {
        // Only update if unlocked and enough time has passed (throttle)
        if (prev.uiLocked) return prev;
        const now = Date.now();
        // Throttle: only update if >200ms since last update
        if (now - (prev.lastInteractionAt || 0) < 200) return prev;
        return { ...prev, lastInteractionAt: now };
      });
    };
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, onActivity));
  }, [state.uiLocked]);

  // Auto-timeout back to locked after 30s inactivity (when unlocked)
  useEffect(() => {
    if (state.uiLocked) return;

    const id = setInterval(() => {
      setState((prev) => {
        if (prev.uiLocked) return prev;

        const last = Number(prev.lastInteractionAt || 0);
        const idleMs = Date.now() - last;

        if (idleMs >= 30000) {
          return {
            ...prev,
            uiLocked: true,
            activeUnlock: null,
            shiftDrawerOpen: false,
            lastInteractionAt: Date.now(),
          };
        }
        return prev;
      });
    }, 500);

    return () => clearInterval(id);
  }, [state.uiLocked]);

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        let next = prev;

        if (prev.shift?.status === "ON") {
          next = {
            ...next,
            shift: {
              ...next.shift,
              workedSeconds: (next.shift.workedSeconds || 0) + 1,
            },
          };
        }

        let staged = false;
        const stagesCopy = { ...next.stages };
        for (const jobId of Object.keys(stagesCopy)) {
          const jobStages = stagesCopy[jobId];
          if (!jobStages) continue;
          for (const [sid, s] of Object.entries(jobStages)) {
            if (s?.running && !s?.completed) {
              if (!staged) {
                stagesCopy[jobId] = { ...jobStages };
                staged = true;
              }
              stagesCopy[jobId][sid] = { ...s, seconds: (s.seconds || 0) + 1 };
              next = { ...next, stages: stagesCopy };
              return next;
            }
          }
        }
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  // --- Global UI lock (replaces all slider unlocks) ---
  const setUiLocked = (locked) => {
    setState((prev) => {
      const nextLocked = Boolean(locked);
      const base = { ...prev, uiLocked: nextLocked, lastInteractionAt: Date.now() };

      // When locking: force-close drawer + clear unlock ownership
      if (nextLocked) {
        base.activeUnlock = null;
        base.shiftDrawerOpen = false;
      }

      return base;
    });
  };

  const registerUserInteraction = () => {
    setState((prev) => ({ ...prev, lastInteractionAt: Date.now() }));
  };

  const clockOn = () => {
    setState((prev) => {
      if (prev.uiLocked) return prev;
      if (prev.shift.status === "ON") return prev;
      return {
        ...prev,
        shift: { status: "ON", workedSeconds: prev.shift.workedSeconds || 0, startedAt: Date.now() },
      };
    });
  };

  const pauseShift = () => {
    setState((prev) => {
      if (prev.uiLocked) return prev;
      if (prev.shift.status !== "ON") return prev;
      return { ...prev, shift: { ...prev.shift, status: "PAUSED" } };
    });
  };

  const resumeShift = () => {
    setState((prev) => {
      if (prev.uiLocked) return prev;
      if (prev.shift.status !== "PAUSED") return prev;
      return { ...prev, shift: { ...prev.shift, status: "ON" } };
    });
  };

  const clockOff = () => {
    setState((prev) => {
      if (prev.uiLocked) return prev;
      if (prev.shift.status === "OFF") return prev;
      return {
        ...prev,
        shift: { status: "OFF", workedSeconds: prev.shift.workedSeconds || 0, startedAt: prev.shift.startedAt },
      };
    });
  };

  const canWork = (prev) => prev.shift?.status === "ON";

  // Helper: find currently running stage owned by CURRENT_USER
  // (Used for "switch stage" modal - only triggers when user's own stage is running)
  const findRunningStageOwnedByCurrentUser = (state) => {
    for (const [jobId, jobStages] of Object.entries(state.stages)) {
      for (const [stageId, stage] of Object.entries(jobStages)) {
        if (stage?.running && !stage?.completed) {
          // Only return if owned by current user (not ghost, not other user)
          if (stage.owner?.initials === CURRENT_USER.initials) {
            return {
              jobId,
              stageId: Number(stageId),
              name: stage.name,
            };
          }
        }
      }
    }
    return null;
  };

  // Global stage start with conflict detection
  const safeStartStageGlobal = (jobId, stageId) => {
    let result = { ok: true, message: "" };
    setState((prev) => {
      if (prev.uiLocked) {
        result = { ok: false, message: "Controls are locked (READ ONLY)." };
        return prev;
      }

      const jobStages = prev.stages?.[jobId];
      const stage = jobStages?.[stageId];

      if (!jobStages || !stage) {
        result = { ok: false, message: "Stage not found." };
        return prev;
      }

      // OWNERSHIP CHECK: Block if ghost owns this stage
      if (stage.owner?.kind === "ghost") {
        result = { 
          ok: false, 
          code: "GHOST_OWNED",
          message: `Locked – ${stage.owner.name} is working on this stage.` 
        };
        return prev;
      }

      if (!canWork(prev)) {
        result = { ok: false, message: "Clock on to start or sign off stages." };
        return prev;
      }

      if (stage.completed) {
        result = { ok: false, message: "This stage is already signed off and can't be started again." };
        return prev;
      }

      // Check for other running stages owned by CURRENT_USER (for switch modal)
      const runningStage = findRunningStageOwnedByCurrentUser(prev);
      if (runningStage && !(runningStage.jobId === jobId && runningStage.stageId === stageId)) {
        result = {
          ok: false,
          code: "OTHER_RUNNING",
          running: runningStage,
        };
        return prev;
      }

      // Safe to start - pause any other stages in this job and start the requested one
      const nextJob = { ...jobStages };
      for (const [sid, s] of Object.entries(nextJob)) {
        if (Number(sid) === Number(stageId)) continue;
        if (s?.running) nextJob[sid] = { ...s, running: false };
      }
      
      // Set owner to current user if not already assigned
      const newOwner = stage.owner ?? { ...CURRENT_USER };
      const newStartedAt = stage.startedAt ?? Date.now();
      
      nextJob[stageId] = { 
        ...stage, 
        started: true, 
        running: true, 
        startedAt: newStartedAt,
        owner: newOwner,
      };

      return { ...prev, stages: { ...prev.stages, [jobId]: nextJob } };
    });
    return result;
  };

  // Atomic: pause global running stage and start new one
  const pauseRunningStageGlobalAndStart = (jobId, stageId) => {
    let result = { ok: true, message: "" };
    setState((prev) => {
      if (prev.uiLocked) {
        result = { ok: false, message: "Controls are locked (READ ONLY)." };
        return prev;
      }

      const jobStages = prev.stages?.[jobId];
      const stage = jobStages?.[stageId];

      if (!jobStages || !stage) {
        result = { ok: false, message: "Stage not found." };
        return prev;
      }

      // OWNERSHIP CHECK: Block if ghost owns the target stage
      if (stage.owner?.kind === "ghost") {
        result = { 
          ok: false, 
          code: "GHOST_OWNED",
          message: `Locked – ${stage.owner.name} is working on this stage.` 
        };
        return prev;
      }

      if (!canWork(prev)) {
        result = { ok: false, message: "Clock on to start or sign off stages." };
        return prev;
      }

      if (stage.completed) {
        result = { ok: false, message: "This stage is already signed off and can't be started again." };
        return prev;
      }

      // Find and pause any running stage globally (only if owned by current user)
      const nextStages = { ...prev.stages };
      for (const [jId, jStages] of Object.entries(nextStages)) {
        const nextJobStages = { ...jStages };
        let jobChanged = false;
        for (const [sId, s] of Object.entries(nextJobStages)) {
          if (s?.running && !s?.completed) {
            // Only pause if current user owns it (don't touch ghost stages)
            if (s.owner?.kind !== "ghost") {
              nextJobStages[sId] = { ...s, running: false };
              jobChanged = true;
            }
          }
        }
        if (jobChanged) {
          nextStages[jId] = nextJobStages;
        }
      }

      // Start the new stage - set owner to current user if not already assigned
      const targetJobStages = { ...nextStages[jobId] };
      const newOwner = stage.owner ?? { ...CURRENT_USER };
      const newStartedAt = stage.startedAt ?? Date.now();
      
      targetJobStages[stageId] = { 
        ...stage, 
        started: true, 
        running: true, 
        startedAt: newStartedAt,
        owner: newOwner,
      };
      nextStages[jobId] = targetJobStages;

      return { ...prev, stages: nextStages };
    });
    return result;
  };

  const safePauseStage = (jobId, stageId) => {
    let result = { ok: true, message: "" };
    setState((prev) => {
      if (prev.uiLocked) {
        result = { ok: false, message: "Controls are locked (READ ONLY)." };
        return prev;
      }

      const jobStages = prev.stages?.[jobId];
      const stage = jobStages?.[stageId];
      if (!jobStages || !stage) {
        result = { ok: false, message: "Stage not found." };
        return prev;
      }

      // OWNERSHIP CHECK: Block if ghost owns this stage
      if (stage.owner?.kind === "ghost") {
        result = { 
          ok: false, 
          code: "GHOST_OWNED",
          message: `Locked – ${stage.owner.name} is working on this stage.` 
        };
        return prev;
      }

      if (!stage.running) {
        result = { ok: false, message: "Stage is not running." };
        return prev;
      }
      const nextJob = { ...jobStages, [stageId]: { ...stage, running: false } };
      return { ...prev, stages: { ...prev.stages, [jobId]: nextJob } };
    });
    return result;
  };

  const safeCompleteStage = (jobId, stageId) => {
    let result = { ok: true, message: "" };
    setState((prev) => {
      if (prev.uiLocked) {
        result = { ok: false, message: "Controls are locked (READ ONLY)." };
        return prev;
      }

      const jobStages = prev.stages?.[jobId];
      const stage = jobStages?.[stageId];
      if (!jobStages || !stage) {
        result = { ok: false, message: "Stage not found." };
        return prev;
      }

      // OWNERSHIP CHECK: Block if ghost owns this stage
      if (stage.owner?.kind === "ghost") {
        result = { 
          ok: false, 
          code: "GHOST_OWNED",
          message: `Locked – ${stage.owner.name} is working on this stage.` 
        };
        return prev;
      }

      if (!canWork(prev)) {
        result = { ok: false, message: "Clock on to start or sign off stages." };
        return prev;
      }
      if (!stage.started) {
        result = { ok: false, message: "Start the stage before signing off." };
        return prev;
      }
      if (stage.completed) {
        result = { ok: false, message: "This stage is already signed off and can't be started again." };
        return prev;
      }
      const nextJob = {
        ...jobStages,
        [stageId]: { ...stage, running: false, completed: true, completedAt: Date.now() },
      };
      return { ...prev, stages: { ...prev.stages, [jobId]: nextJob } };
    });
    return result;
  };

  // --- Mutual exclusivity + drawer coordination (legacy; safe to keep) ---
  const setActiveUnlock = (owner) => {
    setState((prev) => {
      if (prev.activeUnlock === owner) return prev;
      return { ...prev, activeUnlock: owner };
    });
  };

  const releaseActiveUnlock = (owner) => {
    setState((prev) => {
      if (prev.activeUnlock !== owner) return prev;
      return { ...prev, activeUnlock: null };
    });
  };

  const setShiftDrawerOpen = (isOpen) => {
    setState((prev) => {
      if (prev.shiftDrawerOpen === isOpen) return prev;
      return { ...prev, shiftDrawerOpen: isOpen };
    });
  };

  const resetState = () => {
    localStorage.removeItem(STORAGE_KEY);
    // Create fresh state with ghost tech seeding
    const freshState = {
      ...INITIAL_STATE,
      stages: seedGhostTechs({
        GY545476788: makeJobStages(),
        GY545476789: makeJobStages(),
        GY545476790: makeJobStages(),
        GY545476791: makeJobStages(),
      }),
    };
    setState(freshState);
  };

  const value = useMemo(
    () => ({
      state,
      setState,

      // global lock
      setUiLocked,
      registerUserInteraction,

      clockOn,
      pauseShift,
      resumeShift,
      clockOff,

      safeStartStage: safeStartStageGlobal,
      safeStartStageGlobal,
      pauseRunningStageGlobalAndStart,
      safePauseStage,
      safeCompleteStage,

      // coordination (legacy; safe to keep)
      setActiveUnlock,
      releaseActiveUnlock,
      setShiftDrawerOpen,

      resetState,
    }),
    [state]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}