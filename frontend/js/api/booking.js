import { http } from "./http.js";

export const bookingApi = {
  async checkAvailability(payload) {
    const response = await http.post("/availability/check", payload);
    return response.data;
  },

  async create(payload) {
    const response = await http.post("/booking", payload);
    return response.data;
  },

  async active() {
    const response = await http.get("/booking/active");
    if (response.data?.booking === null) {
      return null;
    }
    return response.data;
  },

  async cancel(bookingId) {
    const response = await http.post("/booking/cancel", {
      booking_id: Number(bookingId),
    });
    return response.data;
  },

  async confirmBooking(bookingId, method = "card") {
    const response = await http.post("/booking/confirm", {
      booking_id: Number(bookingId),
      method,
    });
    return response.data;
  },
};
