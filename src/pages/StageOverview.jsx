import { Link, useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import TopNav from "../components/TopNav";
import {
  useAppState,
  getStageChipState,
  STAGE_DURATION,
  formatElapsedShort,
  formatHrs,
  formatStartedTime,
  formatMinutes,
  CURRENT_USER,
  TECH_COLORS,
} from "../state/AppState";

export default function StageOverview() {
  const { jobId } = useParams();
  const { state } = useAppState();
  const [activeFilter, setActiveFilter] = useState("All");

  const jobStages = state?.stages?.[jobId];

  if (!jobStages) {
    return (
      <>
        <TopNav title={jobId} backTo="/" showReset />
        <div className="content">Job not found.</div>
      </>
    );
  }

  const stages = Object.entries(jobStages)
    .map(([n, s]) => [Number(n), s])
    .sort((a, b) => a[0] - b[0]);

  // Compute stage statistics for banner
  const stats = useMemo(() => {
    const counts = {
      inProgress: 0,
      overdue: 0,
      paused: 0,
      completed: 0,
      notStarted: 0,
      total: 10,
    };

    const activeTechs = new Set();

    stages.forEach(([stageNumber, s]) => {
      const allocated = STAGE_DURATION[stageNumber] ?? s?.allocatedHours ?? 0;
      const allocatedSecs = allocated * 3600;
      const isOverdue = allocatedSecs > 0 && (s?.seconds || 0) > allocatedSecs;

      if (s?.completed) {
        counts.completed++;
      } else if (s?.running) {
        if (isOverdue) counts.overdue++;
        else counts.inProgress++;
        if (s?.owner?.initials) activeTechs.add(s.owner.initials);
      } else if (s?.started) {
        if (isOverdue) counts.overdue++;
        else counts.paused++;
      } else {
        counts.notStarted++;
      }
    });

    return { ...counts, activeTechs: activeTechs.size };
  }, [stages]);

  // Compute stage owners for banner (unique techs who own running/paused/overdue stages)
  const stageOwners = useMemo(() => {
    const ownersMap = new Map();
    
    stages.forEach(([stageNumber, s]) => {
      if (!s?.owner?.initials) return;
      
      const allocated = STAGE_DURATION[stageNumber] ?? s?.allocatedHours ?? 0;
      const allocatedSecs = allocated * 3600;
      const isOverdue = allocatedSecs > 0 && (s?.seconds || 0) > allocatedSecs;
      
      // Include if: running, paused (started but not running), or overdue
      const isActive = s.running || (s.started && !s.completed);
      if (isActive && !ownersMap.has(s.owner.initials)) {
        ownersMap.set(s.owner.initials, {
          initials: s.owner.initials,
          name: s.owner.name,
          firstName: s.owner.name.split(' ')[0],
        });
      }
    });
    
    // Sort alphabetically by first name
    return Array.from(ownersMap.values()).sort((a, b) => 
      a.firstName.localeCompare(b.firstName)
    );
  }, [stages]);

  // Remaining stages = total - completed
  const stagesRemaining = stats.total - stats.completed;

// Filter chips configuration
  const filterChips = [
    { label: "All", key: "All" },
    { label: "My stages", key: "My stages" },
    { label: "In progress", key: "In progress" },
    { label: "Overdue", key: "Overdue" },
    { label: "Paused", key: "Paused" },
    { label: "Not started", key: "Not started" },
    { label: "Completed", key: "Completed" },
  ];// Get stage category for filtering

// Get stage category for filtering
  const getStageCategory = (s, allocated) => {
    const allocatedSecs = allocated * 3600;
    const isOverdue = allocatedSecs > 0 && (s?.seconds || 0) > allocatedSecs;

    if (s?.completed) return "Completed";
    if (s?.running) return isOverdue ? "Overdue" : "In progress";
    if (s?.started) return isOverdue ? "Overdue" : "Paused";
    return "Not started";
  };

  // Check if stage belongs to current user (Chris Quayle)
  const isMyStage = (s) => {
    return s?.owner?.initials === CURRENT_USER.initials;
  };

  // Filter stages based on active filter
  const filteredStages = useMemo(() => {
    if (activeFilter === "All") return stages;

    if (activeFilter === "My stages") {
      return stages.filter(([stageNumber, s]) => {
        if (!isMyStage(s)) return false;
        const allocated = STAGE_DURATION[stageNumber] ?? s?.allocatedHours ?? 0;
        const category = getStageCategory(s, allocated);
        return category === "In progress" || category === "Paused" || category === "Overdue";
      });
    }

    return stages.filter(([stageNumber, s]) => {
      const allocated = STAGE_DURATION[stageNumber] ?? s?.allocatedHours ?? 0;
      return getStageCategory(s, allocated) === activeFilter;
    });
  }, [stages, activeFilter]);

  const chipClass = (chip) => {
    const key = String(chip).toLowerCase().replace(/\s+/g, "");
    if (key === "notstarted") return "so-chip so-chip--notstarted";
    if (key === "inprogress") return "so-chip so-chip--inprogress";
    if (key === "paused") return "so-chip so-chip--paused";
    if (key === "completed") return "so-chip so-chip--completed";
    if (key === "overdue") return "so-chip so-chip--overdue";
    return "so-chip";
  };

  // ✅ Display labels for chip contents
  const chipLabel = (chip) => {
    const key = String(chip).toLowerCase().replace(/\s+/g, "");
    if (key === "inprogress") return "IN PROGRESS";
    if (key === "overdue") return "OVERDUE";
    if (key === "notstarted") return "NOT STARTED";
    if (key === "completed") return "COMPLETED";
    if (key === "paused") return "PAUSED";
    return String(chip).toUpperCase();
  };

  const subline = (s, allocatedHrs) => {
    const secs = s?.seconds || 0;
    if (s?.completed) return `Completed • ${formatElapsedShort(secs)}`;
    if (s?.running) return `In progress • ${formatElapsedShort(secs)}`;
    if (s?.started && !s?.running) return `Paused • ${formatElapsedShort(secs)}`;

    const allocatedSecs = Math.max(1, Math.round((allocatedHrs || 0) * 3600));
    if (s?.started && secs > allocatedSecs) return `Overdue • ${formatElapsedShort(secs)}`;

    return "Not started";
  };

  return (
    <>
      <TopNav title={jobId} backTo="/" showReset />

      <div className="content content--allow-x">
        {/* Stage Owners Banner */}
        <div className="so-banner">
          <div className="so-banner__left">
            <div className="so-banner__title">Stage Owners</div>
            <div className="so-banner__owners">
              <div className="so-banner__avatars">
                {stageOwners.length > 0 ? (
                  stageOwners.slice(0, 3).map((owner, idx) => (
                    <div 
                      key={owner.initials}
                      className="so-banner__avatar"
                      style={{ 
                        backgroundColor: TECH_COLORS[owner.initials] || '#94a3b8',
                        zIndex: 3 - idx,
                        marginLeft: idx > 0 ? '-8px' : '0',
                      }}
                    >
                      <span className="so-banner__avatar-initials">{owner.initials}</span>
                    </div>
                  ))
                ) : (
                  <div className="so-banner__avatar so-banner__avatar--unassigned">
                    <span className="material-icons">person</span>
                  </div>
                )}
              </div>
              <div className="so-banner__names">
                {stageOwners.length > 0 
                  ? stageOwners.map(o => o.firstName).join(', ')
                  : 'Unassigned'
                }
              </div>
            </div>
          </div>
          <div className="so-banner__right">
            <span className="material-icons so-banner__icon">stream</span>
            <div className="so-banner__kpi">
              <div className="so-banner__kpi-value">{stagesRemaining}/{stats.total}</div>
              <div className="so-banner__kpi-label">STAGES REMAINING</div>
            </div>
          </div>
        </div>

       {/* Filter Chips - Horizontal Scroll */}
        <div className="so-filters-wrapper">
          <div className="so-filters">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                className={`so-pill ${activeFilter === chip.key ? "so-pill--active" : ""}`}
                onClick={() => setActiveFilter(chip.key)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="so-filters-fade" />
        </div>

        <div className="so__list">
          {filteredStages.map(([stageNumber, s]) => {
            const allocated = STAGE_DURATION[stageNumber] ?? s?.allocatedHours ?? 0;
            const chip = getStageChipState(s, allocated);

            // Owner display logic
            const hasOwner = s?.owner && s.owner.initials;
            const ownerName = hasOwner ? s.owner.name : "Unassigned";
            const ownerInitials = hasOwner ? s.owner.initials : null;
            const startedTimeStr = s?.startedAt ? formatStartedTime(s.startedAt) : null;
            const elapsedMinStr = formatMinutes(s?.seconds || 0);

            return (
              <Link
                key={`${jobId}-${stageNumber}`}
                to={`/jobs/${jobId}/stage/${stageNumber}`}
                className="so__row"
              >
                <div className="so__left">
                  <div className="so__meta">
                    <div className="so__stageNumber">STAGE {stageNumber}</div>

                    <div className="so__metaRight">
                      <span className="so__allocated">
                        <span className="material-icons so__allocatedIcon">schedule</span>
                        <span className="so__allocatedText">{formatHrs(allocated)}</span>
                      </span>

                      {/* ✅ Chip now displays formatted text */}
                      <span className={chipClass(chip)}>{chipLabel(chip)}</span>
                    </div>
                  </div>

                  <div className="so__titleRow">
                    <div className="so__stageTitle">{s?.name}</div>
                    <div className="so__owner">
                      <span className="so__ownerLabel">{subline(s, allocated)}</span>
                    </div>
                  </div>

                  <div className="so__subRow">
                    <div className="so__ownerRow">
                      {hasOwner ? (
                        <div 
                          className="so__ownerBadge"
                          style={{ backgroundColor: TECH_COLORS[ownerInitials] || '#94a3b8' }}
                        >
                          <span className="so__ownerInitials">{ownerInitials}</span>
                        </div>
                      ) : (
                        <div className="so__ownerIcon so__ownerIcon--unassigned">
                          <span className="material-icons">person</span>
                        </div>
                      )}
                      <div className="so__ownerMeta">
                        <div className="so__ownerName">Owner: {ownerName}</div>
                        {hasOwner && startedTimeStr && (
                          <div className="so__ownerStarted">Started {startedTimeStr}</div>
                        )}
                      </div>
                    </div>

                    <div className="so__cta">
                      <span className="material-icons so__ctaIcon">assignment</span>
                      <span className="material-icons so__ctaChevron">chevron_right</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}