import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Chip, Divider, IconButton, Tooltip, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { collection, getDocs, query, where } from "firebase/firestore";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { db } from "../firebase";
import type { Reservation, SpaceId } from "../types";

type DayStatus = Record<SpaceId, boolean>;
type DayFullStatus = Record<SpaceId, boolean>;
type MonthStatus = Record<string, { reserved: DayStatus; fullDay: DayFullStatus }>;
type SpaceTimes = Record<SpaceId, string[]>;
type FullDayStatus = Record<SpaceId, boolean>;

const SPACE_IDS: SpaceId[] = ["A", "B", "C"];
const SPACE_LABEL: Record<SpaceId, string> = {
  A: "区画A（普通車）",
  B: "区画B（普通車）",
  C: "区画C（軽自動車）",
  ALL: "全スペース",
};
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 時間帯リスト（"HH:mm〜HH:mm"）が 00:00〜24:00 を完全にカバーするか判定
const isFullDayCovered = (times: string[]): boolean => {
  if (times.length === 0) return false;
  const ranges = times.map((t) => {
    const [s, e] = t.split("〜");
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    return [toMin(s), e === "24:00" ? 1440 : toMin(e)] as [number, number];
  }).sort((a, b) => a[0] - b[0]);

  let covered = 0;
  for (const [start, end] of ranges) {
    if (start > covered) break;
    covered = Math.max(covered, end);
  }
  return covered >= 1439;
};

const calcMonthStatus = (reservations: Reservation[], month: Dayjs): MonthStatus => {
  const status: MonthStatus = {};
  const daysInMonth = month.daysInMonth();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = month.date(d);
    const ymd = date.format("YYYY-MM-DD");
    const reserved = {} as DayStatus;
    const fullDay = {} as DayFullStatus;
    for (const spaceId of SPACE_IDS) {
      const times: string[] = [];
      reservations.forEach((r) => {
        if (r.spaceId !== spaceId || r.status === "denied") return;
        const start = dayjs(r.startAt.toDate());
        const end = dayjs(r.endAt.toDate());
        const isStart = date.isSame(start, "day");
        const isEnd = date.isSame(end, "day");
        const isMiddle = date.isAfter(start, "day") && date.isBefore(end, "day");
        if (isStart || isEnd || isMiddle) {
          const displayStart = isStart ? start.format("HH:mm") : "00:00";
          const displayEnd = isEnd ? end.format("HH:mm") : "24:00";
          times.push(`${displayStart}〜${displayEnd}`);
        }
      });
      reserved[spaceId] = times.length > 0;
      fullDay[spaceId] = isFullDayCovered(times);
    }
    status[ymd] = { reserved, fullDay };
  }
  return status;
};

const getDayColor = (entry: MonthStatus[string] | undefined): string => {
  if (!entry) return "transparent";
  const { reserved, fullDay } = entry;
  const reservedCount = Object.values(reserved).filter(Boolean).length;
  if (reservedCount === 0) return "#a8d5b5";
  const allFullDay = SPACE_IDS.every((id) => fullDay[id]);
  if (allFullDay) return "#d0c8b8";
  return "#e8d8a0";
};

// 自作月次グリッドカレンダー
type MonthCalendarProps = {
  currentMonth: Dayjs;
  selectedDate: Dayjs | null;
  monthStatus: MonthStatus;
  onDateClick: (date: Dayjs) => void;
  onMonthChange: (month: Dayjs) => void;
};

