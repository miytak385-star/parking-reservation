import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from "firebase/auth";
import {
  Box, Button, Divider, TextField, Typography, Alert,
} from "@mui/material";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    navigate("/");
  };

  const handleEmailLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch {
      setError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 10, gap: 3, px: 2 }}>
      <Typography variant="h5">駐車スペース予約システム</Typography>

      {/* メール/パスワードログイン */}
      <Box sx={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="メールアドレス"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          size="small"
        />
        <TextField
          label="パスワード"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          size="small"
          onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
        />
        <Button variant="contained" onClick={handleEmailLogin} disabled={submitting}>
          ログイン
        </Button>
        <Typography variant="body2" sx={{ textAlign: "center" }}>
          アカウントをお持ちでない方は
          <Link to="/register" style={{ marginLeft: 4 }}>新規登録</Link>
        </Typography>
      </Box>

      <Divider sx={{ width: "100%", maxWidth: 360 }}>または</Divider>

      <Button variant="outlined" onClick={handleGoogleLogin}>
        Googleでログイン
      </Button>
    </Box>
  );
};

export default LoginPage;
