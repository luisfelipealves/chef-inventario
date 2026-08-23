import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { getRouter } from "./router";
import { inicializarTema } from "./lib/tema";
import "./lib/i18n";
import "./styles.css";

inicializarTema();

const router = getRouter();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
