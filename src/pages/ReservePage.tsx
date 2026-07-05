import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Snackbar, Alert,
} from "@mui/material";
import dayjs from "dayjs";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import type { ReserveFormValues, SpaceId } from "../types";
import ReserveForm from "../components/ReserveForm";

const ReservePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();

  const date = location.state?.date as string | undefined;
  const spaceId = location.state?.spaceId as SpaceId | undefined;

  const [form, setForm] = useState<ReserveFormValues>({
    startDate: date ?? "",
    startTime: "",
    endDate: date ?? "",
    endTime: "",
    roomNumber: "",
    name: "",
    phone: "",
    carNumber: "",
    carColor: "",
    purpose: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ReserveFormValues, string>>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "error" | "success" }>({
    open: false, message: "", severity: "error",
  });

  if (!date || !spaceId) {
    navigate("/");
    return null;
  }

  const showError = (message: string) => setSnackbar({ open: true, message, severity: "error" });

  const handleChange = (key: keyof ReserveFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 入力したらそのフィールドのエラーを消す
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = () => {
    const { startDate, startTime, endDate, endTime, roomNumber, name, phone, carNumber } = form;
    const newErrors: Partial<Record<keyof ReserveFormValues, string>> = {};
    if (!startDate)   newErrors.startDate   = "利用開始日を入力してください";
    if (!startTime)   newErrors.startTime   = "利用開始時間を入力してください";
    if (!endDate)     newErrors.endDate     = "利用終了日を入力してください";
    if (!endTime)     newErrors.endTime     = "利用終了時間を入力してください";
    if (!roomNumber)  newErrors.roomNumber  = "部屋番号を入力してください";
    if (!name)        newErrors.name        = "氏名を入力してください";
    if (!phone)       newErrors.phone       = "電話番号を入力してください";
    if (!carNumber)   newErrors.carNumber   = "車のナンバーを入力してください";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    if (!firebaseUser) return;

    setSubmitting(true);
    try {
      const newStart = dayjs(`${form.startDate} ${form.startTime}`);
      const newEnd = dayjs(`${form.endDate} ${form.endTime}`);

      // 同じスペースのpending/approved予約を取得して重複チェック
      const q = query(
        collection(db, "reservations"),
        where("spaceId", "==", spaceId),
        where("status", "in", ["pending", "approved"]),
      );
      const snap = await getDocs(q);
      const overlaps = snap.docs.some((doc) => {
        const data = doc.data();
        const existStart = dayjs(data.startAt.toDate());
        const existEnd = dayjs(data.endAt.toDate());
        return newStart.isBefore(existEnd) && newEnd.isAfter(existStart);
      });

      if (overlaps) {
        showError("選択した時間帯はすでに予約が入っています。別の日時を選択してください。");
        setSubmitting(false);
        return;
      }

      await addDoc(collection(db, "reservations"), {
        userId: firebaseUser.uid,
        spaceId,
        roomNumber: form.roomNumber,
        name: form.name,
        phone: form.phone,
        carNumber: form.carNumber,
        carColor: form.carColor || null,
        purpose: form.purpose || null,
        startAt: Timestamp.fromDate(newStart.toDate()),
        endAt: Timestamp.fromDate(newEnd.toDate()),
        status: "pending",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // isAdmin: true のユーザーを全員取得して管理人にメール通知
      const adminSnap = await getDocs(query(
        collection(db, "users"),
        where("isAdmin", "==", true),
      ));
      const adminEmails = adminSnap.docs.map((d) => d.data().email as string);
      if (adminEmails.length > 0) {
        await addDoc(collection(db, "mail"), {
          to: adminEmails,
          message: {
            subject: "【駐車スペース予約】新しい予約申請が届きました",
            text: `新しい予約申請が届きました。\n\n申請者：${form.name}（${form.roomNumber}号室）\nスペース：${spaceId}\n利用日時：${newStart.format("M/D HH:mm")} 〜 ${newEnd.format("M/D HH:mm")}\n\n管理画面から確認してください。\n${window.location.origin}/admin`,
          },
        });
      }

      navigate("/reserve/complete");
    } catch {
      showError("申請に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ReserveForm
        {...form}
        spaceId={spaceId}
        submitting={submitting}
        errors={errors}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />

      {/* 申請確認ダイアログ */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>申請の確認</DialogTitle>
        <DialogContent>
          <DialogContentText>申請してよろしいですか？</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleConfirm}>申請する</Button>
        </DialogActions>
      </Dialog>

      {/* エラー通知 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ReservePage;
