/**
 * Client-Side Offline Storage & Compact Wire Sync
 */

const STORAGE_PREFIX = 'KS_USER_';

class ClientWalletStorage {
  constructor(farmerId = 'farmer_ramesh', deviceId = 'DEV_HANDSET_01') {
    this.farmerId = farmerId;
    this.deviceId = deviceId;
    this.storageKey = `${STORAGE_PREFIX}${farmerId}`;
    this.state = this._loadState();
  }

  setFarmer(farmerId) {
    this.farmerId = farmerId;
    this.storageKey = `${STORAGE_PREFIX}${farmerId}`;
    this.state = this._loadState();
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    return {
      farmer_id: this.farmerId,
      device_id: this.deviceId,
      balance_inr: 0,
      sequence: 0,
      policies: [],
      journal: [],
      pending_sync: []
    };
  }

  _saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {}
  }

  clearSession() {
    // Clear in-memory session reference
    this.state = {
      farmer_id: null,
      device_id: this.deviceId,
      balance_inr: 0,
      sequence: 0,
      policies: [],
      journal: [],
      pending_sync: []
    };
  }

  _nextSequence() {
    this.state.sequence = (this.state.sequence || 0) + 1;
    return this.state.sequence;
  }

  bindPolicy(product) {
    const seq = this._nextSequence();
    const evt = {
      event_type: 'POLICY_BIND',
      event_id: `EVT_BIND_${seq}`,
      policy_id: product.product_id,
      policy_name: product.name,
      premium_inr: product.premium_inr,
      amount_inr: 0,
      sequence: seq,
      timestamp: new Date().toISOString()
    };
    this.state.policies.push(product);
    this.state.journal.push(evt);
    this.state.pending_sync.push(evt);
    this._saveState();
    return evt;
  }

  creditPayout(payoutAmount, payoutId, policyId) {
    const seq = this._nextSequence();
    this.state.balance_inr += Number(payoutAmount);
    const evt = {
      event_type: 'PAYOUT_CREDIT',
      event_id: `EVT_PAY_${seq}`,
      payout_id: payoutId,
      policy_id: policyId,
      amount_inr: Number(payoutAmount),
      balance_after: this.state.balance_inr,
      sequence: seq,
      timestamp: new Date().toISOString()
    };
    this.state.journal.push(evt);
    this.state.pending_sync.push(evt);
    this._saveState();
    return evt;
  }

  spendOffline(amount, merchantName, purpose) {
    const amt = Number(amount);
    if (amt > this.state.balance_inr) {
      throw new Error(`Insufficient balance (Available: ₹${this.state.balance_inr}, Requested: ₹${amt})`);
    }
    const seq = this._nextSequence();
    this.state.balance_inr -= amt;
    const evt = {
      event_type: 'OFFLINE_SPEND',
      event_id: `EVT_SPEND_${seq}`,
      merchant_id: merchantName,
      purpose: purpose,
      amount_inr: amt,
      balance_after: this.state.balance_inr,
      sequence: seq,
      timestamp: new Date().toISOString()
    };
    this.state.journal.push(evt);
    this.state.pending_sync.push(evt);
    this._saveState();
    return evt;
  }

  getPendingEvents() {
    return this.state.pending_sync || [];
  }

  ackSync(syncedSequence) {
    this.state.pending_sync = this.state.pending_sync.filter(e => e.sequence > syncedSequence);
    this._saveState();
  }

  // Generate Compact Wire Hex Payload (<2KB constraint)
  buildCompactHexPayload() {
    const events = this.state.pending_sync || [];
    const eventCount = events.length;
    const headerSize = 37;
    const eventSize = 25;
    const totalBytes = headerSize + eventCount * eventSize;

    // Use Uint8Array / DataView
    const buffer = new ArrayBuffer(totalBytes);
    const view = new DataView(buffer);
    let offset = 0;

    // Magic "KS"
    view.setUint8(offset++, 0x4b);
    view.setUint8(offset++, 0x53);
    // Version
    view.setUint8(offset++, 1);
    // Device ID 16B
    const devIdStr = (this.deviceId || 'DEV_001').padEnd(16, '\0');
    for (let i = 0; i < 16; i++) {
      view.setUint8(offset++, devIdStr.charCodeAt(i) || 0);
    }
    // User Hash
    const uHash = simpleHash(this.farmerId);
    view.setUint32(offset, uHash, false); offset += 4;
    // Client Sequence
    view.setUint32(offset, this.state.sequence || 0, false); offset += 4;
    // Timestamp
    const tsSec = Math.floor(Date.now() / 1000);
    view.setUint32(offset, tsSec, false); offset += 4;
    // Event Count
    view.setUint16(offset, eventCount, false); offset += 2;
    // Checksum
    view.setUint32(offset, (uHash ^ this.state.sequence ^ tsSec) >>> 0, false); offset += 4;

    const typeMap = { POLICY_BIND: 1, PAYOUT_CREDIT: 2, OFFLINE_SPEND: 3 };

    for (const evt of events) {
      view.setUint8(offset++, typeMap[evt.event_type] || 0);
      view.setUint32(offset, simpleHash(evt.event_id), false); offset += 4;
      view.setUint32(offset, simpleHash(evt.policy_id || evt.payout_id || evt.merchant_id), false); offset += 4;
      view.setInt32(offset, Math.round((evt.amount_inr || 0) * 100), false); offset += 4;
      view.setUint32(offset, evt.sequence || 0, false); offset += 4;
      view.setUint32(offset, Math.floor(new Date(evt.timestamp).getTime() / 1000) || tsSec, false); offset += 4;
    }

    const uint8Array = new Uint8Array(buffer);
    let hexString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      hexString += uint8Array[i].toString(16).padStart(2, '0');
    }

    return {
      raw_bytes: totalBytes,
      hex: hexString,
      event_count: eventCount,
      pass_2kb_limit: totalBytes < 2048
    };
  }
}

function simpleHash(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}
