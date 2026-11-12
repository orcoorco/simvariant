import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

console.log(
  "%c\n  ███████╗██╗███╗   ███╗\n  ██╔════╝██║████╗ ████║   SimVariant\n  ███████╗██║██╔████╔██║   Barnhusgatan 20, sedan 1906\n  ╚════██║██║██║╚██╔╝██║\n  ███████║██║██║ ╚═╝ ██║   Psst – kaffemaskinen gillar inte att bli petad på.\n  ╚══════╝╚═╝╚═╝     ╚═╝   Fem gånger, typ. Och ↑↑↓↓←→←→BA.\n",
  "color:#ff7a59;font-family:monospace",
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
