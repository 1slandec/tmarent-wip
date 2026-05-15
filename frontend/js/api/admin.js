import { http } from "./http.js";

export const adminApi = {
  async createCar(data) {
    const response = await http.post("/admin/cars", data);
    return response.data;
  },

  async updateCar(carId, data) {
    const response = await http.patch(`/admin/cars/${Number(carId)}`, data);
    return response.data;
  },

  async deleteCar(carId) {
    const response = await http.delete(`/admin/cars/${Number(carId)}`);
    return response.data;
  },

  async createBranch(data) {
    const response = await http.post("/admin/branches", data);
    return response.data;
  },

  async updateBranch(branchId, data) {
    const response = await http.patch(`/admin/branches/${Number(branchId)}`, data);
    return response.data;
  },

  async deleteBranch(branchId) {
    const response = await http.delete(`/admin/branches/${Number(branchId)}`);
    return response.data;
  },
};
