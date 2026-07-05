# コード解説メモ — React / TypeScript

関連ファイル：[NOTES_MUI.md](./NOTES_MUI.md) / [NOTES_FIREBASE.md](./NOTES_FIREBASE.md)

---

## 認証まわり

### AuthContext.tsx — `import type`

```ts
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import type { AppUser } from "../types";
```

Vite + TypeScript環境では、型のみに使うインポートは `import type` で書くことが推奨されている。
ランタイムにバンドルされる値と型が混在すると、Viteが型を解決できずエラーになることがある。

---

### PrivateRoute.tsx — ルートガード

```tsx
const PrivateRoute = ({ children }: { children: ReactElement }) => {
  const { firebaseUser, loading } = useAuth();
  if (loading) return null;
  return firebaseUser ? children : <Navigate to="/login" replace />;
};
```

- `loading` 中は `null`（何も表示しない）
- ログイン済みなら子コンポーネントを表示
- 未ログインなら `/login` へリダイレクト

`JSX.Element` は React 17以前の書き方。React 18以降は `ReactElement` が正しい型。

---

### App.tsx — ルート定義

```tsx
<Route path="/login" element={<LoginPage />} />
<Route path="/" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
```

`/login` だけ `PrivateRoute` で囲まない（誰でもアクセス可）。
それ以外の全ルートは `PrivateRoute` で囲んで認証必須にする。

---

## カレンダーまわり

### CalendarPage.tsx — 型定義

```ts
type DayStatus = Record<SpaceId, boolean>; // true = 予約済み
type MonthStatus = Record<string, DayStatus>; // key = "YYYY-MM-DD"
```

`Record<K, V>` は「キーがK、値がVのオブジェクト」を表すTypeScriptの型。
`MonthStatus` は `{ "2026-06-01": { A: false, B: true, C: false }, ... }` のような構造になる。

---

### CalendarPage.tsx — 空き状況の計算

月の全日付をループして、各日・各スペースに予約が被っているか判定する。

```ts
const reserved = reservations.some((r) => {
  if (r.spaceId !== spaceId) return false;
  if (r.status === "denied") return false;
  const start = dayjs(r.startAt.toDate());
  const end = dayjs(r.endAt.toDate());
  return date.isSame(start, "day") || date.isSame(end, "day") ||
    (date.isAfter(start, "day") && date.isBefore(end, "day"));
});
```

- `isSame / isAfter / isBefore` — dayjsの日付比較メソッド。第2引数 `"day"` で「日単位で比較」
- 否認済み（`denied`）は空き扱いにするため除外する

---

### CalendarPage.tsx — カスタム日付セル

```ts
const StyledDay = (monthStatus: MonthStatus) =>
  function CustomDay(props: PickerDayProps) { ... };
```

`StyledDay` は関数を返す関数。`monthStatus` を渡すと、それを参照できる `CustomDay` コンポーネントが返る。
`DateCalendar` の `slots={{ day: ... }}` にコンポーネントを渡すとデフォルトの日付セルを差し替えられる。

### なぜ「関数を返す関数」にするか — クロージャ

`DateCalendar` の `slots.day` には **コンポーネント関数** を渡す必要があるが、そのコンポーネント内で外部の値（`monthStatus`）を参照したい。`DateCalendar` 側からは `monthStatus` を渡してもらえないので、自分で「`monthStatus` を覚えた関数」を作って渡す。

```ts
const StyledDay = (monthStatus: MonthStatus) =>
  function CustomDay(props: PickerDayProps) {
    // ← ここで monthStatus を参照できる（クロージャ）
    const status = monthStatus[props.day.format("YYYY-MM-DD")];
    return /* セルのJSX */;
  };

<DateCalendar slots={{ day: StyledDay(monthStatus) }} />
//                          ↑ ここで実行 → monthStatus を覚えた関数が返る
```

**動きの順序：**
1. `StyledDay(monthStatus)` を呼ぶ
2. `monthStatus` を **クロージャでキャプチャ** した `CustomDay` 関数が返る
3. その関数を `slots.day` に渡す
4. `DateCalendar` が各日付セルとして `CustomDay` を呼び出す
5. `CustomDay` 内で `props`（日付情報）と `monthStatus`（外側の値）両方を使って描画

**Javaのクラスに例えると：**

