# コード解説メモ — Firebase / Firestore

関連ファイル：[NOTES_CODE.md](./NOTES_CODE.md) / [NOTES_MUI.md](./NOTES_MUI.md)

---

## 基本操作

### getDocs — 全件取得

```ts
const snap = await getDocs(collection(db, "spaces"));
const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Space));
```

コレクションの全ドキュメントを取得する。コレクションが存在しない場合も空配列が返るだけでエラーにならない。

---

### addDoc — ドキュメント追加（ID自動生成）

```ts
await addDoc(collection(db, "reservations"), {
  userId: firebaseUser.uid,
  startAt: Timestamp.fromDate(dayjs(`${startDate} ${startTime}`).toDate()),
  status: "pending",
  createdAt: Timestamp.now(),
});
```

- IDはFirestoreが自動生成する
- `Timestamp.fromDate()` — JS の `Date` オブジェクトをFirestoreのTimestamp型に変換する
- `Timestamp.now()` — 現在時刻のTimestampを生成する

---

### setDoc — ドキュメント追加（ID指定）

```ts
await setDoc(doc(db, "spaces", "A"), {
  carType: "normal",
  isActive: true,
});
```

IDを自分で指定する場合に使う。`spaces` のA/B/C固定IDや `users` のUID指定などに使う。

---

### updateDoc — フィールドの部分更新

```ts
await updateDoc(doc(db, "reservations", id), {
  status: "denied",
  updatedAt: Timestamp.now(),
});
```

指定したフィールドだけ更新する（`setDoc` は全フィールド上書き）。

---

## 条件付き取得

### query + where

```ts
const q = query(
  collection(db, "reservations"),
  where("spaceId", "==", spaceId),
  where("status", "in", ["pending", "approved"]),
);
const snap = await getDocs(q);
```

- `where("field", "==", value)` — 完全一致
- `where("field", "in", [v1, v2])` — 複数値のいずれかに一致
- 全件取得より効率的（Firestoreの読み取りコストを抑えられる）

---

## Timestamp の扱い

```ts
// FirestoreのTimestamp → JS の Date → dayjs
const start = dayjs(r.startAt.toDate());

// dayjs → JS の Date → FirestoreのTimestamp
Timestamp.fromDate(dayjs(`${startDate} ${startTime}`).toDate())

// ミリ秒に変換（数値比較やソートに使う）
b.startAt.toMillis() - a.startAt.toMillis()
```

---

## addDoc vs setDoc の使い分け

| コレクション | 方法 | 理由 |
|---|---|---|
| `reservations` | `addDoc` | IDは自動でOK |
| `blockings` | `addDoc` | IDは自動でOK |
| `spaces` | `setDoc` | ID=`"A"`/`"B"`/`"C"` で固定 |
| `users` | `setDoc` | ID=Firebase AuthのUID |

---

## Firebase CLI — Firestoreセキュリティルールのデプロイ

### 初回セットアップ

```powershell
npm install -g firebase-tools
firebase login          # ブラウザでGoogleアカウントログイン
firebase use parking-reservation-loire
```

### ルールのデプロイ

```powershell
firebase deploy --only firestore:rules
```

`firestore.rules` を編集するたびに上記コマンドを実行する。

---

## Firestoreセキュリティルール

### アクセス制御方針

| コレクション | 読み | 作成 | 更新 | 削除 |
|---|---|---|---|---|
| `spaces` | ログイン済み全員 | 不可（Console操作のみ） | 不可 | 不可 |
| `reservations` | 自分の予約 or 管理人 | 自分のuidでstatus=pending | 本人(pending→denied) or 管理人 | 管理人のみ |
| `users` | 自分のみ | 自分のみ | 自分のみ（isAdmin変更不可） | 自分のみ |

### 管理人の判定

ルール内で `users/{uid}` の `isAdmin` フィールドを参照して判定する。

```js
function isAdmin() {
  return request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}
```

管理人フラグは Firebase Console から直接 Firestore を操作して付与する（アプリからは変更不可）。

### users の isAdmin を自己変更させない

```js
allow update: if isOwner(userId) &&
  request.resource.data.isAdmin == resource.data.isAdmin;
```

`isAdmin` の値を変えようとすると条件が `false` になり更新が拒否される。

### 注意：users ドキュメントが存在しない場合

`resource.data` が null になるため `update` ルールが失敗する。ただし現状の `AuthContext.tsx` は `getDoc` で読むだけで書き込んでいないので問題ない。将来ユーザー情報をアプリから保存する場合は `create` と `update` を分けてルールを書き直す。