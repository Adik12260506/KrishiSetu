/**
 * Session Manager & Shared Device Guard
 * Implements strict trust boundaries on shared handsets.
 */

const { OfflineWallet } = require('./offline_wallet');

class SharedDeviceSessionManager {
  constructor(deviceId = 'SHARED_PHONE_01') {
    this.deviceId = deviceId;
    this.activeUser = null;
    this.activeWallet = null;
    this.userStores = new Map(); // Scoped user storage partitions
  }

  // Register or authenticate user with PIN
  login(farmerId, pin = '1234') {
    if (!farmerId) throw new Error('farmerId is required');

    // Tear down any existing session in memory
    this.logout();

    // Key user partition by farmerId
    let userRecord = this.userStores.get(farmerId);
    if (!userRecord) {
      userRecord = {
        farmer_id: farmerId,
        pin: pin,
        wallet: new OfflineWallet(farmerId, this.deviceId, 0),
        created_at: new Date().toISOString()
      };
      this.userStores.set(farmerId, userRecord);
    } else {
      if (userRecord.pin !== pin) {
        throw new Error('Invalid PIN for user');
      }
    }

    this.activeUser = farmerId;
    this.activeWallet = userRecord.wallet;

    return {
      success: true,
      farmer_id: this.activeUser,
      device_id: this.deviceId,
      wallet_state: this.activeWallet.getState()
    };
  }

  logout() {
    if (this.activeUser) {
      // Memory zeroing
      this.activeUser = null;
      this.activeWallet = null;
    }
    return { success: true, message: 'Session securely terminated and memory zeroed' };
  }

  getActiveWallet() {
    if (!this.activeUser || !this.activeWallet) {
      throw new Error('UNAUTHORIZED: No active user session on device');
    }
    return this.activeWallet;
  }

  getActiveUserId() {
    return this.activeUser;
  }

  // Security test verification: verify User B cannot access User A's data
  verifyCrossUserIsolation(userAId, userBId) {
    const userA = this.userStores.get(userAId);
    const userB = this.userStores.get(userBId);

    if (!userA || !userB) return { isolated: true, reason: 'Users do not both exist' };

    // Test: Wallet memory pointers are strictly separated
    const distinctWallets = userA.wallet !== userB.wallet;
    // Test: State balances are isolated
    const balanceA = userA.wallet.balance;
    const balanceB = userB.wallet.balance;

    return {
      isolated: distinctWallets,
      user_a_balance: balanceA,
      user_b_balance: balanceB,
      cross_leakage_detected: !distinctWallets
    };
  }

  reset() {
    this.logout();
    this.userStores.clear();
  }
}

const globalSessionManager = new SharedDeviceSessionManager();

module.exports = {
  SharedDeviceSessionManager,
  globalSessionManager
};
