const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const { requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get users
router.get('/', requireRole(['leader', 'superadmin']), asyncHandler(async (req, res) => {
  let query = { isActive: true };
  
  if (req.user.role === 'leader') {
    // Leaders can only see their team members
    query.assignedLeader = req.user._id;
  }
  
  const users = await User.find(query)
    .populate('assignedLeader', 'fullName username')
    .select('-password')
    .sort({ createdAt: -1 });
    
  res.json(users);
}));

// Create user
router.post('/', [
  requireRole(['leader', 'superadmin']),
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
  
  // Role-based restrictions
  if (req.user.role === 'leader') {
    if (role === 'leader') {
      return res.status(403).json({ error: 'Leaders cannot create other leaders' });
    }
    // Auto-assign to current leader
    req.body.assignedLeader = req.user._id;
  }

  const user = new User({
    username,
    email,
    password,
    fullName,
    role,
    assignedLeader: req.body.assignedLeader || null,
    createdBy: req.user._id
  });

  await user.save();

  // Log activity
  await Activity.create({
    type: 'create_user',
    user: req.user._id,
    targetUser: user._id,
    description: `Created ${role}: ${fullName}`
  });

  res.status(201).json({
    message: 'User created successfully',
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

// Update user
router.put('/:id', [
  requireRole(['leader', 'superadmin']),
  body('email').optional().isEmail(),
  body('fullName').optional().notEmpty(),
  body('role').optional().isIn(['leader', 'member'])
], asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Permission check
  if (req.user.role === 'leader') {
    if (user.assignedLeader?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Can only update your team members' });
    }
    if (req.body.role === 'leader') {
      return res.status(403).json({ error: 'Cannot promote to leader' });
    }
  }

  const updates = req.body;
  Object.keys(updates).forEach(key => {
    if (key !== 'password') {
      user[key] = updates[key];
    }
  });

  await user.save();

  // Log activity
  await Activity.create({
    type: 'update_user',
    user: req.user._id,
    targetUser: user._id,
    description: `Updated user: ${user.fullName}`,
    metadata: updates
  });

  res.json({
    message: 'User updated successfully',
    user: user.toJSON()
  });
}));

// Delete user
router.delete('/:id', requireRole(['leader', 'superadmin']), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Permission check
  if (req.user.role === 'leader') {
    if (user.assignedLeader?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Can only delete your team members' });
    }
    if (user.role === 'leader') {
      return res.status(403).json({ error: 'Cannot delete other leaders' });
    }
  }

  // Soft delete
  user.isActive = false;
  await user.save();

  // Unassign tasks
  await Task.updateMany(
    { assignedTo: user._id },
    { $unset: { assignedTo: 1 }, status: 'pending' }
  );

  // Log activity
  await Activity.create({
    type: 'delete_user',
    user: req.user._id,
    targetUser: user._id,
    description: `Deleted user: ${user.fullName}`
  });

  res.json({ message: 'User deleted successfully' });
}));

// Get user stats
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const stats = await Task.aggregate([
    { $match: { assignedTo: user._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const taskStats = {
    total: 0,
    pending: 0,
    'in-progress': 0,
    completed: 0,
    cancelled: 0
  };

  stats.forEach(stat => {
    taskStats[stat._id] = stat.count;
    taskStats.total += stat.count;
  });

  res.json(taskStats);
}));

module.exports = router;