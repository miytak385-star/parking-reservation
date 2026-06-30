import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CalendarPage from "./pages/CalendarPage";
import SelectSpacePage from "./pages/SelectSpacePage";
import ReservePage from "./pages/ReservePage";
import ReserveCompletePage from "./pages/ReserveCompletePage";
import MyReservationsPage from "./pages/MyReservationsPage";
import AdminPage from "./pages/AdminPage";
import PrivateRoute from "./components/PrivateRoute";

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
      <Route path="/select-space" element={<PrivateRoute><SelectSpacePage /></PrivateRoute>} />
      <Route path="/reserve" element={<PrivateRoute><ReservePage /></PrivateRoute>} />
      <Route path="/reserve/complete" element={<PrivateRoute><ReserveCompletePage /></PrivateRoute>} />
      <Route path="/my-reservations" element={<PrivateRoute><MyReservationsPage /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
    </Routes>
  );
};

export default App;
