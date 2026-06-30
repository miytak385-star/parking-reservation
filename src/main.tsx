import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/ja";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import NavBar from "./components/NavBar";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ja">
        <AuthProvider>
          <NavBar />
          <App />
        </AuthProvider>
      </LocalizationProvider>
    </BrowserRouter>
  </StrictMode>
);
