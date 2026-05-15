export function hasAdminAccess(user) {
  // TODO: keep the Admin tab hidden until GET /user/me exposes is_employee, is_admin, or employee_role.
  return Boolean(user?.is_employee === true || user?.is_admin === true || user?.employee_role);
}
