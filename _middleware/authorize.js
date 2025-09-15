const { expressjwt } = require('express-jwt');
const config = require('config.json');
const db = require('_helpers/db');

module.exports = authorize;

function authorize(roles = []) {
  // allow single role string
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return [
    // authenticate JWT token and attach decoded payload to req.user
    expressjwt({
      secret: config.secret,
      algorithms: ['HS256'],
      requestProperty: 'user', // ensure payload is on req.user (not req.auth)
      // support tokens from Authorization header (Bearer) or cookie named 'refreshToken'
      getToken: req => {
        if (req.headers && req.headers.authorization) {
          const parts = req.headers.authorization.split(' ');
          if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
            return parts[1];
          }
        }
        if (req.cookies && req.cookies.refreshToken) {
          return req.cookies.refreshToken;
        }
        return null;
      }
    }),

    // authorize based on user role and attach helper properties
    async (req, res, next) => {
      try {
        // express-jwt should populate req.user; if not, return 401
        if (!req.user) {
          console.error('authorize: no req.user (token missing or invalid)');
          return res.status(401).json({ message: 'Unauthorized' });
        }

        // token payload may use different claim names
        const userId = req.user.id || req.user.sub || req.user.userId;
        if (!userId) {
          console.error('authorize: token missing id/sub/userId claim', req.user);
          return res.status(401).json({ message: 'Unauthorized' });
        }

        // load account from DB
        const account = await db.Account.findByPk(userId);
        if (!account) {
          console.error('authorize: no account found for id', userId);
          return res.status(401).json({ message: 'Unauthorized' });
        }

        // check role if roles were provided
        if (roles.length && !roles.includes(account.role)) {
          console.warn(`authorize: account role "${account.role}" not authorized for ${JSON.stringify(roles)}`);
          return res.status(401).json({ message: 'Unauthorized' });
        }

        // attach role and ownsToken helper to req.user (keep original decoded payload too)
        req.user.role = account.role;
        const refreshTokens = await account.getRefreshTokens();
        req.user.ownsToken = token => !!refreshTokens.find(x => x.token === token);

        next();
      } catch (err) {
        console.error('authorize middleware error:', err);
        // return 500 for unexpected errors
        return res.status(500).json({ message: err.message });
      }
    }
  ];
}
