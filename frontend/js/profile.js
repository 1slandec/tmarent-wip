export function withProfileCompletion(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    profile_completed: Boolean(user.full_name && user.age && user.license_no),
  };
}

export function isProfileCompleted(user) {
  return Boolean(withProfileCompletion(user)?.profile_completed);
}
