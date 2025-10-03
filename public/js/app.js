class TaskManagerApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = null;
        this.socket = null;
        this.init();
    }

    async init() {
        if (this.token) {
            try {
                await this.validateToken();
                this.showMainApp();
                this.initSocket();
                this.bindEvents();
                await this.loadDashboard();
            } catch (error) {
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    }

    showLoadingScreen() {
        const loadingHTML = `
            <div id="loadingScreen" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                color: white;
            ">
                <div style="text-align: center;">
                    <div style="
                        width: 50px;
                        height: 50px;
                        border: 3px solid rgba(255,255,255,0.3);
                        border-top: 3px solid white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    "></div>
                    <h2 style="margin: 0 0 10px 0;">Leaders Task Manager</h2>
                    <p style="margin: 0; opacity: 0.8;">Starting up server...</p>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loadingHTML);
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.remove();
        }
    }

    async validateToken() {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        const data = await response.json();
        this.user = data.user;
    }

    showLogin() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
        this.bindLoginEvents();
    }

    showMainApp() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
    }

    bindLoginEvents() {
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                this.showMainApp();
                this.initSocket();
                this.bindEvents();
                await this.loadDashboard();
                this.showSuccess('Login successful!');
            } else {
                this.showError(data.error || 'Login failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    initSocket() {
        this.socket = io({
            auth: { token: this.token }
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('new_task', (task) => {
            this.showNotification(`New task assigned: ${task.title}`);
            this.loadTasks();
        });

        this.socket.on('task_updated', (task) => {
            this.showNotification(`Task updated: ${task.title}`);
            this.loadTasks();
        });
    }

    bindEvents() {
        // Prevent duplicate event listeners
        if (this.eventsbound) return;
        this.eventsbound = true;

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Modal events
        document.querySelectorAll('.close').forEach(close => {
            close.addEventListener('click', () => {
                this.closeModals();
            });
        });

        // Task form - remove existing listeners first
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            const newTaskForm = taskForm.cloneNode(true);
            taskForm.parentNode.replaceChild(newTaskForm, taskForm);
            newTaskForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleTaskSubmit();
            });
        }

        // User form - remove existing listeners first
        const userForm = document.getElementById('userForm');
        if (userForm) {
            const newUserForm = userForm.cloneNode(true);
            userForm.parentNode.replaceChild(newUserForm, userForm);
            newUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleUserSubmit();
            });
        }

        // Add task button
        const addTaskBtn = document.getElementById('addTaskBtn');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                this.openTaskModal();
            });
        }

        // Add user button
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                this.openUserModal();
            });
        }

        // Filters
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.loadTasks();
        });

        document.getElementById('priorityFilter').addEventListener('change', () => {
            this.loadTasks();
        });

        // Cancel buttons
        document.getElementById('cancelTaskBtn').addEventListener('click', () => {
            this.closeModals();
        });

        document.getElementById('cancelUserBtn').addEventListener('click', () => {
            this.closeModals();
        });

        // User role change
        document.getElementById('userRole').addEventListener('change', (e) => {
            const assignLeaderGroup = document.getElementById('assignLeaderGroup');
            if (e.target.value === 'member') {
                assignLeaderGroup.style.display = 'block';
                this.loadLeaders();
            } else {
                assignLeaderGroup.style.display = 'none';
            }
        });

        this.updateUIForRole();
    }

    updateUIForRole() {
        if (!this.user) return;

        document.getElementById('welcomeText').textContent = `Welcome, ${this.user.fullName}`;

        // Show/hide tabs based on role
        if (this.user.role === 'superadmin' || this.user.role === 'leader') {
            document.getElementById('usersTab').style.display = 'flex';
            document.getElementById('activityTab').style.display = 'flex';
            document.getElementById('addTaskBtn').style.display = 'inline-flex';
        }

        if (this.user.role === 'superadmin' || this.user.role === 'leader') {
            document.getElementById('addUserBtn').style.display = 'inline-flex';
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Load content based on tab
        switch (tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'tasks':
                this.loadTasks();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'activity':
                this.loadActivity();
                break;
        }
    }

    async loadDashboard() {
        try {
            const [tasksResponse, activityResponse] = await Promise.all([
                fetch('/api/tasks', {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }),
                fetch('/api/activity?limit=5', {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                })
            ]);

            const tasksData = await tasksResponse.json();
            const activityData = await activityResponse.json();

            this.updateStats(tasksData.tasks);
            this.renderRecentActivity(activityData.activities);
        } catch (error) {
            this.showError('Failed to load dashboard');
        }
    }

    updateStats(tasks) {
        const stats = {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            'in-progress': tasks.filter(t => t.status === 'in-progress').length,
            completed: tasks.filter(t => t.status === 'completed').length
        };

        document.getElementById('totalTasks').textContent = stats.total;
        document.getElementById('pendingTasks').textContent = stats.pending;
        document.getElementById('inProgressTasks').textContent = stats['in-progress'];
        document.getElementById('completedTasks').textContent = stats.completed;
    }

    renderRecentActivity(activities) {
        const container = document.getElementById('recentActivityList');
        container.innerHTML = '';

        if (activities.length === 0) {
            container.innerHTML = '<p>No recent activity</p>';
            return;
        }

        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="activity-icon activity-${activity.type}">
                    <i class="fas fa-${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.description}</div>
                    <div class="activity-meta">${activity.user.fullName} • ${new Date(activity.createdAt).toLocaleString()}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    async loadTasks() {
        try {
            const status = document.getElementById('statusFilter').value;
            const priority = document.getElementById('priorityFilter').value;
            
            let url = '/api/tasks?';
            if (status) url += `status=${status}&`;
            if (priority) url += `priority=${priority}&`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            this.renderTasks(data.tasks);
        } catch (error) {
            this.showError('Failed to load tasks');
        }
    }

    renderTasks(tasks) {
        const container = document.getElementById('tasksList');
        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = '<p>No tasks found</p>';
            return;
        }

        tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card priority-${task.priority}`;
            
            const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
            // Debug logging
            console.log('User:', this.user);
            console.log('Task:', task);
            
            // Superadmin has full access, others check specific permissions
            const canEdit = this.user.role === 'superadmin' || 
                           task.createdBy._id === this.user.id || 
                           task.assignedTo._id === this.user.id;
            
            const canDelete = this.user.role === 'superadmin' || 
                             task.createdBy._id === this.user.id;
            
            console.log('canEdit:', canEdit, 'canDelete:', canDelete);

            card.innerHTML = `
                <div class="task-header">
                    <div>
                        <div class="task-title">${task.title}</div>
                        <div class="task-meta">
                            <span><i class="fas fa-user"></i> ${task.assignedTo.fullName}</span>
                            <span><i class="fas fa-calendar"></i> ${dueDate}</span>
                            <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                        </div>
                    </div>
                    ${canEdit ? `
                        <div style="display: flex; gap: 10px;">
                            <button onclick="app.editTask('${task._id}')" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${canDelete ? `
                                <button onclick="app.deleteTask('${task._id}')" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; background: #fed7d7; color: #c53030;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                <div class="task-actions">
                    <div>
                        <small style="color: #718096;">Created by ${task.createdBy.fullName}</small>
                    </div>
                    <div>
                        ${task.assignedTo._id === this.user.id ? `
                            <select class="status-selector" onchange="app.updateTaskStatus('${task._id}', this.value)">
                                <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        ` : `
                            <span class="status-badge status-${task.status}">${task.status.replace('-', ' ')}</span>
                        `}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const users = await response.json();
            this.renderUsers(users);
        } catch (error) {
            this.showError('Failed to load users');
        }
    }

    renderUsers(users) {
        const container = document.getElementById('usersList');
        container.innerHTML = '';

        if (users.length === 0) {
            container.innerHTML = '<p>No users found</p>';
            return;
        }

        users.forEach(user => {
            const card = document.createElement('div');
            card.className = `user-card role-${user.role}`;
            
            const canEdit = this.user.role === 'superadmin' || 
                           (this.user.role === 'leader' && user.assignedLeader === this.user.id);

            card.innerHTML = `
                <div class="user-header">
                    <div>
                        <div class="user-name">${user.fullName}</div>
                        <div style="font-size: 12px; color: #718096;">@${user.username}</div>
                    </div>
                    <span class="user-role role-${user.role}">${user.role}</span>
                </div>
                <div class="user-info">
                    <div><strong>Email:</strong> ${user.email}</div>
                    ${user.assignedLeader ? `<div><strong>Leader:</strong> ${user.assignedLeader.fullName}</div>` : ''}
                    <div><strong>Created:</strong> ${new Date(user.createdAt).toLocaleDateString()}</div>
                </div>
                ${canEdit ? `
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button onclick="app.editUser('${user._id}')" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button onclick="app.deleteUser('${user._id}')" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; background: #fed7d7; color: #c53030;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                ` : ''}
            `;
            container.appendChild(card);
        });
    }

    async loadActivity() {
        try {
            const response = await fetch('/api/activity', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            this.renderActivity(data.activities);
        } catch (error) {
            this.showError('Failed to load activity');
        }
    }

    renderActivity(activities) {
        const container = document.getElementById('activityList');
        container.innerHTML = '';

        if (activities.length === 0) {
            container.innerHTML = '<p>No activity found</p>';
            return;
        }

        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="activity-icon activity-${activity.type}">
                    <i class="fas fa-${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.description}</div>
                    <div class="activity-meta">${activity.user.fullName} • ${new Date(activity.createdAt).toLocaleString()}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    getActivityIcon(type) {
        const icons = {
            'create_task': 'plus',
            'update_task': 'edit',
            'delete_task': 'trash',
            'create_user': 'user-plus',
            'update_user': 'user-edit',
            'delete_user': 'user-minus',
            'login': 'sign-in-alt',
            'comment': 'comment'
        };
        return icons[type] || 'info';
    }

    openTaskModal(task = null) {
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        
        if (task) {
            document.getElementById('taskModalTitle').textContent = 'Edit Task';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskAssignedTo').value = task.assignedTo._id;
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskDueDate').value = task.dueDate ? task.dueDate.split('T')[0] : '';
            form.dataset.taskId = task._id;
        } else {
            document.getElementById('taskModalTitle').textContent = 'Add New Task';
            form.reset();
            delete form.dataset.taskId;
        }
        
        this.loadAssignableUsers();
        modal.style.display = 'block';
    }

    openUserModal(user = null) {
        const modal = document.getElementById('userModal');
        const form = document.getElementById('userForm');
        
        if (user) {
            document.getElementById('userModalTitle').textContent = 'Edit User';
            document.getElementById('userUsername').value = user.username;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userFullName').value = user.fullName;
            document.getElementById('userRole').value = user.role;
            document.getElementById('userPassword').required = false;
            form.dataset.userId = user._id;
        } else {
            document.getElementById('userModalTitle').textContent = 'Add New User';
            form.reset();
            document.getElementById('userPassword').required = true;
            delete form.dataset.userId;
        }
        
        modal.style.display = 'block';
    }

    async loadAssignableUsers() {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const users = await response.json();
            const select = document.getElementById('taskAssignedTo');
            select.innerHTML = '<option value="">Select user</option>';
            
            users.forEach(user => {
                if (user.role === 'member') {
                    const option = document.createElement('option');
                    option.value = user._id;
                    option.textContent = user.fullName;
                    select.appendChild(option);
                }
            });
        } catch (error) {
            this.showError('Failed to load users');
        }
    }

    async loadLeaders() {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const users = await response.json();
            const select = document.getElementById('userAssignedLeader');
            select.innerHTML = '<option value="">Select leader</option>';
            
            users.forEach(user => {
                if (user.role === 'leader') {
                    const option = document.createElement('option');
                    option.value = user._id;
                    option.textContent = user.fullName;
                    select.appendChild(option);
                }
            });
        } catch (error) {
            this.showError('Failed to load leaders');
        }
    }

    async handleTaskSubmit() {
        // Prevent multiple submissions
        if (this.submitting) return;
        this.submitting = true;

        const form = document.getElementById('taskForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        const taskData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            assignedTo: document.getElementById('taskAssignedTo').value,
            priority: document.getElementById('taskPriority').value,
            dueDate: document.getElementById('taskDueDate').value || null
        };

        try {
            const url = form.dataset.taskId ? `/api/tasks/${form.dataset.taskId}` : '/api/tasks';
            const method = form.dataset.taskId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(taskData)
            });

            const data = await response.json();

            if (response.ok) {
                this.closeModals();
                this.loadTasks();
                this.showSuccess(form.dataset.taskId ? 'Task updated successfully' : 'Task created successfully');
            } else {
                this.showError(data.error || 'Failed to save task');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Task';
            this.submitting = false;
        }
    }

    async handleUserSubmit() {
        const form = document.getElementById('userForm');
        
        const userData = {
            username: document.getElementById('userUsername').value,
            email: document.getElementById('userEmail').value,
            fullName: document.getElementById('userFullName').value,
            role: document.getElementById('userRole').value,
            assignedLeader: document.getElementById('userAssignedLeader').value || null
        };

        if (document.getElementById('userPassword').value) {
            userData.password = document.getElementById('userPassword').value;
        }

        try {
            const url = form.dataset.userId ? `/api/users/${form.dataset.userId}` : '/api/users';
            const method = form.dataset.userId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                this.closeModals();
                this.loadUsers();
                this.showSuccess(form.dataset.userId ? 'User updated successfully' : 'User created successfully');
            } else {
                this.showError(data.error || 'Failed to save user');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    async updateTaskStatus(taskId, status) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ status })
            });

            if (response.ok) {
                this.loadTasks();
                this.showSuccess('Task status updated');
            } else {
                this.showError('Failed to update task status');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    async editTask(taskId) {
        try {
            const response = await fetch(`/api/tasks`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            const task = data.tasks.find(t => t._id === taskId);
            
            if (task) {
                this.openTaskModal(task);
            }
        } catch (error) {
            this.showError('Failed to load task');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.loadTasks();
                this.showSuccess('Task deleted successfully');
            } else {
                this.showError('Failed to delete task');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    async editUser(userId) {
        try {
            const response = await fetch(`/api/users`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const users = await response.json();
            const user = users.find(u => u._id === userId);
            
            if (user) {
                this.openUserModal(user);
            }
        } catch (error) {
            this.showError('Failed to load user');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.loadUsers();
                this.showSuccess('User deleted successfully');
            } else {
                this.showError('Failed to delete user');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    logout() {
        localStorage.removeItem('token');
        this.token = null;
        this.user = null;
        this.eventsbound = false; // Reset events flag
        if (this.socket) {
            this.socket.disconnect();
        }
        this.showLogin();
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type) {
        const existing = document.querySelector('.error-message, .success-message');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.className = type === 'error' ? 'error-message' : 'success-message';
        div.textContent = message;
        
        const container = document.querySelector('.main-content') || document.querySelector('.login-card');
        container.insertBefore(div, container.firstChild);

        setTimeout(() => div.remove(), 5000);
    }

    showNotification(message) {
        // Simple notification - in production, use a proper notification library
        if (Notification.permission === 'granted') {
            new Notification('Task Manager', { body: message });
        }
    }
}

// Initialize app
const app = new TaskManagerApp();

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}