const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Login
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  const user = await User.findOne({
    $or: [{ username }, { email: username }],
    isActive: true
  });

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Log activity
  await Activity.create({
    type: 'login',
    user: user._id,
    description: `User logged in`,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      assignedLeader: user.assignedLeader
    }
  });
}));

// Register (only for superadmin)
router.post('/register', [
  body('username').isLength({ min: 3 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Invalid username'),
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('role').isIn(['leader', 'member']).withMessage('Invalid role')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, fullName, role, assignedLeader } = req.body;

  const user = new User({
    username,
    email,
    password,
    fullName,
    role,
    assignedLeader: assignedLeader || null,
    createdBy: req.user ? req.user._id : null
  });

  await user.save();

  res.status(201).json({
    message: 'User created successfully',
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }
  });
}));

// Logout
router.post('/logout', asyncHandler(async (req, res) => {
  // In a production app, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' });
}));

module.exports = router;