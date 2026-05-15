import { http } from "./http.js";

export const carsApi = {
  async list(branchId) {
    const response = await http.get("/cars", {
      params: {
        branch_id: branchId,
      },
    });
    return response.data.cars || [];
  },
};
