import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAppState } from "../state/AppState";

export default function TopNav({ avatarSrc = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const { resetState } = useAppState();

  const isRoot = location.pathname === "/";

  const title = useMemo(() => {
    const { jobId, stageNo } = params;

    if (isRoot) return "Workbench";
    if (jobId && stageNo) return jobId;
    if (jobId) return jobId;

    return "Workbench";
  }, [params, isRoot]);

  const handleBack = () => navigate(-1);

  const handleReset = () => {
    resetState();
    navigate("/");
  };

  return (
    <header className="header">
      {!isRoot ? (
        <button className="nav-back" onClick={handleBack} aria-label="Back">
          <span className="material-icons">arrow_back</span>
        </button>
      ) : (
        <div style={{ width: 40, height: 40 }} />
      )}

      {avatarSrc && (
        <img 
          src={avatarSrc} 
          alt="" 
          className="topnav-avatar"
          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginRight: 12 }}
        />
      )}

      <span className="job-id">{title}</span>

      <button
        className="nav-reset"
        onClick={handleReset}
        aria-label="Reset data"
        style={{ marginLeft: "auto" }}
      >
        <span className="material-icons">restart_alt</span>
      </button>
    </header>
  );
}