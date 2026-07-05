import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { collection, addDoc, getDocs, getDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import {
  Box, Button, Chip, MenuItem, Select, Typography,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Snackbar, Alert, ThemeProvider, createTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import type { Reservation, ReservationStatus } from "../types";

// 管理画面専用テーマ（ブルーグレー）
const adminTheme = createTheme({
  palette: {
    primary: { main: "#546e7a" },
    secondary: { main: "#78909c" },
    background: { default: "#eceff1", paper: "#ffffff" },
  },
  typography: {
    fontFamily: "'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif",
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: "none", fontWeight: 500 },
      },
    },
  },
});

// ステータスの表示ラベルと色
const STATUS_LABEL: Record<ReservationStatus, { label: string; color: "warning" | "success" | "error" }> = {
  pending:  { label: "承認待ち", color: "warning" },
  approved: { label: "承認済み", color: "success" },
  denied:   { label: "否認",     color: "error" },
};

const SPACE_LABEL: Record<string, string> = {
  A: "区画A（普通車）",
  B: "区画B（普通車）",
  C: "区画C（軽自動車）",
};

type FilterStatus = ReservationStatus | "all";
type ActionType = "approve" | "deny";

const formatDate = (ts: Timestamp) => dayjs(ts.toDate()).format("M/D HH:mm");

// handleApprove/handleDeny を受け取って columns を生成する関数
// renderCell 内でイベントハンドラを直接定義できないため、クロージャで受け渡す
const buildColumns = (
  handleApprove: (id: string) => void,
  handleDeny: (id: string) => void,
): GridColDef[] => [
  {
    field: "period",
    headerName: "利用日時",
    width: 200,
    sortable: false,
    // startAt/endAt を結合して表示（valueGetter で計算値を返す）
    valueGetter: (_value: unknown, row: Reservation) =>
      `${formatDate(row.startAt)} 〜 ${formatDate(row.endAt)}`,
  },
  {
    field: "spaceId",
    headerName: "スペース",
    width: 160,
    valueGetter: (_value: unknown, row: Reservation) => SPACE_LABEL[row.spaceId] ?? row.spaceId,
  },
  { field: "name",       headerName: "氏名",     width: 120 },
  { field: "roomNumber", headerName: "部屋番号", width: 100 },
  {
    field: "status",
    headerName: "ステータス",
    width: 130,
    // Chip で色付き表示
    renderCell: (params) => {
      const s = STATUS_LABEL[params.value as ReservationStatus];
      return <Chip label={s.label} color={s.color} size="small" />;
    },
  },
  {
    field: "actions",
    headerName: "操作",
    width: 160,
    sortable: false,
    // pending のみ承認・否認ボタンを表示
    renderCell: (params) => {
      if (params.row.status !== "pending") return null;
      return (
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" variant="contained" onClick={() => handleApprove(params.row.id)}>
            承認
          </Button>
          <Button size="small" variant="outlined" color="error" onClick={() => handleDeny(params.row.id)}>
            否認
          </Button>
        </Box>
      );
    },
  },
];

