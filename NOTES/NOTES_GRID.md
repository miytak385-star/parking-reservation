# コード解説メモ — MUI DataGrid

関連ファイル：[NOTES_CODE.md](./NOTES_CODE.md) / [NOTES_MUI.md](./NOTES_MUI.md)

---

## 基本構成

```tsx
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

const columns: GridColDef[] = [ ... ];

<DataGrid
  rows={data}        // 表示するデータ配列（各要素に id フィールドが必須）
  columns={columns}  // 列定義
  autoHeight         // 行数に応じて高さが自動調整される
  disableRowSelectionOnClick  // 行クリックで選択状態にしない
  pageSizeOptions={[10, 25, 50]}
  initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
/>
```

`rows` に渡す配列の各オブジェクトには `id` フィールドが必須。Firestore から取得する際に `{ id: doc.id, ...doc.data() }` とすれば自動的に付与できる。

---

## 列定義（GridColDef）

```ts
const columns: GridColDef[] = [
  { field: "name", headerName: "氏名", width: 120 },
];
```

| プロパティ | 役割 |
|---|---|
| `field` | データのどのフィールドを使うか |
| `headerName` | 列ヘッダーの表示名 |
| `width` | 列幅（px） |
| `sortable` | `false` でヘッダークリックによるソートを無効化 |
| `valueGetter` | 表示する値を加工する関数 |
| `renderCell` | セルを JSX で自由に描画する |

---

## valueGetter — 値の加工

`field` に対応するフィールドが存在しない場合や、複数フィールドを組み合わせて表示したい場合に使う。

```ts
{
  field: "period",   // Reservation に存在しない仮のフィールド名
  headerName: "利用日時",
  sortable: false,
  valueGetter: (_value: unknown, row: Reservation) =>
    `${formatDate(row.startAt)} 〜 ${formatDate(row.endAt)}`,
},
```

- 第1引数：`field` の生の値（存在しないフィールドなら `undefined`）。使わない場合は `_value` と命名する慣習
- 第2引数：行全体のデータオブジェクト

_value: unknown は「型不明・使わない引数」を表す定型句。
unknown — 「型は何か分からないが、とりあえず受け取る」という型。any と似ているが、unknown は使う前に型チェックが必要なのでより安全。

---

## renderCell — JSX で描画

文字列ではなくコンポーネントをセルに表示したい場合に使う。`valueGetter` との違いは「値の加工」か「JSX での描画」か。

```ts
{
  field: "status",
  headerName: "ステータス",
  renderCell: (params) => {
    const s = STATUS_LABEL[params.value as ReservationStatus];
    return <Chip label={s.label} color={s.color} size="small" />;
  },
},
```

`params.value` に `field` の値が入っている。`params.row` で行全体のデータにもアクセスできる。

### Chip とは

MUI のコンポーネント。ラベルを小さなバッジ風に表示する。ステータスや分類の表示によく使う。

```tsx
<Chip label="承認待ち" color="warning" size="small" />
```

| `color` の値 | 色 | 用途例 |
|---|---|---|
| `"warning"` | 黄 | 承認待ち |
| `"success"` | 緑 | 承認済み |
| `"error"` | 赤 | 否認・エラー |
| `"default"` | グレー | 未分類 |

`size="small"` で一回り小さくなる。DataGrid のセル内など、スペースが限られる場所に適している。

### valueGetter と renderCell の使い分け

| やりたいこと | 使うもの |
|---|---|
| 複数フィールドを結合して文字列表示 | `valueGetter` |
| ソート・フィルターの基準値を変えたい | `valueGetter` |
| Chip やボタンなど JSX で描画したい | `renderCell` |
| 両方（値の加工 + JSX描画） | `valueGetter` + `renderCell` 併用 |

---

## 操作ボタンを列に追加する

承認・否認ボタンのように、行のデータを使ってイベントを発火させたい場合は `renderCell` 内でボタンを返す。コンポーネント外の関数（`handleApprove` など）をクロージャで参照する。

```ts
{
  field: "actions",
  headerName: "操作",
  sortable: false,
  renderCell: (params) => {
    if (params.row.status !== "pending") return null;
    return (
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" onClick={() => handleApprove(params.row.id)}>承認</Button>
        <Button size="small" color="error" onClick={() => handleDeny(params.row.id)}>否認</Button>
      </Box>
    );
  },
},
```
