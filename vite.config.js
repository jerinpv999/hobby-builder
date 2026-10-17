import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the page runs on :5173 and /api calls go to the server on :3001
export default defineConfig({
  plugins: [react()]
});
