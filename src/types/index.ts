import { Timestamp } from "firebase/firestore";

export type SpaceId = "A" | "B" | "C" | "ALL";
export type CarType = "normal" | "light";
export type ReservationStatus = "pending" | "approved" | "denied";

export type Reservation = {
  id: string;
  userId: string;
  roomNumber: string;
  name: string;
  phone: string;
  carNumber: string;
  carColor?: string;
  spaceId: SpaceId;
  startAt: Timestamp;
  endAt: Timestamp;
  purpose?: string;
  status: ReservationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Space = {
  id: SpaceId;
  carType: CarType;
  isActive: boolean;
};

export type Blocking = {
  id: string;
  spaceId: SpaceId;
  startAt: Timestamp;
  endAt: Timestamp;
  reason: string;
  createdBy: string;
};

export interface ReserveFormValues {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  roomNumber: string;
  name: string;
  phone: string;
  carNumber: string;
  carColor: string;
  purpose: string;
}

export type AppUser = {
  uid: string;
  email: string;
  isAdmin: boolean;
  roomNumber: string;
};
