const jwt = require('jsonwebtoken');
require('dotenv').config();

const secretKey = process.env.SECRET_KEY;

// Generate JWT token
function generateToken(payload) {
  // Use the jwt.sign method with the payload, secret key, and options (including algorithm)
  const token = jwt.sign(payload, secretKey, {
    algorithm: 'HS256', // The symmetric algorithm
    expiresIn: '3h'     // Token expiration time
  });
  return token;
}

// Verify the JWT token
function verifyToken(token) {
  try {
    // Use the jwt.verify method with the token and the same secret key
    const decoded = jwt.verify(token, secretKey);
    return true;
  } catch (err) {
    // Handle specific errors like expiration, invalid signature, etc.
    return false;
  }
  return true;
}

// Check if cookie exists and is appropriate in request
function validCookie(req) {
  if (!req.cookies || !req.cookies.token) return false;
  if (typeof req.cookies.token !== 'string') return false;
  return true;
}

// A middleware that checks if req.cookies.token is string type
// and verify using verifyToken() function
function requireAuthentication(req, res, next) {
  if (!validCookie(req)) {
    res.redirect('/login');
    return;
  }

  if (verifyToken(req.cookies.token) === false) {
      res.clearCookie('token').redirect('/login');
      return;
  }

  next();
}

// Checks login based on data type of req.cookies.token
function requireNoAuthentication(req, res, next) {
  if (!validCookie(req)) {
    next();
    return;
  }

  if (typeof req.cookies.token === 'string') {
    if (verifyToken(req.cookies.token)) {
      res.status(403);
      res.send('you are already logged in.');
      return;
    }
  }

  next();
}

module.exports = {
  generateToken,
  verifyToken,
  validCookie,
  requireAuthentication,
  requireNoAuthentication
};