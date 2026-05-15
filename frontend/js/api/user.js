import { http } from "./http.js";

export const userApi = {
  async me() {
    const response = await http.get("/user/me");
    return response.data;
  },

  async updateMe(payload) {
    const response = await http.patch("/user/me", payload);
    return response.data;
  },
};
