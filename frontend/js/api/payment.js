import { http } from "./http.js";

export const paymentApi = {
  async create(payload) {
    const response = await http.post("/payment", payload);
    return response.data;
  },
};
