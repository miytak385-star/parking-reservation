import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

const LoginPage = () => {
  const navigate = useNavigate();

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    navigate("/");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 10, gap: 3 }}>
      <Typography variant="h5">駐車スペース予約システム</Typography>
      <Button variant="contained" onClick={handleLogin}>
        Googleでログイン
      </Button>
    </Box>
  );
};

export default LoginPage;
