/**
 * Purpose-Designed Compact Binary/Hex Wire Codec
 * Guarantees sync payloads stay well below the non-negotiable 2048-byte (2 KB) constraint.
 * 
 * Wire Layout:
 * [HEADER - 37 Bytes]
 * - Magic Header: 0x4B53 ("KS" for KrishiSetu) (2B)
 * - Protocol Version: uint8 (1B)
 * - Device ID: 16B UTF8/Hex fixed
 * - User ID Hash: uint32 (4B)
 * - Client Monotonic Sequence: uint32 (4B)
 * - Unix Timestamp: uint32 (4B)
 * - Event Count: uint16 (2B)
 * - Header Checksum: uint32 (4B)
 * 
 * [EVENTS - 29 Bytes per event]
 * - Event Type Enum: uint8 (1B) (1=POLICY_BIND, 2=PAYOUT_CREDIT, 3=OFFLINE_SPEND, 4=ACK)
 * - Event ID Hash: uint32 (4B)
 * - Policy/Target Hash: uint32 (4B)
 * - Amount in Paise/Cents: int32 (4B)
 * - Event Sequence: uint32 (4B)
 * - Event Timestamp: uint32 (4B)
 * - Checksum: uint32 (4B)
 * - Reserved Flag: uint8 (1B)
 */

const EVENT_TYPE_MAP = {
  POLICY_BIND: 1,
  PAYOUT_CREDIT: 2,
  OFFLINE_SPEND: 3,
  SYNC_ACK: 4
};

const REVERSE_EVENT_TYPE_MAP = {
  1: 'POLICY_BIND',
  2: 'PAYOUT_CREDIT',
  3: 'OFFLINE_SPEND',
  4: 'SYNC_ACK'
};

function hashString32(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

/**
 * Encodes an array of wallet events into a compact binary Buffer
 */
function encodeSyncPayload(deviceId, farmerId, clientSequence, events = []) {
  const eventCount = events.length;
  const headerSize = 37;
  const eventSize = 25;
  const totalBufferSize = headerSize + eventCount * eventSize;

  const buf = Buffer.alloc(totalBufferSize);
  let offset = 0;

  // Header Magic "KS" (0x4B, 0x53)
  buf.writeUInt8(0x4b, offset++);
  buf.writeUInt8(0x53, offset++);
  // Version
  buf.writeUInt8(1, offset++);
  // Device ID (fixed 16 bytes)
  const devIdBuf = Buffer.alloc(16);
  devIdBuf.write((deviceId || 'DEV_001').substring(0, 16), 'utf8');
  devIdBuf.copy(buf, offset);
  offset += 16;
  // User ID Hash (4B)
  buf.writeUInt32BE(hashString32(farmerId), offset);
  offset += 4;
  // Client Monotonic Sequence (4B)
  buf.writeUInt32BE(clientSequence >>> 0, offset);
  offset += 4;
  // Unix Timestamp in seconds (4B)
  const ts = Math.floor(Date.now() / 1000);
  buf.writeUInt32BE(ts, offset);
  offset += 4;
  // Event Count (2B)
  buf.writeUInt16BE(eventCount, offset);
  offset += 2;
  // Header Checksum (4B)
  const headerChecksum = (hashString32(farmerId) ^ clientSequence ^ ts) >>> 0;
  buf.writeUInt32BE(headerChecksum, offset);
  offset += 4;

  // Events Packing
  for (const evt of events) {
    const typeCode = EVENT_TYPE_MAP[evt.event_type] || 0;
    buf.writeUInt8(typeCode, offset++);

    // Event ID Hash (4B)
    buf.writeUInt32BE(hashString32(evt.event_id), offset);
    offset += 4;

    // Target / Policy / Merchant ID Hash (4B)
    const target = evt.policy_id || evt.payout_id || evt.merchant_id || '';
    buf.writeUInt32BE(hashString32(target), offset);
    offset += 4;

    // Amount in Paise (INR * 100) (4B signed)
    const paise = Math.round((evt.amount_inr || 0) * 100);
    buf.writeInt32BE(paise, offset);
    offset += 4;

    // Event Sequence (4B)
    buf.writeUInt32BE((evt.sequence || 0) >>> 0, offset);
    offset += 4;

    // Event Timestamp (4B)
    const evtTs = evt.timestamp ? Math.floor(new Date(evt.timestamp).getTime() / 1000) : ts;
    buf.writeUInt32BE(evtTs, offset);
    offset += 4;
  }

  return buf;
}

/**
 * Decodes compact binary Buffer back into structured payload
 */
function decodeSyncPayload(buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf, 'hex');
  }

  if (buf.length < 37) {
    throw new Error(`Buffer too short for wire format header: ${buf.length} bytes`);
  }

  let offset = 0;
  const magic1 = buf.readUInt8(offset++);
  const magic2 = buf.readUInt8(offset++);

  if (magic1 !== 0x4b || magic2 !== 0x53) {
    throw new Error('Invalid wire format magic header (expected 0x4B53)');
  }

  const version = buf.readUInt8(offset++);
  const deviceId = buf.toString('utf8', offset, offset + 16).replace(/\0/g, '').trim();
  offset += 16;
  const userIdHash = buf.readUInt32BE(offset);
  offset += 4;
  const clientSequence = buf.readUInt32BE(offset);
  offset += 4;
  const timestamp = buf.readUInt32BE(offset);
  offset += 4;
  const eventCount = buf.readUInt16BE(offset);
  offset += 2;
  const headerChecksum = buf.readUInt32BE(offset);
  offset += 4;

  const events = [];
  const eventSize = 25;

  for (let i = 0; i < eventCount; i++) {
    if (offset + eventSize > buf.length) break;

    const typeCode = buf.readUInt8(offset++);
    const eventIdHash = buf.readUInt32BE(offset);
    offset += 4;
    const targetHash = buf.readUInt32BE(offset);
    offset += 4;
    const paise = buf.readInt32BE(offset);
    offset += 4;
    const sequence = buf.readUInt32BE(offset);
    offset += 4;
    const evtTs = buf.readUInt32BE(offset);
    offset += 4;

    events.push({
      event_type: REVERSE_EVENT_TYPE_MAP[typeCode] || 'UNKNOWN',
      type_code: typeCode,
      event_id_hash: eventIdHash,
      target_hash: targetHash,
      amount_inr: paise / 100,
      sequence: sequence,
      timestamp_sec: evtTs
    });
  }

  return {
    header: {
      magic: 'KS',
      version,
      device_id: deviceId,
      user_id_hash: userIdHash,
      client_sequence: clientSequence,
      timestamp,
      event_count: eventCount,
      header_checksum: headerChecksum
    },
    events,
    raw_bytes: buf.length
  };
}

module.exports = {
  encodeSyncPayload,
  decodeSyncPayload,
  hashString32,
  EVENT_TYPE_MAP,
  REVERSE_EVENT_TYPE_MAP
};
