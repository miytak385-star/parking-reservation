import { useState, useEffect } from "react";
import {
  Box, Button, Card, CardContent, Chip, Typography,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from "@mui/material";
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import type { Reservation } from "../types";

const STATUS_LABEL: Record<string, { label: string; color: "warning" | "success" | "error" }> = {
  pending:  { label: "承認待ち", color: "warning" },
  approved: { label: "承認済み", color: "success" },
  denied:   { label: "否認",     color: "error" },
};

const SPACE_LABEL: Record<string, string> = {
  A: "区画A（普通車）",
  B: "区画B（普通車）",
  C: "区画C（軽自動車）",
};

const MyReservationsPage = () => {
  const { firebaseUser } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const fetchReservations = async () => {
      const q = query(
        collection(db, "reservations"),
        where("userId", "==", firebaseUser.uid),
      );
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Reservation))
        .sort((a, b) => b.startAt.toMillis() - a.startAt.toMillis());
      setReservations(data);
    };
    fetchReservations();
  }, [firebaseUser]);

  const handleCancelConfirm = async () => {
    if (!cancelTargetId) return;
    await updateDoc(doc(db, "reservations", cancelTargetId), {
      status: "denied",
      updatedAt: Timestamp.now(),
    });
    setReservations((prev) =>
      prev.map((r) => r.id === cancelTargetId ? { ...r, status: "denied" } : r)
    );
    setCancelTargetId(null);
  };

  const formatDate = (ts: Timestamp) => dayjs(ts.toDate()).format("YYYY年M月D日 HH:mm");
  const isPast = (endAt: Timestamp) => dayjs(endAt.toDate()).isBefore(dayjs(), "day");

  return (
    <>
      <Box sx={{ maxWidth: 560, mx: "auto", mt: 4, px: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>マイ予約</Typography>
        {reservations.length === 0 && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>予約はありません</Typography>
        )}
        {reservations.map((r) => {
          const status = STATUS_LABEL[r.status];
          const past = isPast(r.endAt);
          return (
            <Card key={r.id} sx={{ mb: 2, ...(past && { backgroundColor: "grey.300" }) }}>
              <CardContent>
                <Typography variant="body2">
                  {formatDate(r.startAt)} 〜 {formatDate(r.endAt)}
                </Typography>
                <Typography variant="body2">スペース：{SPACE_LABEL[r.spaceId]}</Typography>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1 }}>
                  <Chip label={status.label} color={status.color} size="small" />
                  {r.status === "pending" && (
                    <Button size="small" color="error" onClick={() => setCancelTargetId(r.id)}>
                      キャンセル
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* キャンセル確認ダイアログ */}
      <Dialog open={!!cancelTargetId} onClose={() => setCancelTargetId(null)}>
        <DialogTitle>キャンセルの確認</DialogTitle>
        <DialogContent>
          <DialogContentText>予約をキャンセルしてよろしいですか？</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelTargetId(null)}>戻る</Button>
          <Button variant="contained" color="error" onClick={handleCancelConfirm}>キャンセルする</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MyReservationsPage;
