import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { collection, getDocs, query, where } from "firebase/firestore";
import dayjs from "dayjs";
import { db } from "../firebase";
import type { Reservation, SpaceId } from "../types";

const SPACES: { id: SpaceId; label: string }[] = [
  { id: "A", label: "区画A（普通車）" },
  { id: "B", label: "区画B（普通車）" },
  { id: "C", label: "区画C（軽自動車）" },
];

const SelectSpacePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const date = location.state?.date as string | undefined;

  // スペースごとの予約時間帯リスト
  const [reservedTimes, setReservedTimes] = useState<Record<SpaceId, string[]>>({
    A: [], B: [], C: [], ALL: [],
  });

  useEffect(() => {
    if (!date) return;

    const fetchReservations = async () => {
      const q = query(
        collection(db, "reservations"),
        where("status", "in", ["pending", "approved"]),
      );
      const snap = await getDocs(q);
      const result: Record<SpaceId, string[]> = { A: [], B: [], C: [], ALL: [] };

      snap.docs.forEach((doc) => {
        const r = doc.data() as Reservation;
        const start = dayjs(r.startAt.toDate());
        const end = dayjs(r.endAt.toDate());
        const target = dayjs(date);

        // その日に時間帯が被っているか判定
        const overlaps = target.isSame(start, "day") || target.isSame(end, "day") ||
          (target.isAfter(start, "day") && target.isBefore(end, "day"));

        if (overlaps) {
          result[r.spaceId].push(`${start.format("HH:mm")}〜${end.format("HH:mm")}`);
        }
      });

      setReservedTimes(result);
    };

    fetchReservations();
  }, [date]);

  // 日付未指定、または過去日なら予約画面に進ませない
  if (!date || dayjs(date).isBefore(dayjs(), "day")) {
    navigate("/");
    return null;
  }

  const handleSelect = (spaceId: SpaceId) => {
    navigate("/reserve", { state: { date, spaceId } });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 6, gap: 2 }}>
      <Typography variant="h6">{date} のスペース選択</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        ご利用するスペースを選択してください
      </Typography>
      {SPACES.map((space) => (
        <Box key={space.id} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
          <Button
            variant="outlined"
            sx={{ width: 240 }}
            onClick={() => handleSelect(space.id)}
          >
            {space.label}
          </Button>
          {reservedTimes[space.id].length > 0 ? (
            reservedTimes[space.id].map((time, i) => (
              <Typography key={i} variant="caption" sx={{ color: "error.main" }}>
                予約済み：{time}
              </Typography>
            ))
          ) : (
            <Typography variant="caption" sx={{ color: "success.main" }}>空き</Typography>
          )}
        </Box>
      ))}
      <Button variant="text" onClick={() => navigate("/")}>
        カレンダーに戻る
      </Button>
    </Box>
  );
};

export default SelectSpacePage;
