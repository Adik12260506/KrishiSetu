/**
 * MongoDB Database Adapter for KrishiSetu
 * Connects to MongoDB via standard mongodb client with indexing and resilient persistent adapter fallback.
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'krishisetu_db';
const LOCAL_STORAGE_FILE = path.join(__dirname, '..', 'local_mongodb_data.json');

class LocalMongoCollection {
  constructor(name, getDbData, saveDbData, uniqueKeys = []) {
    this.name = name;
    this.getDbData = getDbData;
    this.saveDbData = saveDbData;
    this.uniqueKeys = uniqueKeys;
  }

  async find(query = {}) {
    const data = this.getDbData()[this.name] || [];
    const filtered = data.filter(item => matchQuery(item, query));
    return {
      toArray: async () => JSON.parse(JSON.stringify(filtered))
    };
  }

  async findOne(query = {}) {
    const data = this.getDbData()[this.name] || [];
    const item = data.find(it => matchQuery(it, query));
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async insertOne(doc) {
    const dbData = this.getDbData();
    if (!dbData[this.name]) dbData[this.name] = [];

    // Enforce unique constraints
    for (const key of this.uniqueKeys) {
      if (doc[key]) {
        const duplicate = dbData[this.name].find(existing => existing[key] === doc[key]);
        if (duplicate) {
          const err = new Error(`E11000 duplicate key error: Collection '${this.name}' key '${key}' duplicate value '${doc[key]}'`);
          err.code = 11000;
          throw err;
        }
      }
    }

    const toInsert = {
      _id: doc._id || doc.product_id || doc.payout_id || doc.event_id || doc.farmer_id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...doc
    };
    dbData[this.name].push(toInsert);
    this.saveDbData(dbData);
    return { insertedId: toInsert._id, acknowledged: true };
  }

  async updateOne(query, update, options = {}) {
    const dbData = this.getDbData();
    if (!dbData[this.name]) dbData[this.name] = [];
    const idx = dbData[this.name].findIndex(it => matchQuery(it, query));
    if (idx !== -1) {
      if (update.$set) {
        dbData[this.name][idx] = { ...dbData[this.name][idx], ...update.$set };
      } else {
        dbData[this.name][idx] = { ...dbData[this.name][idx], ...update };
      }
      this.saveDbData(dbData);
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
    } else if (options.upsert) {
      const newDoc = { ...(update.$set || update), ...query };
      return this.insertOne(newDoc);
    }
    return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
  }

  async deleteMany(query = {}) {
    const dbData = this.getDbData();
    if (!dbData[this.name]) return { deletedCount: 0 };
    const originalLen = dbData[this.name].length;
    dbData[this.name] = dbData[this.name].filter(it => !matchQuery(it, query));
    this.saveDbData(dbData);
    return { deletedCount: originalLen - dbData[this.name].length, acknowledged: true };
  }

  async createIndex(keys, options = {}) {
    if (options.unique) {
      for (const k of Object.keys(keys)) {
        if (!this.uniqueKeys.includes(k)) {
          this.uniqueKeys.push(k);
        }
      }
    }
    return 'index_created';
  }
}

function matchQuery(item, query) {
  for (const [k, v] of Object.entries(query)) {
    if (item[k] !== v) return false;
  }
  return true;
}

class DatabaseManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isMongoConnected = false;
    this.mode = 'PENDING';
    this.localData = this._loadLocalData();
    this.uniqueKeyMap = {
      users: ['user_id'],
      sessions: ['token'],
      policies: ['product_id'],
      payouts: ['payout_id', 'decision_id'],
      sync_events: ['event_id']
    };
  }

  _loadLocalData() {
    try {
      if (fs.existsSync(LOCAL_STORAGE_FILE)) {
        return JSON.parse(fs.readFileSync(LOCAL_STORAGE_FILE, 'utf8') || '{}');
      }
    } catch (e) {}
    return { users: [], sessions: [], policies: [], farmers: [], payouts: [], sync_events: [], oracle_logs: [] };
  }

  _saveLocalData(data) {
    this.localData = data;
    try {
      fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
  }

  async connect() {
    try {
      this.client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 1500 });
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      this.isMongoConnected = true;
      this.mode = 'MONGODB_LIVE';
      console.log(`[KrishiSetu DB] Connected to MongoDB database: "${DB_NAME}" at ${MONGODB_URI}`);
      await this._initMongoIndexes();
    } catch (err) {
      this.isMongoConnected = false;
      this.mode = 'MONGODB_PERSISTENT_ADAPTER';
      console.log(`[KrishiSetu DB] MongoDB server not active at ${MONGODB_URI}. Active mode: MongoDB-Compatible Persistent Document Store with Unique Indexes.`);
    }
  }

  async _initMongoIndexes() {
    if (!this.db) return;
    try {
      await this.db.collection('users').createIndex({ user_id: 1 }, { unique: true });
      await this.db.collection('sessions').createIndex({ token: 1 }, { unique: true });
      await this.db.collection('policies').createIndex({ product_id: 1, version: 1 }, { unique: true });
      await this.db.collection('payouts').createIndex({ payout_id: 1 }, { unique: true });
      await this.db.collection('payouts').createIndex({ decision_id: 1 }, { unique: true });
      await this.db.collection('sync_events').createIndex({ event_id: 1 }, { unique: true });
      await this.db.collection('sync_events').createIndex({ user_id: 1, sequence: 1 });
    } catch (e) {
      console.error('[KrishiSetu DB] Index creation warning:', e.message);
    }
  }

  collection(name) {
    if (this.isMongoConnected && this.db) {
      return this.db.collection(name);
    }
    const uniqueKeys = this.uniqueKeyMap[name] || [];
    return new LocalMongoCollection(name, () => this.localData, (d) => this._saveLocalData(d), uniqueKeys);
  }

  getStatus() {
    return {
      connected: this.isMongoConnected,
      mode: this.mode,
      database: DB_NAME,
      uri: MONGODB_URI,
      collections_indexed: Object.keys(this.uniqueKeyMap)
    };
  }
}

const dbManager = new DatabaseManager();

module.exports = {
  dbManager,
  DatabaseManager
};
