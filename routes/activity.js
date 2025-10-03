const express = require('express');
const Activity = require('../models/Activity');
const { requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get activity log
router.get('/', requireRole(['leader', 'superadmin']), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, userId } = req.query;
  
  let query = {};
  
  // Role-based filtering
  if (req.user.role === 'leader') {
    // Leaders can only see activities related to their team
    const User = require('../models/User');
    const teamMembers = await User.find({ assignedLeader: req.user._id }).select('_id');
    const memberIds = teamMembers.map(m => m._id);
    memberIds.push(req.user._id); // Include leader's own activities
    
    query.user = { $in: memberIds };
  }
  
  if (type) query.type = type;
  if (userId) query.user = userId;
  
  const activities = await Activity.find(query)
    .populate('user', 'fullName username')
    .populate('targetUser', 'fullName username')
    .populate('targetTask', 'title')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
  const total = await Activity.countDocuments(query);
  
  res.json({
    activities,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total
  });
}));

module.exports = router;