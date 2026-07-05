# コード解説メモ — MUI（Material UI）

関連ファイル：[NOTES_CODE.md](./NOTES_CODE.md) / [NOTES_FIREBASE.md](./NOTES_FIREBASE.md)

---

## 基本

### MUI v9 の注意点

スペーシングprops（`mb`、`mt` など）は `sx` 経由でのみ指定できる（直接propsには書けない）。

```tsx
// NG（v9では使えない）
<Typography mb={2}>テキスト</Typography>

// OK
<Typography sx={{ mb: 2 }}>テキスト</Typography>
```

---

## レイアウト

### Box

MUIのレイアウト用コンポーネント。実態はただの `<div>` で、`sx` プロパティでスタイルを書く。

```tsx
<Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 4 }}>
```

`mt: 4` は `margin-top: 32px`（4 × 8px）。MUIは8px基準のスケールを使っている。
`<div style={{...}}>` より `<Box sx={{...}}>` が標準的な書き方。

---

## テキスト

### Typography

テキスト表示用コンポーネント。`variant` でHTMLタグとスタイルを同時に指定する。

```tsx
<Typography variant="h6" sx={{ mb: 2 }}>駐車スペース空き状況</Typography>
```

`variant` は `h1`〜`h6`、`body1`、`body2`、`caption` などがある。
MUIのテーマでフォントや色を一括管理できるため、素の `<h6>` や `<p>` より `Typography` を使う。

---

## データ表示

### Card

枠線付きの囲みを作るコンポーネント。`CardContent` と組み合わせて使う。

```tsx
<Card sx={{ mb: 2 }}>
  <CardContent>
    <Typography>内容</Typography>
  </CardContent>
</Card>
```

---

### Chip

タグ・バッジ風のコンポーネント。`color` にMUIのカラー名を渡すと色が変わる。

```tsx
<Chip label="承認待ち" color="warning" size="small" />
```

| color | 色 |
|---|---|
| `"warning"` | 黄 |
| `"success"` | 緑 |
| `"error"` | 赤 |

---

### Select + MenuItem — ドロップダウン

`Select` がドロップダウン本体、`MenuItem` が各選択肢。必ずセットで使う。

```tsx
<Select
  size="small"
  value={filter}
  onChange={(e) => setFilter(e.target.value as FilterStatus)}
>
  <MenuItem value="all">全件</MenuItem>
  <MenuItem value="pending">承認待ち</MenuItem>
  <MenuItem value="approved">承認済み</MenuItem>
</Select>
```

- `value` — 現在の選択値。stateと紐付ける
- `onChange` — 選択が変わったときに呼ばれる。`e.target.value` に選択された `MenuItem` の `value` が入る
- `MenuItem` の `value` — 内部的な値（コード用）。子テキストが表示名

`e.target.value` は型が `string` として推論されるため、独自のユニオン型（`FilterStatus` など）にする場合は `as` でキャストする。

---

## 日付

### LocalizationProvider（main.tsx）

```tsx
<LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ja">
```

`DateCalendar` はどの日付ライブラリを使うか自分で指定する設計。ここでは `dayjs` を指定。
`adapterLocale="ja"` で日本語（月曜始まり・日本語表記）になる。
アプリ全体に影響するので `main.tsx` の一番外側に置く。

---

### DateCalendar — カスタム日付セル

```tsx
<DateCalendar
  slots={{ day: StyledDay(monthStatus) }}
/>
```

`slots={{ day: ... }}` にコンポーネントを渡すとデフォルトの日付セルを差し替えられる。

---

### DateCalendar — 選択可能な日付の制限

`DateCalendar`（およびMUI X Date Pickers系コンポーネント全般）の組み込みオプション。

```tsx
<DateCalendar
  disablePast       // 今日より前を選択不可
  disableFuture     // 未来日を選択不可
  minDate={dayjs("2026-01-01")}
  maxDate={dayjs("2026-12-31")}
  shouldDisableDate={(d) => d.day() === 0} // 関数で個別判定（例：日曜だけ不可）
/>
```

「過去日は予約させない」程度なら `disablePast` 1行で十分。
複雑な条件（祝日のみ不可、など）は `shouldDisableDate` を使う。

---

### カスタムslotでpropsを透過する書き方（分割代入＋スプレッド）

`PickerDay` などのカスタムslotでは「元のpropsをほぼそのまま渡しつつ、一部だけ上書きしたい」ことが多い。
このときに使うのが **分割代入＋スプレッド構文（rest pattern）**。

```tsx
function CustomDay(props: PickerDayProps) {
  const { day, ...other } = props;
  // day   = props.day
  // other = dayを除いた残り全プロパティ（disabled, selected, onClick, ...）

  return (
    <PickerDay
      {...other}                                // 残り全部をそのまま渡す
      day={day}                                 // dayは明示的に渡す
      disabled={other.disabled || isPast}       // disabledだけ自前ロジックで上書き
      sx={{ backgroundColor: bgColor }}
    />
  );
}
```

**ポイント：**
- MUI側でpropsが増えても自動的に追従できる（手書きで列挙しないため）
- `disabled={other.disabled || isPast}` のようにORで組み合わせれば、MUIの判定（`disablePast`等）と自前判定の両方を尊重できる

