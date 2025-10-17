// middleware/flash.js
module.exports = (req, res, next) => {
  res.locals.success = req.session && req.session.success ? req.session.success : null;
  res.locals.error = req.session && req.session.error ? req.session.error : null;
  res.locals.messages = function() {
    let out = '';
    const s = req.flash('success') || [];
    const e = req.flash('error') || [];
    s.forEach(m => out += '<div class="flash success">' + m + '</div>');
    e.forEach(m => out += '<div class="flash error">' + m + '</div>');
    return out;
  };
  next();
};
