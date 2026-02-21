import React from "react";
import Member4Dashboard from "./features/member4/views/Member4Dashboard";

export default function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Aura Hackathon Console</p>
        <h1>Member 4 Task Runner</h1>
        <p className="subtitle">
          Run scraping, cleaning, and demo-data flows from one simple screen.
        </p>
      </header>
      <Member4Dashboard />
    </main>
  );
}
