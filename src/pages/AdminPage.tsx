import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { collection, addDoc, getDocs, getDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { Box, Button, Chip, MenuItem, Select, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import type { Reservation, ReservationStatus } from "../types";

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

const formatDate = (ts: Timestamp) => dayjs(ts.toDate()).format("M/D HH:mm");

// handleApprove/handleDeny を受け取って columns を生成する関数
const buildColumns = (
  handleApprove: (id: string) => void,
  handleDeny: (id: string) => void,
): GridColDef[] => [
  {
    field: "period",
    headerName: "利用日時",
    width: 200,
    sortable: false,
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

  useEffect(() => {
    if (loading) return;

    // 管理者でない場合はアクセスを拒否し、ログを残す
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

    const fetchReservations = async () => {
      const snap = await getDocs(collection(db, "reservations"));
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Reservation))
        .sort((a, b) => {
          // pending を先頭に、同一ステータス内は利用開始日の新しい順
          if (a.status === "pending" && b.status !== "pending") return -1;
          if (a.status !== "pending" && b.status === "pending") return 1;
          return b.startAt.toMillis() - a.startAt.toMillis();
        });
      setReservations(data);
    };
    fetchReservations();
  }, [loading, appUser, firebaseUser, location.pathname]);

  const sendMailNotification = async (reservation: Reservation, status: "approved" | "denied") => {
    // users コレクションから住民のメールアドレスを取得
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

  const handleApprove = async (id: string) => {
    if (!window.confirm("この予約を承認しますか？")) return;
    const reservation = reservations.find((r) => r.id === id);
    if (!reservation) return;
    await updateDoc(doc(db, "reservations", id), {
      status: "approved",
      updatedAt: Timestamp.now(),
    });
    setReservations((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: "approved" } : r)
    );
    await sendMailNotification(reservation, "approved");
  };

  const handleDeny = async (id: string) => {
    if (!window.confirm("この予約を否認しますか？")) return;
    const reservation = reservations.find((r) => r.id === id);
    if (!reservation) return;
    await updateDoc(doc(db, "reservations", id), {
      status: "denied",
      updatedAt: Timestamp.now(),
    });
    setReservations((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: "denied" } : r)
    );
    await sendMailNotification(reservation, "denied");
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
  );
};

export default AdminPage;
