import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/themes.css";
import "./styles/global.css";
import { App } from "./App";
import "./stores/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
