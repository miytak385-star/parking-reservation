# CalendarPage.tsx 処理まとめ

## 定数・型定義

```ts
type DayStatus = Record<SpaceId, boolean>; // { A: false, B: true, C: false } など
type MonthStatus = Record<string, DayStatus>; // { "2026-06-01": DayStatus, ... }
const SPACE_IDS: SpaceId[] = ["A", "B", "C"];
```

---

## コンポーネント外の関数

### `calcMonthStatus(reservations, month)`
- **処理**：月の全日付をループし、各日・各スペースに予約が被っているか判定して `MonthStatus` を返す
- **呼び出しタイミング**：`reservations` または `currentMonth` が変わったとき（`useEffect` の依存配列）

### `getDayColor(dayStatus)`
- **処理**：予約済みスペース数をもとに背景色を返す（緑/黄/灰）
- **呼び出しタイミング**：`StyledDay`（カスタム日付セル）のレンダリング時

### `getTooltipText(dayStatus)`
- **処理**：`{ A: false, B: true, C: false }` を「区画A 空き／区画B 満車／区画C 空き」の文字列に変換して返す
- **呼び出しタイミング**：日付クリック後の空き状況テキスト表示時

### `StyledDay(monthStatus)`
- **処理**：`monthStatus` を受け取り、カスタム日付セルコンポーネント `CustomDay` を返す関数
- **呼び出しタイミング**：`DateCalendar` の `slots={{ day: ... }}` に渡すときに呼ばれる

---

## state一覧

| state | 型 | 初期値 | 役割 |
|---|---|---|---|
| `selectedDate` | `Dayjs \| null` | `null` | 選択中の日付 |
| `spaces` | `Space[]` | `[]` | Firestoreから取得したスペース一覧 |
| `reservations` | `Reservation[]` | `[]` | Firestoreから取得した予約一覧 |
| `currentMonth` | `Dayjs` | 今月 | 表示中の月 |
| `monthStatus` | `MonthStatus` | `{}` | 月ごとの空き状況 |

---

## useEffect一覧

### `useEffect(() => fetchSpaces(), [])`
- **処理**：Firestoreの `spaces` コレクションを取得して `setSpaces`
- **呼び出しタイミング**：初回レンダリング時のみ（依存配列が空）

### `useEffect(() => fetchReservations(), [])`
- **処理**：Firestoreの `reservations` コレクションを取得して `setReservations`
- **呼び出しタイミング**：初回レンダリング時のみ（依存配列が空）

### `useEffect(() => calcMonthStatus(...), [reservations, currentMonth])`
- **処理**：`reservations` と `currentMonth` をもとに空き状況を計算して `setMonthStatus`
- **呼び出しタイミング**：初回 + `reservations` か `currentMonth` が変わるたび

---

## イベントハンドラ

### `onChange={(date) => setSelectedDate(date)}`
- **処理**：日付クリックで `selectedDate` を更新
- **呼び出しタイミング**：カレンダーの日付をクリックしたとき

### `onMonthChange={(month) => setCurrentMonth(month)}`
- **処理**：表示月の切り替えで `currentMonth` を更新 → `useEffect` が再計算をトリガー
- **呼び出しタイミング**：カレンダーの `<` `>` をクリックして月を切り替えたとき

### `onClick={() => navigate("/select-space", { state: { date: ... } })}`
- **処理**：選択した日付を `state` に乗せて `/select-space` へ遷移
- **呼び出しタイミング**：「この日に予約する」ボタンをクリックしたとき
