import React from "react";
import { Outlet } from "react-router-dom";
import ShiftDrawer from "./ShiftDrawer";
import GlobalLockFab from "./GlobalLockFab";

export default function AppShell() {
  return (
    <div className="screen">
      <Outlet />
      <ShiftDrawer />
      <GlobalLockFab />
    </div>
  );
}