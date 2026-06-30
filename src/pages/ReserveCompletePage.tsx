import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

const ReserveCompletePage = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 10, gap: 3 }}>
      <Typography variant="h6">申請が完了しました</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        管理人が確認後、承認・否認の通知をお送りします。
      </Typography>
      <Box sx={{ display: "flex", gap: 2 }}>
        <Button variant="outlined" onClick={() => navigate("/my-reservations")}>マイ予約を見る</Button>
        <Button variant="contained" onClick={() => navigate("/")}>ホームへ戻る</Button>
      </Box>
    </Box>
  );
};

export default ReserveCompletePage;
