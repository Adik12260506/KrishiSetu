/**
 * Shared Device Security Guard
 * Enforces zero cross-user leakage on shared feature phones.
 */

const { globalSessionManager } = require('../wallet/session_manager');

function enforceUserBoundary(requestedFarmerId) {
  const activeUser = globalSessionManager.getActiveUserId();
  if (!activeUser) {
    return { allowed: false, error: 'NO_ACTIVE_SESSION', message: 'User must authenticate before accessing wallet' };
  }
  if (activeUser !== requestedFarmerId) {
    return {
      allowed: false,
      error: 'CROSS_USER_ACCESS_DENIED',
      message: `Security violation: Device is authenticated as ${activeUser}, cannot access ${requestedFarmerId}`
    };
  }
  return { allowed: true, farmer_id: activeUser };
}

module.exports = {
  enforceUserBoundary
};
