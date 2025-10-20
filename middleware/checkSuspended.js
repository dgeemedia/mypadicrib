const db = require('../models/db');

module.exports = () => {
  return async function checkSuspended(req, res, next) {
    try {
      if (!req.user) return next();

      // if status field exists on req.user
      if (req.user.status === 'suspended') {
        const until = req.user.suspended_until ? new Date(req.user.suspended_until) : null;
        const now = new Date();

        if (until && until <= now) {
          // auto-reactivate (one-off update on first request after expiry)
          await db.none('UPDATE users SET status=$1, suspended_until=NULL WHERE id=$2', ['active', req.user.id]);
          req.user.status = 'active';
          req.user.suspended_until = null;
          return next();
        }

        // still suspended
        const msg = until ? `Account suspended until ${until.toLocaleString()}` : 'Account suspended';
        req.flash('error', msg);
        return res.redirect('/support'); // change to your suspension support page
      }
      return next();
    } catch (err) {
      console.error('checkSuspended middleware error', err);
      return next(err);
    }
  };
};
