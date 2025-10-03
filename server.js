const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/tasks');
const activityRoutes = require('./routes/activity');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : true,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task_manager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('Connected to MongoDB');
  // Auto-seed database if no admin user exists
  await autoSeedDatabase();
})
.catch(err => console.error('MongoDB connection error:', err));

// Auto-seed function
async function autoSeedDatabase() {
  try {
    const User = require('./models/User');
    const adminExists = await User.findOne({ role: 'superadmin' });
    
    if (!adminExists) {
      console.log('No admin user found. Seeding database...');
      const seedData = require('./scripts/seed');
      await seedData();
      console.log('Database auto-seeded successfully!');
    } else {
      console.log('Admin user exists. Skipping auto-seed.');
    }
  } catch (error) {
    console.log('Auto-seed check failed:', error.message);
  }
}

// Socket.IO for real-time updates
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    const jwt = require('jsonwebtoken');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.role = decoded.role;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  } else {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);
  
  socket.join(`user_${socket.userId}`);
  if (socket.role === 'leader') {
    socket.join('leaders');
  }
  if (socket.role === 'superadmin') {
    socket.join('admins');
  }

  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/tasks', authenticateToken, taskRoutes);
app.use('/api/activity', authenticateToken, activityRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Keep-alive endpoint for UptimeRobot
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Keep-alive endpoint
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Self-ping to prevent sleep (only in production)
if (process.env.NODE_ENV === 'production') {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://leaderstaskmanager.onrender.com';
  
  setInterval(async () => {
    try {
      const response = await fetch(`${RENDER_URL}/ping`);
      console.log(`Keep-alive ping: ${response.status}`);
    } catch (error) {
      console.log('Keep-alive ping failed:', error.message);
    }
  }, 14 * 60 * 1000); // Ping every 14 minutes
}

// Manual seed endpoint (remove after first use)
app.get('/api/seed-admin', async (req, res) => {
  try {
    const seedData = require('./scripts/seed');
    await seedData();
    res.json({ message: 'Database seeded successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Seeding failed: ' + error.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;