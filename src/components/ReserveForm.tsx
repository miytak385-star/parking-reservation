import { Box, Button, Divider, TextField, Typography } from "@mui/material";
import type { ReserveFormValues, SpaceId } from "../types";

const SPACE_LABEL: Record<SpaceId, string> = {
  A: "区画A（普通車）",
  B: "区画B（普通車）",
  C: "区画C（軽自動車）",
  ALL: "全スペース",
};

type ReserveFormProps = ReserveFormValues & {
  spaceId: SpaceId;
  submitting: boolean;
  onChange: (key: keyof ReserveFormValues, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const ReserveForm = (props: ReserveFormProps) => {
  const {
    spaceId, startDate, startTime, endDate, endTime,
    roomNumber, name, phone, carNumber, carColor, purpose,
    submitting, onChange, onSubmit, onCancel,
  } = props;

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", mt: 4, px: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h6">予約申請</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        スペース：{SPACE_LABEL[spaceId]}
      </Typography>
      <Divider />
      <TextField label="利用開始日 *" type="date" value={startDate} onChange={(e) => onChange("startDate", e.target.value)} />
      <TextField label="利用開始時間 *" type="time" value={startTime} onChange={(e) => onChange("startTime", e.target.value)} />
      <TextField label="利用終了日 *" type="date" value={endDate} onChange={(e) => onChange("endDate", e.target.value)} />
      <TextField label="利用終了時間 *" type="time" value={endTime} onChange={(e) => onChange("endTime", e.target.value)} />
      <Divider />
      <TextField label="部屋番号 *" value={roomNumber} onChange={(e) => onChange("roomNumber", e.target.value)} />
      <TextField label="氏名 *" value={name} onChange={(e) => onChange("name", e.target.value)} />
      <TextField label="電話番号 *" value={phone} onChange={(e) => onChange("phone", e.target.value)} />
      <TextField label="車のナンバー *" value={carNumber} onChange={(e) => onChange("carNumber", e.target.value)} />
      <TextField label="車の色" value={carColor} onChange={(e) => onChange("carColor", e.target.value)} />
      <TextField label="利用目的" multiline rows={3} value={purpose} onChange={(e) => onChange("purpose", e.target.value)} />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 1 }}>
        <Button variant="outlined" onClick={onCancel}>キャンセル</Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitting}>申請する</Button>
      </Box>
    </Box>
  );
};

export default ReserveForm;
