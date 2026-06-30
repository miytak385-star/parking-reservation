import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickerDay } from "@mui/x-date-pickers";
import type { PickerDayProps } from "@mui/x-date-pickers";
import { Box, Button, Typography } from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { db } from "../firebase";
import type { Space, Reservation, SpaceId } from "../types";

type DayStatus = Record<SpaceId, boolean>; // true = 予約済み
type MonthStatus = Record<string, DayStatus>; // key = "YYYY-MM-DD"

const SPACE_IDS: SpaceId[] = ["A", "B", "C"];

const calcMonthStatus = (reservations: Reservation[], month: Dayjs): MonthStatus => {
  const status: MonthStatus = {};
  const daysInMonth = month.daysInMonth();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = month.date(d);
    const key = date.format("YYYY-MM-DD");
    const dayStatus = {} as DayStatus;

    for (const spaceId of SPACE_IDS) {
      const reserved = reservations.some((r) => {
        if (r.spaceId !== spaceId) return false;
        if (r.status === "denied") return false;
        const start = dayjs(r.startAt.toDate());
        const end = dayjs(r.endAt.toDate());
        return date.isSame(start, "day") || date.isSame(end, "day") ||
          (date.isAfter(start, "day") && date.isBefore(end, "day"));
      });
      dayStatus[spaceId] = reserved;
    }
    status[key] = dayStatus;
  }
  return status;
};

const getDayColor = (dayStatus: DayStatus | undefined): string => {
  if (!dayStatus) return "transparent";
  const reservedCount = Object.values(dayStatus).filter(Boolean).length;
  if (reservedCount === 0) return "#c8e6c9"; // 緑：全スペース空き
  if (reservedCount < SPACE_IDS.length) return "#fff9c4"; // 黄：一部空き
  return "#e0e0e0"; // 灰：全スペース満車
};

const getTooltipText = (dayStatus: DayStatus | undefined): string => {
  if (!dayStatus) return "";
  return SPACE_IDS.map((id) => `区画${id} ${dayStatus[id] ? "満車" : "空き"}`).join("／");
};

// カスタム日付セルコンポーネント
const StyledDay = (monthStatus: MonthStatus) =>
  function CustomDay(props: PickerDayProps) {
    const { day, ...other } = props;
    const key = day.format("YYYY-MM-DD");
    const isPast = day.isBefore(dayjs(), "day");
    const bgColor = isPast ? "transparent" : getDayColor(monthStatus[key]);

    return (
      <PickerDay
        {...other}
        day={day}
        disabled={other.disabled || isPast} // 過去日はクリック不可
        sx={{ backgroundColor: bgColor, borderRadius: "50%" }}
      />
    );
  };

const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());
  const [monthStatus, setMonthStatus] = useState<MonthStatus>({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSpaces = async () => {
      const snap = await getDocs(collection(db, "spaces"));
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Space));
      setSpaces(data);
    };
    fetchSpaces();
  }, []);

  useEffect(() => {
    const fetchReservations = async () => {
      const snap = await getDocs(collection(db, "reservations"));
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Reservation));
      setReservations(data);
    };
    fetchReservations();
  }, []);

  useEffect(() => {
    const status = calcMonthStatus(reservations, currentMonth);
    setMonthStatus(status);
  }, [reservations, currentMonth]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>駐車スペース空き状況</Typography>
      <DateCalendar
        value={selectedDate}
        onChange={(date) => setSelectedDate(date)}
        onMonthChange={(month) => setCurrentMonth(month)}
        disablePast // 過去日を選択不可にする
        slots={{ day: StyledDay(monthStatus) }}
      />
      {selectedDate && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, mt: 1 }}>
          <Typography>{selectedDate.format("YYYY年M月D日")}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {getTooltipText(monthStatus[selectedDate.format("YYYY-MM-DD")])}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/select-space", { state: { date: selectedDate.format("YYYY-MM-DD") } })}
          >
            この日に予約する
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default CalendarPage;
