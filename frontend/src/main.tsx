import React from "react";
import ReactDOM from "react-dom/client";
import AdminApp from "./AdminApp";
import App from "./App";
import "./styles.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const appPath = basePath && window.location.pathname.startsWith(basePath)
  ? window.location.pathname.slice(basePath.length) || "/"
  : window.location.pathname;
const RootApp = appPath.startsWith("/admin") ? AdminApp : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
