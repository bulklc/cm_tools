import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import AppNavbar from "./components/Navbar";

import EquipmentOverview from "./pages/cm-tools/equipment/EquipmentOverview";

import "./App.css";

function App() {
  return (
    <Router>
      <AppNavbar />
      <main className="page-container">
        <Routes>
          {/* CM Tools — Equipment Overview (only page) */}
          <Route path="/" element={<EquipmentOverview />} />
          <Route
            path="/cm-tools/equipment-overview"
            element={<EquipmentOverview />}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
