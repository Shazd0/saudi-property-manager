// FCM initialization now handled by services/pushNotificationService.ts
// This stub remains for backward compatibility.
export const initFcm = async (userId?: string, _vapidKey?: string) => {
  try {
    const { registerDeviceForPush } = await import('../services/pushNotificationService');
    return registerDeviceForPush(userId || 'unknown', 'User');
  } catch (e) {
    return null;
  }
};
