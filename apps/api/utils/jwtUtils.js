const jwt = require('jsonwebtoken');

function getCognitoUserId(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new Error('Missing token');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.username;
}

module.exports = { getCognitoUserId };