const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
require('dotenv').config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task_manager');
    
    // Clear existing data
    await User.deleteMany({});
    await Task.deleteMany({});
    
    // Create superadmin
    const superadmin = new User({
      username: 'admin',
      email: 'admin@taskmanager.com',
      password: 'Admin123!',
      fullName: 'System Administrator',
      role: 'superadmin',
      createdBy: null
    });
    
    // Set createdBy to self for superadmin
    await superadmin.save();
    superadmin.createdBy = superadmin._id;
    await superadmin.save();
    
    // Create sample leader
    const leader = new User({
      username: 'john_leader',
      email: 'john@company.com',
      password: 'Password123!',
      fullName: 'John Smith',
      role: 'leader',
      createdBy: superadmin._id
    });
    await leader.save();
    
    // Create sample team members
    const alice = new User({
      username: 'alice_member',
      email: 'alice@company.com',
      password: 'Password123!',
      fullName: 'Alice Johnson',
      role: 'member',
      assignedLeader: leader._id,
      createdBy: leader._id
    });
    await alice.save();
    
    const bob = new User({
      username: 'bob_member',
      email: 'bob@company.com',
      password: 'Password123!',
      fullName: 'Bob Wilson',
      role: 'member',
      assignedLeader: leader._id,
      createdBy: leader._id
    });
    await bob.save();
    
    // Create sample tasks
    const tasks = [
      {
        title: 'Design new landing page',
        description: 'Create a modern, responsive landing page for the new product launch',
        assignedTo: alice._id,
        createdBy: leader._id,
        priority: 'high',
        status: 'in-progress',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      {
        title: 'Update user documentation',
        description: 'Review and update the user manual with latest features',
        assignedTo: bob._id,
        createdBy: leader._id,
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
      },
      {
        title: 'Fix authentication bug',
        description: 'Resolve the login issue reported by users',
        assignedTo: alice._id,
        createdBy: leader._id,
        priority: 'urgent',
        status: 'completed',
        completedAt: new Date()
      }
    ];
    
    await Task.insertMany(tasks);
    
    console.log('Database seeded successfully!');
    console.log('Login credentials:');
    console.log('Superadmin: admin / Admin123!');
    console.log('Leader: john_leader / Password123!');
    console.log('Member: alice_member / Password123!');
    console.log('Member: bob_member / Password123!');
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();