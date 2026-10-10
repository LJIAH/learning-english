import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./assets/base.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("[web-react] 未找到 #root 挂载点，请检查 index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
