import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const NavBar = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/login") return null;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <AppBar position="static">
      <Toolbar sx={{ gap: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1, cursor: "pointer" }} onClick={() => navigate("/")}>
          駐車スペース予約
        </Typography>
        <Button color="inherit" onClick={() => navigate("/")}>ホーム</Button>
        <Button color="inherit" onClick={() => navigate("/my-reservations")}>マイ予約</Button>
        {appUser?.isAdmin && (
          <Button color="inherit" onClick={() => navigate("/admin")}>管理画面</Button>
        )}
        <Button color="inherit" onClick={handleLogout}>ログアウト</Button>
      </Toolbar>
    </AppBar>
  );
};

export default NavBar;
