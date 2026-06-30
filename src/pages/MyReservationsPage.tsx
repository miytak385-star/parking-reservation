import { useState, useEffect } from "react";
import {
  Box, Card, CardContent, Typography, Button, Chip,
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
        .sort((a, b) => b.startAt.toMillis() - a.startAt.toMillis()); // 利用開始日の新しい順
      setReservations(data);
    };
    fetchReservations();
  }, [firebaseUser]);

  const handleCancel = async (id: string) => {
    if (!window.confirm("予約をキャンセルしてよろしいですか？")) return;
    await updateDoc(doc(db, "reservations", id), {
      status: "denied",
      updatedAt: Timestamp.now(),
    });
    setReservations((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: "denied" } : r)
    );
  };

  const formatDate = (ts: Timestamp) => dayjs(ts.toDate()).format("YYYY年M月D日 HH:mm");

  const isPast = (endAt: Timestamp) => dayjs(endAt.toDate()).isBefore(dayjs(), "day");

  return (
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
                  <Button size="small" color="error" onClick={() => handleCancel(r.id)}>
                    キャンセル
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export default MyReservationsPage;
