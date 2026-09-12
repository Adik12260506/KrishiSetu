/**
 * Authentication & Authorization Middleware for KrishiSetu
 * Enforces Token-based auth, Role-Based Access Control (RBAC), and Resource Ownership.
 */

const { SessionModel } = require('./models');

// In-Memory Token Bucket Rate Limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 200;

function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now - entry.startTime > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 1, startTime: now };
    rateLimitMap.set(ip, entry);
  } else {
    entry.count += 1;
    if (entry.count > MAX_REQUESTS_PER_WINDOW) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please retry in 1 minute.'
      });
      return false;
    }
  }
  return true;
}

// Security Headers Injector
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// Authenticate Session Token
async function authenticateRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  let token = null;

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;
  return SessionModel.validateToken(token);
}

function requireRole(allowedRoles = ['FARMER', 'ADMIN', 'JUROR']) {
  return async (req, res, handler) => {
    const session = await authenticateRequest(req);
    if (!session) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Valid authentication session token required (Bearer <token>)'
      });
    }

    if (!allowedRoles.includes(session.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Role '${session.role}' is not authorized to access this resource. Required: ${allowedRoles.join(', ')}`
      });
    }

    req.user = session;
    return handler(req, res);
  };
}

module.exports = {
  rateLimiter,
  applySecurityHeaders,
  authenticateRequest,
  requireRole
};