const MonthCalendar = ({ currentMonth, selectedDate, monthStatus, onDateClick, onMonthChange }: MonthCalendarProps) => {
  const today = dayjs().startOf("day");
  const firstDay = currentMonth.startOf("month");
  const daysInMonth = currentMonth.daysInMonth();
  const startWeekday = firstDay.day(); // 0=日曜

  // グリッド用セル（前月の空白 + 当月の日付）
  const cells: (Dayjs | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => firstDay.date(i + 1)),
  ];

  return (
    <Box sx={{ width: "100%", maxWidth: 520 }}>
      {/* ヘッダー（月移動） */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <IconButton onClick={() => onMonthChange(currentMonth.subtract(1, "month"))}>
          <ChevronLeft fontSize="large" />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.4rem" }}>
          {currentMonth.format("YYYY年M月")}
        </Typography>
        <IconButton onClick={() => onMonthChange(currentMonth.add(1, "month"))}>
          <ChevronRight fontSize="large" />
        </IconButton>
      </Box>

      {/* 曜日ヘッダー */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: 0.5 }}>
        {WEEKDAYS.map((w, i) => (
          <Box key={w} sx={{ textAlign: "center", py: 0.5 }}>
            <Typography sx={{
              fontSize: "1.1rem", fontWeight: 600,
              color: i === 0 ? "error.main" : i === 6 ? "primary.main" : "text.primary",
            }}>
              {w}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* 日付グリッド */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {cells.map((date, i) => {
          if (!date) return <Box key={`empty-${i}`} />;
          const ymd = date.format("YYYY-MM-DD");
          const isPast = date.isBefore(today, "day");
          const isToday = date.isSame(today, "day");
          const isSelected = selectedDate?.isSame(date, "day");
          const bgColor = isPast ? "transparent" : getDayColor(monthStatus[ymd]);
          const weekday = date.day();

          return (
            <Box
              key={ymd}
              onClick={() => !isPast && onDateClick(date)}
              sx={{
                textAlign: "center",
                py: 1,
                borderRadius: "8px",
                backgroundColor: isSelected ? "primary.main" : bgColor,
                border: isToday && !isSelected ? "2px solid" : "2px solid transparent",
                borderColor: isToday && !isSelected ? "primary.main" : "transparent",
                cursor: isPast ? "default" : "pointer",
                opacity: isPast ? 0.35 : 1,
                "&:hover": { opacity: isPast ? 0.35 : 0.85 },
                transition: "opacity 0.15s",
              }}
            >
              <Typography sx={{
                fontSize: "1.4rem",
                fontWeight: isToday || isSelected ? 700 : 400,
                color: isSelected ? "white"
                  : weekday === 0 ? "error.main"
                  : weekday === 6 ? "primary.main"
                  : "text.primary",
                lineHeight: 1.4,
              }}>
                {date.date()}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// 地図SVGコンポーネント
type ParkingMapProps = {
  spaceTimes: SpaceTimes | null;
  fullDay: FullDayStatus | null;
  onSelect: (spaceId: SpaceId) => void;
  dateSelected: boolean;
};

const ParkingMap = ({ spaceTimes, fullDay, onSelect, dateSelected }: ParkingMapProps) => {
  const getSpaceColor = (id: SpaceId): string => {
    if (!dateSelected || spaceTimes === null) return "#e0e0e0";
    if (fullDay?.[id]) return "#d0c8b8";
    if (spaceTimes[id].length > 0) return "#e8d8a0";
    return "#a8d5b5";
  };

  const getSpaceStroke = (id: SpaceId): string => {
    if (!dateSelected || spaceTimes === null) return "#999";
    if (fullDay?.[id]) return "#999";
    if (spaceTimes[id].length > 0) return "#b8960a";
    return "#3d6b4f";
  };

  const isSelectable = (id: SpaceId): boolean => {
    if (!dateSelected || spaceTimes === null) return false;
    return !fullDay?.[id];
  };

  const getTooltip = (id: SpaceId): string => {
    if (!dateSelected) return "先に日付を選択してください";
    if (spaceTimes === null) return "取得中...";
    if (fullDay?.[id]) return `${SPACE_LABEL[id]}：終日予約済み`;
    const times = spaceTimes[id];
    if (times.length === 0) return `${SPACE_LABEL[id]}：空き（クリックで予約）`;
    return `${SPACE_LABEL[id]}：一部予約済み ${times.join("、")}（クリックで予約）`;
  };

  const allFull = dateSelected && fullDay !== null && SPACE_IDS.every((id) => fullDay[id]);

  return (
    <Box sx={{ width: "100%", maxWidth: 520 }}>
      <Typography variant="body2" sx={{ color: allFull ? "error.main" : "text.secondary", mb: 1, textAlign: "center", fontWeight: allFull ? 600 : 400 }}>
        {!dateSelected
          ? "日付を選択するとスペースの空き状況が表示されます"
          : allFull
          ? "空きスペースがありません。"
          : "空きスペースをクリックして予約できます"}
      </Typography>
      <svg viewBox="0 0 500 260" width="100%" style={{ display: "block" }}>
        {/* マンション */}
        <rect x="160" y="10" width="320" height="60" rx="4" fill="#f0f0f0" stroke="#999" strokeWidth="2" />
        <text x="320" y="47" textAnchor="middle" fontSize="18" fill="#555">マンション</text>

        {/* 住民駐車場 */}
        <rect x="10" y="100" width="100" height="130" fill="#f0f0f0" stroke="#999" strokeWidth="2" />
        <text x="60" y="160" textAnchor="middle" fontSize="13" fill="#555">住民</text>
        <text x="60" y="178" textAnchor="middle" fontSize="13" fill="#555">駐車場</text>

        {/* 壁 */}
        <rect x="118" y="100" width="16" height="130" fill="#ccc" stroke="#999" strokeWidth="1" />
        <text x="126" y="170" textAnchor="middle" fontSize="11" fill="#555">壁</text>

        {/* 区画A */}
        <Tooltip title={getTooltip("A")} arrow>
          <rect x="148" y="95" width="105" height="140" rx="14"
            fill={getSpaceColor("A")} stroke={getSpaceStroke("A")} strokeWidth="3"
            style={{ cursor: isSelectable("A") ? "pointer" : "default" }}
            onClick={() => isSelectable("A") && onSelect("A")}
          />
        </Tooltip>
        <text x="200" y="175" textAnchor="middle" fontSize="32" fontWeight="bold" fill="#333" style={{ pointerEvents: "none" }}>A</text>

        {/* 区画B */}
        <Tooltip title={getTooltip("B")} arrow>
          <rect x="265" y="95" width="105" height="140" rx="14"
            fill={getSpaceColor("B")} stroke={getSpaceStroke("B")} strokeWidth="3"
            style={{ cursor: isSelectable("B") ? "pointer" : "default" }}
            onClick={() => isSelectable("B") && onSelect("B")}
          />
        </Tooltip>
        <text x="317" y="175" textAnchor="middle" fontSize="32" fontWeight="bold" fill="#333" style={{ pointerEvents: "none" }}>B</text>

        {/* 区画C（斜め） */}
        <Tooltip title={getTooltip("C")} arrow>
          <rect x="390" y="105" width="95" height="125" rx="14"
            fill={getSpaceColor("C")} stroke={getSpaceStroke("C")} strokeWidth="3"
            transform="rotate(-12, 437, 170)"
            style={{ cursor: isSelectable("C") ? "pointer" : "default" }}
            onClick={() => isSelectable("C") && onSelect("C")}
          />
        </Tooltip>
        <text x="437" y="175" textAnchor="middle" fontSize="32" fontWeight="bold" fill="#333" transform="rotate(-12, 437, 170)" style={{ pointerEvents: "none" }}>C</text>
      </svg>

      {/* 凡例 */}
      <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 1, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#a8d5b5", border: "1px solid #3d6b4f" }} />
          <Typography variant="caption">空き</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#e8d8a0", border: "1px solid #b8960a" }} />
          <Typography variant="caption">一部予約あり</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#d0c8b8", border: "1px solid #999" }} />
          <Typography variant="caption">終日満車</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: "#e0e0e0", border: "1px solid #999" }} />
          <Typography variant="caption">日付未選択</Typography>
        </Box>
      </Box>
    </Box>
  );
};

const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());
  const [monthStatus, setMonthStatus] = useState<MonthStatus>({});
  const [spaceTimes, setSpaceTimes] = useState<SpaceTimes | null>(null);
  const [fullDay, setFullDay] = useState<FullDayStatus | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchReservations = async () => {
      const snap = await getDocs(collection(db, "reservations"));
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Reservation));
      setReservations(data);
    };
    fetchReservations();
  }, []);

  useEffect(() => {
    setMonthStatus(calcMonthStatus(reservations, currentMonth));
  }, [reservations, currentMonth]);

  const handleDateChange = async (date: Dayjs) => {
    setSelectedDate(date);
    setSpaceTimes(null);
    setFullDay(null);

    const q = query(
      collection(db, "reservations"),
      where("status", "in", ["pending", "approved"]),
    );
    const snap = await getDocs(q);
    const result: SpaceTimes = { A: [], B: [], C: [], ALL: [] };

    snap.docs.forEach((doc) => {
      const r = doc.data() as Reservation;
      const start = dayjs(r.startAt.toDate());
      const end = dayjs(r.endAt.toDate());
      const isStart = date.isSame(start, "day");
      const isEnd = date.isSame(end, "day");
      const isMiddle = date.isAfter(start, "day") && date.isBefore(end, "day");
      if (isStart || isEnd || isMiddle) {
        const displayStart = isStart ? start.format("HH:mm") : "00:00";
        const displayEnd = isEnd ? end.format("HH:mm") : "24:00";
        result[r.spaceId].push(`${displayStart}〜${displayEnd}`);
      }
    });

    setSpaceTimes(result);
    setFullDay({
      A: isFullDayCovered(result["A"]),
      B: isFullDayCovered(result["B"]),
      C: isFullDayCovered(result["C"]),
      ALL: false,
    });
  };

  const handleSpaceSelect = (spaceId: SpaceId) => {
    if (!selectedDate) return;
    navigate("/reserve", { state: { date: selectedDate.format("YYYY-MM-DD"), spaceId } });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 4, px: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>駐車スペース空き状況</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        日付を選択して、空きスペースをクリックすると予約できます
      </Typography>

      {/* カレンダー凡例 */}
      <Box sx={{ display: "flex", gap: 2, mb: 1, flexWrap: "wrap", justifyContent: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: "#a8d5b5" }} />
          <Typography variant="caption">全スペース空き</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: "#e8d8a0" }} />
          <Typography variant="caption">予約あり（空き時間帯あり）</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: "#d0c8b8" }} />
          <Typography variant="caption">全スペース終日満車</Typography>
        </Box>
      </Box>

      {/* 自作グリッドカレンダー */}
      <MonthCalendar
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        monthStatus={monthStatus}
        onDateClick={handleDateChange}
        onMonthChange={(month) => {
          setCurrentMonth(month);
          setSelectedDate(null);
          setSpaceTimes(null);
          setFullDay(null);
        }}
      />

      <Divider sx={{ width: "100%", maxWidth: 520, my: 2 }} />

      {/* 駐車場地図 */}
      <Box sx={{ width: "100%", maxWidth: 520 }}>
        {selectedDate && (
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, textAlign: "center" }}>
            {selectedDate.format("YYYY年M月D日")} の空き状況
          </Typography>
        )}
        <ParkingMap
          spaceTimes={spaceTimes}
          fullDay={fullDay}
          onSelect={handleSpaceSelect}
          dateSelected={!!selectedDate}
        />
      </Box>

      {/* 選択日の詳細（時間帯） */}
      {selectedDate && spaceTimes && (
        <Box sx={{ width: "100%", maxWidth: 520, mt: 2 }}>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>予約時間帯の詳細</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {SPACE_IDS.map((id) => (
              <Box key={id} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Typography variant="body1" sx={{ minWidth: 170, fontWeight: 500 }}>{SPACE_LABEL[id]}</Typography>
                {spaceTimes[id].length === 0 ? (
                  <Chip label="空き" color="success" sx={{ fontSize: "1rem", height: 32 }} />
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {spaceTimes[id].map((t, i) => (
                      <Chip key={i} label={`予約済み ${t}`} color="warning" sx={{ fontSize: "1rem", height: 32 }} />
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default CalendarPage;
