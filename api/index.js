/**
 * Vercel Serverless Function Handler for KrishiSetu
 * Exports handler to process all /api/*, /healthz, and /metrics requests on Vercel.
 */

const { app } = require('../server');
const { dbManager } = require('../backend/db');

let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    try {
      await dbManager.connect();
      isConnected = true;
    } catch (e) {
      console.error('[Vercel DB Connect Error]', e);
    }
  }
  return app.handle(req, res);
};
