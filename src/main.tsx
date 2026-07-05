import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import "dayjs/locale/ja";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import NavBar from "./components/NavBar";

const theme = createTheme({
  palette: {
    primary: { main: "#3d6b4f" },       // 深緑
    secondary: { main: "#c9a84c" },     // ゴールド
    background: { default: "#f7f4ee", paper: "#ffffff" }, // 温かみのあるオフホワイト
  },
  typography: {
    fontFamily: "'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif",
    h6: { fontWeight: 500, letterSpacing: "0.05em" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: "none", fontWeight: 500 },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { "& .MuiOutlinedInput-root": { borderRadius: 8 } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ja">
          <AuthProvider>
            <NavBar />
            <App />
          </AuthProvider>
        </LocalizationProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
