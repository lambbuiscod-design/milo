import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MiloRenderer } from "./components/MiloRenderer";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("MILO_RENDERER_ROOT_MISSING");

createRoot(root).render(
  <StrictMode>
    <MiloRenderer />
  </StrictMode>,
);
