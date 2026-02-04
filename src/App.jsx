import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import JobsList from "./pages/JobsList";
import StageOverview from "./pages/StageOverview";
import StageViewer from "./pages/StageViewer";
import "./components/GlobalLockFab.css";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        <Route path="/jobs" element={<JobsList />} />
        <Route path="/jobs/:jobId" element={<StageOverview />} />
        <Route path="/jobs/:jobId/stage/:stageNo" element={<StageViewer />} />
      </Route>
    </Routes>
  );
}