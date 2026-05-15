import { http } from "./http.js";

export const branchesApi = {
  async list() {
    const response = await http.get("/branches");
    return response.data.branches || [];
  },
};