```ts
// JavaScript（クロージャ）
const StyledDay = (monthStatus) => (props) => { /* monthStatus を使う */ };
```

```java
// Java（インスタンス変数）
class CustomDay {
  private MonthStatus monthStatus;
  CustomDay(MonthStatus monthStatus) { this.monthStatus = monthStatus; }
  String render(Props props) { /* this.monthStatus を使う */ }
}
```

JavaScriptは関数自体が「変数を覚える」性質（クロージャ）を持つので、クラスを使わずに同じことができる。

**よく使う場面：**
- 設定済みのイベントハンドラを生成（`createHandler(config)`）
- HOC（Higher-Order Component）
- ライブラリのslotに外部値を渡したいとき

---

### useEffect の依存配列

```ts
useEffect(() => {
  // 処理
}, [reservations, currentMonth]); // ← これが依存配列
```

「この配列の中の値が変わったときだけ処理を実行する」

| 書き方 | 実行タイミング |
|---|---|
| `[]`（空） | 初回レンダリング時のみ |
| `[a, b]` | 初回 + `a` か `b` が変わるたび |
| 省略 | 毎回のレンダリングで実行 |

---

### useEffect のコールバックを直接 `async` にできない

`useEffect` のコールバックは **クリーンアップ関数（または `undefined`）を返す** 仕様。`async` 関数は必ず `Promise` を返してしまうため型が合わず、直接 `async` にできない。

```ts
// NG：async関数は Promise<void> を返してしまう
useEffect(async () => {
  const snap = await getDocs(/* ... */);
  setData(snap.docs);
}, []);
```

**回避方法：** `useEffect` の中で `async` 関数を定義してから呼ぶ。

```ts
useEffect(() => {
  const fetch = async () => {
    const snap = await getDocs(/* ... */);
    setData(snap.docs);
  };
  fetch();
}, []);
```

**Reactがクリーンアップ関数を期待する理由：** コンポーネントがアンマウントされたときに後片付け（イベントリスナー解除、タイマー解除など）を実行できるようにするため。`async` が返すPromiseはクリーンアップ関数ではないのでReactは扱えない。

---

## 予約フローまわり

### 画面間のデータ受け渡し（React Router）

```ts
// 渡す側
navigate("/select-space", { state: { date: "2026-06-01" } });

// 受け取る側
const location = useLocation();
const date = location.state?.date as string | undefined;
```

`state` で次の画面にデータを渡す。`date` がない場合（直接URLアクセスなど）は `/` にリダイレクトして `return null` で描画を止める。

---

### ReservePage.tsx — フォームのstate管理

```ts
const [form, setForm] = useState<ReserveFormValues>({
  startDate: date ?? "",
  roomNumber: "",
  // ...
});

const handleChange = (key: keyof ReserveFormValues, value: string) => {
  setForm((prev) => ({ ...prev, [key]: value }));
};
```

- `date ?? ""` — nullish coalescing演算子。左辺がnull/undefinedのとき右辺を使う
- `{ ...prev, [key]: value }` — スプレッド構文で既存のstateをコピーしつつ指定キーだけ更新する
- `keyof ReserveFormValues` — 型の全キーのユニオン型（`"startDate" | "roomNumber" | ...`）

---

### TypeScriptの `keyof` 演算子

型のプロパティ名をすべて取り出して **ユニオン型** にする演算子。TypeScript固有。

```ts
interface ReserveFormValues {
  startDate: string;
  startTime: string;
  roomNumber: string;
  name: string;
}

type Keys = keyof ReserveFormValues;
// "startDate" | "startTime" | "roomNumber" | "name"
```

`Keys` 型の変数には上記4つの文字列しか入らない。

### 何が嬉しいか — タイポ防止

```ts
const handleChange = (key: keyof ReserveFormValues, value: string) => {
  setForm((prev) => ({ ...prev, [key]: value }));
};

handleChange("startDate", "2026-06-01");  // OK
handleChange("startDay",  "2026-06-01");  // ❌ コンパイルエラー（typo検出）
```

`key: string` にすると `"startDay"` のような typo も通ってしまうが、`key: keyof ReserveFormValues` にすると **実在するプロパティ名だけ** に絞れる。リファクタでプロパティ名が変わったときもコンパイラが教えてくれる。

