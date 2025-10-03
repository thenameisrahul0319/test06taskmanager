const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get tasks
router.get('/', asyncHandler(async (req, res) => {
  const { status, priority, assignedTo, page = 1, limit = 10 } = req.query;
  
  let query = {};
  
  // Role-based filtering
  if (req.user.role === 'member') {
    query.assignedTo = req.user._id;
  } else if (req.user.role === 'leader') {
    const teamMembers = await User.find({ assignedLeader: req.user._id }).select('_id');
    const memberIds = teamMembers.map(m => m._id);
    query.$or = [
      { createdBy: req.user._id },
      { assignedTo: { $in: memberIds } }
    ];
  }
  
  // Apply filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;
  
  const tasks = await Task.find(query)
    .populate('assignedTo', 'fullName username')
    .populate('createdBy', 'fullName username')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
  const total = await Task.countDocuments(query);
  
  res.json({
    tasks,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total
  });
}));

// Create task
router.post('/', [
  requireRole(['leader', 'superadmin']),
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and must be under 200 characters'),
  body('assignedTo').isMongoId().withMessage('Valid assignedTo ID required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('dueDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description, assignedTo, priority, dueDate } = req.body;
  
  // Verify assigned user exists and is accessible
  const assignedUser = await User.findById(assignedTo);
  if (!assignedUser) {
    return res.status(404).json({ error: 'Assigned user not found' });
  }
  
  if (req.user.role === 'leader' && assignedUser.assignedLeader?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Can only assign tasks to your team members' });
  }

  const task = new Task({
    title,
    description,
    assignedTo,
    createdBy: req.user._id,
    priority: priority || 'medium',
    dueDate: dueDate ? new Date(dueDate) : null
  });

  await task.save();
  await task.populate('assignedTo', 'fullName username');
  await task.populate('createdBy', 'fullName username');

  // Log activity
  await Activity.create({
    type: 'create_task',
    user: req.user._id,
    targetTask: task._id,
    description: `Created task: ${title}`,
    metadata: { assignedTo: assignedUser.fullName }
  });

  // Real-time notification
  const io = req.app.get('io');
  io.to(`user_${assignedTo}`).emit('new_task', task);
  io.to('leaders').emit('task_created', task);

  res.status(201).json(task);
}));

// Update task
router.put('/:id', [
  body('title').optional().isLength({ max: 200 }),
  body('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Permission check
  const canEdit = req.user.role === 'superadmin' || 
                  task.createdBy.toString() === req.user._id.toString() ||
                  task.assignedTo.toString() === req.user._id.toString();
  
  if (!canEdit) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  const updates = req.body;
  Object.keys(updates).forEach(key => {
    task[key] = updates[key];
  });

  if (updates.status === 'completed') {
    task.completedAt = new Date();
  }

  await task.save();
  await task.populate('assignedTo', 'fullName username');
  await task.populate('createdBy', 'fullName username');

  // Log activity
  await Activity.create({
    type: 'update_task',
    user: req.user._id,
    targetTask: task._id,
    description: `Updated task: ${task.title}`,
    metadata: updates
  });

  // Real-time update
  const io = req.app.get('io');
  io.to(`user_${task.assignedTo._id}`).emit('task_updated', task);
  io.to('leaders').emit('task_updated', task);

  res.json(task);
}));

// Delete task
router.delete('/:id', asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Permission check
  const canDelete = req.user.role === 'superadmin' || 
                    task.createdBy.toString() === req.user._id.toString();
  
  if (!canDelete) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  await Task.findByIdAndDelete(req.params.id);

  // Log activity
  await Activity.create({
    type: 'delete_task',
    user: req.user._id,
    description: `Deleted task: ${task.title}`
  });

  res.json({ message: 'Task deleted successfully' });
}));

// Add comment
router.post('/:id/comments', [
  body('text').notEmpty().isLength({ max: 500 }).withMessage('Comment text is required and must be under 500 characters')
], asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  task.comments.push({
    user: req.user._id,
    text: req.body.text
  });

  await task.save();
  await task.populate('comments.user', 'fullName username');

  res.json(task.comments[task.comments.length - 1]);
}));

module.exports = router;