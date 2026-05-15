import { http } from "./http.js";

export const authApi = {
  async telegram(initData) {
    const response = await http.post("/auth/telegram", {
      init_data: initData,
    });
    return response.data;
  },
};
