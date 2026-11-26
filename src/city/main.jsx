import { createRoot } from "react-dom/client";
import CityBuilder from "./CityBuilder.jsx";
import { loadHobbyModels } from "../hobbyModels";

const root = document.getElementById("root");
root.textContent = "Loading models…";

// imported Hobby Builder creations should use the same detailed pieces as the builder
loadHobbyModels().then(() => {
  root.textContent = "";
  createRoot(root).render(<CityBuilder />);
});
