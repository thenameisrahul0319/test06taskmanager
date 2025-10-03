# Leaders Task Manager - Production Ready

A production-ready task management system built with Node.js, Express, MongoDB, and Socket.IO.

## Features

### Security
- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers
- Role-based access control

### Core Functionality
- **Multi-role system**: Super Admin, Leader, Member
- **Task management**: Create, assign, update, delete tasks
- **User management**: Create and manage team members
- **Real-time updates**: Socket.IO for live notifications
- **Activity logging**: Complete audit trail
- **File attachments**: Support for task attachments
- **Comments**: Task collaboration features

### Production Features
- **Database**: MongoDB with proper indexing
- **Error handling**: Comprehensive error management
- **Logging**: Request and activity logging
- **Validation**: Server-side input validation
- **Pagination**: Efficient data loading
- **Compression**: Response compression
- **Health checks**: System monitoring endpoints

## Installation

### Prerequisites
- Node.js 16+
- MongoDB 4.4+
- npm or yarn

### Setup

1. **Clone and navigate to production directory**
   ```bash
   cd productionready
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   ```bash
   # Start MongoDB
   mongod
   
   # Seed database with sample data
   npm run seed
   ```

5. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/task_manager` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | JWT expiration | `7d` |

### Email Configuration (Optional)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Tasks
- `GET /api/tasks` - Get tasks (filtered by role)
- `POST /api/tasks` - Create task (Leader/Admin only)
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task (Creator/Admin only)
- `POST /api/tasks/:id/comments` - Add comment

### Users
- `GET /api/users` - Get users (Leader/Admin only)
- `POST /api/users` - Create user (Leader/Admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (soft delete)
- `GET /api/users/:id/stats` - Get user statistics

### Activity
- `GET /api/activity` - Get activity log (Leader/Admin only)

## Default Credentials

After running `npm run seed`:

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `admin` | `Admin123!` |
| Leader | `john_leader` | `Password123!` |
| Member | `alice_member` | `Password123!` |
| Member | `bob_member` | `Password123!` |

## Role Permissions

### Super Admin
- Full system access
- Manage all users and tasks
- View all activity logs
- Create leaders and members

### Leader
- Manage team members
- Create and assign tasks to team
- View team activity
- Cannot manage other leaders

### Member
- View assigned tasks
- Update task status
- Add comments to tasks
- View own activity

## Real-time Features

The application uses Socket.IO for real-time updates:

- **Task notifications**: New task assignments
- **Status updates**: Task status changes
- **Live updates**: Automatic UI refresh

## Security Features

### Authentication & Authorization
- JWT tokens with expiration
- Role-based access control
- Password strength requirements
- Secure password hashing

### Input Validation
- Server-side validation for all inputs
- SQL injection prevention
- XSS protection
- File upload restrictions

### Rate Limiting
- API rate limiting (100 requests per 15 minutes)
- Brute force protection
- DDoS mitigation

## Monitoring & Logging

### Health Checks
```bash
GET /api/health
```

### Activity Logging
All user actions are logged with:
- User information
- Action type and description
- Timestamp
- IP address and user agent
- Metadata for changes

### Error Handling
- Comprehensive error catching
- User-friendly error messages
- Server error logging
- Graceful degradation

## Deployment

### Production Checklist

1. **Environment**
   - Set `NODE_ENV=production`
   - Configure secure JWT secret
   - Set up MongoDB replica set
   - Configure HTTPS

2. **Security**
   - Enable firewall
   - Set up SSL certificates
   - Configure reverse proxy (nginx)
   - Enable MongoDB authentication

3. **Monitoring**
   - Set up application monitoring
   - Configure log aggregation
   - Set up database monitoring
   - Configure alerts

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/task_manager
    depends_on:
      - mongo
  
  mongo:
    image: mongo:4.4
    volumes:
      - mongo_data:/data/db
    
volumes:
  mongo_data:
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Performance Optimizations

- **Database indexing** for fast queries
- **Response compression** with gzip
- **Pagination** for large datasets
- **Connection pooling** for MongoDB
- **Static file caching**
- **Minified assets** in production

## Scalability Considerations

- **Horizontal scaling**: Multiple server instances
- **Database sharding**: For large datasets
- **Caching layer**: Redis for session storage
- **CDN**: For static assets
- **Load balancing**: Distribute traffic

## Backup & Recovery

### Database Backup
```bash
# Create backup
mongodump --uri="mongodb://localhost:27017/task_manager"

# Restore backup
mongorestore --uri="mongodb://localhost:27017/task_manager" dump/
```

### File Backup
- Regular backup of uploaded files
- Version control for code
- Configuration backup

## Support & Maintenance

### Regular Tasks
- Monitor system performance
- Update dependencies
- Review security logs
- Database maintenance
- Backup verification

### Troubleshooting
- Check application logs
- Monitor database performance
- Verify network connectivity
- Review error rates

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## Changelog

### v1.0.0
- Initial production release
- Complete authentication system
- Task management features
- User management
- Real-time updates
- Activity logging
- Security hardening