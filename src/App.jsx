import { useState } from 'react'
import reactLogo from './assets/react.svg'
import hobbyBuilderLogo from '/hobby-builder.svg'
import './App.css'

import HobbyBuilder from "./HobbyBuilder";

export default function App() {
  return (
    <>
      <HobbyBuilder />
      <nav style={{ position: "fixed", right: 12, bottom: 66, zIndex: 50, display: "flex", gap: 6, font: "13px system-ui" }}>
        {[["Home", ""], ["🏙️ City builder", "city.html"]].map(([label, href]) => (
          <a key={label} href={`${import.meta.env.BASE_URL}${href}`} style={{ padding: "6px 12px", borderRadius: 8, background: "#1c2230", color: "#fff", textDecoration: "none", opacity: 0.9 }}>{label}</a>
        ))}
      </nav>
    </>
  );
}
