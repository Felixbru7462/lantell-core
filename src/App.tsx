import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { PMDashboard } from "./modules/core/PMDashboard";
import { VendorDashboard } from './modules/vendors/VendorDashboard';
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { PMOnboarding } from "./pages/onboarding/PMOnboarding";
import { VendorOnboarding } from "./pages/onboarding/VendorOnboarding";
import { InvitePage } from "./pages/InvitePage";
import { DevPanel } from "./components/DevPanel";

function App() {
  return (
    <Router>
      <div style={{ backgroundColor: '#FAF9F7', minHeight: '100vh' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/onboarding/pm" element={<PMOnboarding />} />
          <Route path="/onboarding/vendor" element={<VendorOnboarding />} />
          <Route path="/pm" element={<PMDashboard />} />
          <Route path="/vendor" element={<VendorDashboard />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        <DevPanel />
      </div>
    </Router>
  );
}

export default App;