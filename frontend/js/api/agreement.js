import { http } from "./http.js";

export const agreementApi = {
  async create(payload) {
    const response = await http.post("/agreement", payload);
    return response.data;
  },

  async complete(agreementId) {
    const response = await http.post("/agreement/complete", {
      agreement_id: Number(agreementId),
    });
    return response.data;
  },

  async history() {
    const response = await http.get("/agreement/history");
    return response.data.history || [];
  },
};