const AdminPage = () => {
  const { firebaseUser, appUser, loading } = useAuth();
  const location = useLocation();
  const [unauthorized, setUnauthorized] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  // 承認・否認の確認ダイアログ用 state
  const [confirm, setConfirm] = useState<{ open: boolean; id: string; action: ActionType } | null>(null);
  // 処理結果の Snackbar 通知用 state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false, message: "", severity: "success",
  });

  useEffect(() => {
    if (loading) return;

    // 管理者でない場合はアクセスを拒否し、Firestore にログを残す
    if (!appUser?.isAdmin) {
      setUnauthorized(true);
      addDoc(collection(db, "logs"), {
        uid: firebaseUser?.uid ?? null,
        path: location.pathname,
        reason: "unauthorized_access",
        createdAt: Timestamp.now(),
      });
      return;
    }

    // 全予約を取得し、pending 優先・利用開始日の新しい順にソート
    const fetchReservations = async () => {
      const snap = await getDocs(collection(db, "reservations"));
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Reservation))
        .sort((a, b) => {
          if (a.status === "pending" && b.status !== "pending") return -1;
          if (a.status !== "pending" && b.status === "pending") return 1;
          return b.startAt.toMillis() - a.startAt.toMillis();
        });
      setReservations(data);
    };
    fetchReservations();
  }, [loading, appUser, firebaseUser, location.pathname]);

  // 承認・否認時に住民へメール通知（mail コレクションに addDoc → Firebase Extensions が送信）
  const sendMailNotification = async (reservation: Reservation, status: "approved" | "denied") => {
    const userSnap = await getDoc(doc(db, "users", reservation.userId));
    if (!userSnap.exists()) return;
    const email = userSnap.data().email as string;
    const statusLabel = status === "approved" ? "承認" : "否認";
    const period = `${formatDate(reservation.startAt)} 〜 ${formatDate(reservation.endAt)}`;
    const space = SPACE_LABEL[reservation.spaceId] ?? reservation.spaceId;
    await addDoc(collection(db, "mail"), {
      to: email,
      message: {
        subject: `【駐車スペース予約】予約が${statusLabel}されました`,
        text: `${reservation.name} 様\n\n以下の予約が${statusLabel}されました。\n\n利用日時：${period}\nスペース：${space}\n\n駐車スペース予約システム`,
      },
    });
  };

  // 承認・否認ボタン押下 → 確認ダイアログを開く
  const handleApprove = (id: string) => {
    setConfirm({ open: true, id, action: "approve" });
  };

  const handleDeny = (id: string) => {
    setConfirm({ open: true, id, action: "deny" });
  };

  // 確認ダイアログで「実行」を押したとき
  const handleConfirm = async () => {
    if (!confirm) return;
    const { id, action } = confirm;
    setConfirm(null);

    const reservation = reservations.find((r) => r.id === id);
    if (!reservation) return;

    const newStatus = action === "approve" ? "approved" : "denied";
    try {
      await updateDoc(doc(db, "reservations", id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      // 楽観的更新：Firestore の再取得なしにローカル state を即時反映
      setReservations((prev) =>
        prev.map((r) => r.id === id ? { ...r, status: newStatus } : r)
      );
      await sendMailNotification(reservation, newStatus);
      setSnackbar({ open: true, message: action === "approve" ? "承認しました" : "否認しました", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "処理に失敗しました。もう一度お試しください。", severity: "error" });
    }
  };

  if (loading) return null;

  if (unauthorized) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <Typography color="error">不正な操作です。</Typography>
      </Box>
    );
  }

  const filtered = filter === "all"
    ? reservations
    : reservations.filter((r) => r.status === filter);

  return (
    <ThemeProvider theme={adminTheme}>
      <Box sx={{ maxWidth: 900, mx: "auto", mt: 4, px: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6">予約管理</Typography>
          <Select
            size="small"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterStatus)}
          >
            <MenuItem value="all">全件</MenuItem>
            <MenuItem value="pending">承認待ち</MenuItem>
            <MenuItem value="approved">承認済み</MenuItem>
            <MenuItem value="denied">否認</MenuItem>
          </Select>
        </Box>
        <DataGrid
          rows={filtered}
          columns={buildColumns(handleApprove, handleDeny)}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </Box>

      {/* 承認・否認確認ダイアログ */}
      <Dialog open={!!confirm?.open} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm?.action === "approve" ? "承認の確認" : "否認の確認"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm?.action === "approve" ? "この予約を承認しますか？" : "この予約を否認しますか？"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>キャンセル</Button>
          <Button
            variant="contained"
            color={confirm?.action === "approve" ? "primary" : "error"}
            onClick={handleConfirm}
          >
            {confirm?.action === "approve" ? "承認する" : "否認する"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 処理結果通知 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default AdminPage;