### よく使う組み合わせ

```ts
// 型 T のキーを使った汎用関数
function getValue<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

`T[K]` で「型 T のキー K に対応する値の型」を取り出せる（インデックスアクセス型）。

---

### Reactのstateはイミュータブル（不変）に扱う

stateの更新は **新しいオブジェクトを作って渡す** のが鉄則。元のオブジェクトを直接書き換えてはいけない。

```ts
// NG：元のオブジェクトを直接変更（ミューテーション）
setForm((prev) => {
  prev[key] = value;  // ← prev そのものを書き換えている
  return prev;
});

// OK：新しいオブジェクトを作る
setForm((prev) => ({ ...prev, [key]: value }));
```

**理由：** Reactは前後のstateを **参照比較**（`===`）して変化を判定する。
- 同じオブジェクトを書き換えると参照は変わらない → 「変化なし」と判定 → **再レンダリングされない**
- 新しいオブジェクトを作ると参照が変わる → 「変化あり」と判定 → **再レンダリングされる**

スプレッド構文 `{ ...prev, [key]: value }` は「既存プロパティを全部コピーした新しいオブジェクトを作り、指定キーだけ上書きする」イディオム。配列でも同様（`[...prev, newItem]` で末尾追加）。

`[key]` は **computed property name** — 変数の値をキーとして使うES2015の構文。

```ts
const key = "name";
const obj = { [key]: "太郎" };  // { name: "太郎" }
```

---

### ReserveForm.tsx — Propsの設計

```ts
type ReserveFormProps = ReserveFormValues & {
  spaceId: SpaceId;
  submitting: boolean;
  onChange: (key: keyof ReserveFormValues, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};
```

Reactではデータの流れが「親から子へ一方向」。子コンポーネントは自分でstateを持たず、親からもらった値を表示して変更を親に通知するだけ。「値」と「通知用関数」をセットでPropsに定義するのがReactの基本パターン。

---

## ES2020構文（モダンJavaScript）

TypeScript固有ではなく、JavaScriptの標準構文。モダンブラウザ・Node.js 14以降で動く。

### `??` — nullish coalescing 演算子

左辺が **`null` または `undefined` のときだけ** 右辺を返す。

```ts
const x1 = 0 ?? 10;    // 0   （0は null/undefined ではないので左辺）
const x2 = null ?? 10; // 10  （null なので右辺）
```

### `||` との違い

| 演算子 | 右辺を返す条件 |
|---|---|
| `\|\|` | 左辺が **falsy**（`0`、`""`、`false`、`null`、`undefined`） |
| `??` | 左辺が **`null` または `undefined` のときだけ** |

```ts
const a = 0 || 10;  // 10（0はfalsyなので右辺）
const b = 0 ?? 10;  // 0 （0はnull/undefinedではないので左辺）
```

`0` や `""` を有効な値として扱いたい場面では `??` を使う。`||` だと意図せず「無効」扱いされる。

---

### `?.` — オプショナルチェイニング

左辺が `null` または `undefined` のとき、エラーにせず `undefined` を返す。

```ts
const date = location.state?.date;
// location.state が null/undefined でも例外にならず、date は undefined
```

### `??=` — nullish coalescing 代入

左辺が `null` または `undefined` のときだけ右辺を代入。

```ts
count ??= 10;  // count が null/undefined なら 10 を代入
```

---

### `?.` と `??` を組み合わせる典型パターン

```ts
const date = location.state?.date ?? "";
// location.state が null/undefined でもエラーにならず、date は ""
```

ReactRouterで `state` 経由のデータを受け取るときによく使う。

---

## JavaScriptのメソッド

### filter と some の違い

```ts
// filter：条件を満たす要素を「配列で」返す
transactions.filter((t) => t.type === "expense")
// → [{ type: "expense", ... }, ...]

// some：条件を満たす要素が「1件でもあるか」をbooleanで返す
reservations.some((r) => r.spaceId === "A")
// → true または false
```

「被る予約が1件でもあればアウト」という判定には `some` が適切。
`filter` でも書けるが `overlaps.length > 0` の判定が必要になり冗長になる。

---

## TIPS

**Viteのキャッシュクリア**
```powershell
# Ctrl+C でサーバー停止後
Remove-Item -Recurse -Force node_modules\.vite
npm run dev
```
