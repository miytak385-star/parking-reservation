import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Box, Button, TextField, Typography, Alert } from "@mui/material";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    setError("");
    if (!email || !password || !passwordConfirm) {
      setError("すべての項目を入力してください");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email ?? "",
        isAdmin: false,
      });
      navigate("/");
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("email-already-in-use")) {
        setError("このメールアドレスはすでに登録されています");
      } else {
        setError("登録に失敗しました。もう一度お試しください");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 10, gap: 3, px: 2 }}>
      <Typography variant="h5">新規登録</Typography>
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
          label="パスワード（6文字以上）"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          size="small"
        />
        <TextField
          label="パスワード（確認）"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          size="small"
          onKeyDown={(e) => e.key === "Enter" && handleRegister()}
        />
        <Button variant="contained" onClick={handleRegister} disabled={submitting}>
          登録する
        </Button>
        <Typography variant="body2" sx={{ textAlign: "center" }}>
          すでにアカウントをお持ちの方は
          <Link to="/login" style={{ marginLeft: 4 }}>ログイン</Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default RegisterPage;
