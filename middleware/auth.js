const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const requireOwnership = (resourceField = 'createdBy') => {
  return (req, res, next) => {
    if (req.user.role === 'superadmin') {
      return next();
    }
    
    if (req.resource && req.resource[resourceField].toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnership
};