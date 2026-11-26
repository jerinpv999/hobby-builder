import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the page runs on :5173 and /api calls go to the server on :3001
export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/, set by the deploy workflow
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: "index.html", builder: "builder.html", city: "city.html" }
    }
  }
});
