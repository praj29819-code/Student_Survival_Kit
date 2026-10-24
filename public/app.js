/**
 * ============================================================================
 * Student Survival Kit (SSK) — Frontend Application Engine
 * Vanilla JavaScript (ES6+), Chart.js, Canvas Confetti, Kanban Drag-and-Drop,
 * Live Countdowns, and AI Assistant.
 * ============================================================================
 */

(function () {
  'use strict';

  // ==========================================================================
  // Global State
  // ==========================================================================
  const state = {
    activeView: 'dashboard',
    theme: localStorage.getItem('ssk_theme') || 'dark',
    asgViewMode: 'kanban', // 'kanban' or 'grid'
    user: null,
    dashboard: null,
    assignments: [],
    attendance: [],
    exams: [],
    tasks: [],
    calendarDate: new Date(),
    selectedDateStr: null,
    chartInstance: null,
    countdownInterval: null
  };

  // Base API configuration (routes served directly by Crow / companion server)
  const API_BASE = '';

  // ==========================================================================
  // HTTP Request Helper
  // ==========================================================================
  async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        let errMessage = `HTTP Error ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) errMessage = errData.error;
        } catch (_) {}
        throw new Error(errMessage);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Call failed: ${endpoint}`, error);
      showToast(error.message || 'Network request failed', 'error');
      throw error;
    }
  }

  // ==========================================================================
  // Toast Notification System
  // ==========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'success') {
      iconSvg = '<svg class="icon icon-sm text-emerald" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error' || type === 'alert') {
      iconSvg = '<svg class="icon icon-sm text-rose" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 240ms ease';
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  // ==========================================================================
  // Card Cursor Spotlight Glow Engine
  // ==========================================================================
  function initCardSpotlights() {
    document.addEventListener('mousemove', (e) => {
      const cards = document.querySelectorAll('.glass-card, .kanban-card, .task-row-card');
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }

  // ==========================================================================
  // Theme Management (Light / Dark)
  // ==========================================================================
  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('ssk_theme', state.theme);
        showToast(`Theme switched to ${state.theme} mode`, 'info');
        if (state.chartInstance) {
          renderAttendanceChart();
        }
      });
    }
  }

  // ==========================================================================
  // Live Clock & Date
  // ==========================================================================
  function startLiveClock() {
    const clockEl = document.getElementById('liveClock');
    if (!clockEl) return;

    const timeEl = clockEl.querySelector('.clock-time');
    const dateEl = clockEl.querySelector('.clock-date');

    function update() {
      const now = new Date();
      timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }

    update();
    setInterval(update, 1000);
  }

  // ==========================================================================
  // Navigation & View Switching
  // ==========================================================================
  function switchView(viewName) {
    state.activeView = viewName;

    // Update active nav items
    document.querySelectorAll('.sidebar-nav .nav-item, .mobile-bottom-nav .mb-nav-item').forEach(btn => {
      if (btn.dataset.view === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`view${capitalize(viewName)}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // Update Topbar Title
    const titles = {
      dashboard: { title: 'Dashboard', sub: 'Academic overview & real-time metrics' },
      assignments: { title: 'Assignments Kanban', sub: 'Deadlines, priority queues, and submissions' },
      attendance: { title: 'Attendance Tracker', sub: '75% cutoff monitoring & bunk calculator' },
      deadlines: { title: 'Deadlines & Calendar', sub: 'Interactive academic schedule & milestones' },
      exams: { title: 'Examinations', sub: 'Live countdown timers and syllabus breakdown' },
      tasks: { title: 'Daily Tasks', sub: 'Priority to-do list & habit builder' },
      ai: { title: 'AI Study Advisor', sub: 'Personalized study schedules powered by Claude' }
    };

    const header = titles[viewName] || { title: capitalize(viewName), sub: '' };
    const pageTitle = document.getElementById('pageTitle');
    const pageSub = document.getElementById('pageSubtitle');
    if (pageTitle) pageTitle.textContent = header.title;
    if (pageSub) pageSub.textContent = header.sub;

    // View-specific initialization
    if (viewName === 'attendance') {
      renderAttendanceView();
    } else if (viewName === 'assignments') {
      renderAssignmentsView();
    } else if (viewName === 'deadlines') {
      renderCalendar();
      renderChronologicalDeadlines();
    } else if (viewName === 'exams') {
      renderExamsView();
    } else if (viewName === 'tasks') {
      renderTasksView();
    } else if (viewName === 'dashboard') {
      loadDashboard();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ==========================================================================
  // Data Fetching & Sync
  // ==========================================================================
  async function loadAllData() {
    try {
      const [dash, asg, att, ex, tk] = await Promise.all([
        api('/api/dashboard'),
        api('/api/assignments'),
        api('/api/attendance'),
        api('/api/exams'),
        api('/api/tasks')
      ]);

      state.dashboard = dash;
      state.assignments = asg;
      state.attendance = att;
      state.exams = ex;
      state.tasks = tk;
      state.user = dash.user;

      renderUserProfile();
      renderSidebarBadges();
      renderDashboardView();
      startExamCountdowns();
    } catch (err) {
      console.error('Failed to load initial application data', err);
    }
  }

  async function loadDashboard() {
    try {
      const dash = await api('/api/dashboard');
      state.dashboard = dash;
      renderDashboardView();
      renderSidebarBadges();
    } catch (err) {
      console.error('Failed to refresh dashboard', err);
    }
  }

  // ==========================================================================
  // Render: User Profile & Badges
  // ==========================================================================
  function renderUserProfile() {
    if (!state.user) return;
    const nameEl = document.getElementById('sidebarUserName');
    const subEl = document.getElementById('sidebarUserSub');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = state.user.name;
    if (subEl) subEl.textContent = `${state.user.major} • ${state.user.semester}`;
    if (avatarEl) {
      const initials = state.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      avatarEl.textContent = initials;
    }
  }

  function renderSidebarBadges() {
    if (!state.dashboard) return;
    const counts = state.dashboard.counts || {};
    const attSummary = state.dashboard.attendanceSummary || {};

    const badgePending = document.getElementById('badgeTotalPending');
    const badgeAsg = document.getElementById('badgeAssignmentsDue');
    const badgeRisk = document.getElementById('badgeAttendanceRisk');
    const badgeEx = document.getElementById('badgeExamsCount');
    const badgeTasks = document.getElementById('badgeTasksProgress');

    if (badgePending) badgePending.textContent = counts.pendingAssignments || 0;
    if (badgeAsg) badgeAsg.textContent = counts.pendingAssignments || 0;
    if (badgeRisk) {
      badgeRisk.textContent = `${attSummary.atRiskCount || 0}!`;
      badgeRisk.style.display = attSummary.atRiskCount > 0 ? 'inline-block' : 'none';
    }
    if (badgeEx) badgeEx.textContent = counts.totalExams || 0;
    if (badgeTasks) badgeTasks.textContent = `${counts.completedTasks || 0}/${counts.totalTasks || 0}`;

    // Hero Stats
    const hAsg = document.getElementById('heroStatAssignments');
    const hAtt = document.getElementById('heroStatAttendance');
    const hExDays = document.getElementById('heroStatExamDays');

    if (hAsg) hAsg.textContent = counts.pendingAssignments || 0;
    if (hAtt) hAtt.textContent = `${attSummary.overallPercentage || 0}%`;
    if (hExDays) {
      if (state.dashboard.nearestExam && state.dashboard.nearestExam.date) {
        const diffDays = Math.max(0, Math.ceil((new Date(state.dashboard.nearestExam.date) - new Date()) / (1000 * 60 * 60 * 24)));
        hExDays.textContent = diffDays;
      } else {
        hExDays.textContent = '--';
      }
    }
  }

  // ==========================================================================
  // Render: View 1 (Bento-Grid Dashboard)
  // ==========================================================================
  function renderDashboardView() {
    const d = state.dashboard;
    if (!d) return;

    // 1. Productivity Score Ring
    const score = d.productivity?.score || 0;
    const rating = d.productivity?.rating || 'On Track';
    const scoreEl = document.getElementById('dashProductivityScore');
    const badgeEl = document.getElementById('dashProductivityBadge');
    const circleEl = document.getElementById('productivityCircle');

    if (scoreEl) scoreEl.textContent = score;
    if (badgeEl) badgeEl.textContent = rating;

    if (circleEl) {
      const offset = 264 - (score / 100) * 264;
      circleEl.style.strokeDashoffset = offset;
    }

    const pbTask = document.getElementById('pbTaskRate');
    const pbAsg = document.getElementById('pbAsgRate');
    const pbAtt = document.getElementById('pbAttRate');
    if (pbTask) pbTask.textContent = `${d.productivity?.taskRate || 0}%`;
    if (pbAsg) pbAsg.textContent = `${d.productivity?.assignmentRate || 0}%`;
    if (pbAtt) pbAtt.textContent = `${d.productivity?.attendanceRate || 0}%`;

    // 2. Attendance Status Card
    const attPct = d.attendanceSummary?.overallPercentage || 0;
    const attPctEl = document.getElementById('dashAttendancePct');
    const attProgEl = document.getElementById('dashAttendanceProgress');
    const attCountEl = document.getElementById('dashClassesCount');
    const attRiskEl = document.getElementById('dashRiskCount');

    if (attPctEl) attPctEl.textContent = `${attPct}%`;
    if (attProgEl) attProgEl.style.width = `${Math.min(100, attPct)}%`;
    if (attCountEl) attCountEl.textContent = `${d.attendanceSummary?.attendedClasses || 0} / ${d.attendanceSummary?.totalClasses || 0} Classes`;
    if (attRiskEl) {
      const risk = d.attendanceSummary?.atRiskCount || 0;
      attRiskEl.textContent = risk > 0 ? `${risk} Subject(s) Below 75%!` : 'All Safe (>=75%)';
      attRiskEl.className = risk > 0 ? 'text-alert font-semibold' : 'text-emerald font-semibold';
    }

    // 3. Today's Tasks Ratio
    const tTotal = d.counts?.totalTasks || 0;
    const tDone = d.counts?.completedTasks || 0;
    const tasksRatioEl = document.getElementById('dashTasksRatio');
    const tasksProgEl = document.getElementById('dashTasksProgressBar');
    const tasksTextEl = document.getElementById('dashTasksPendingText');

    if (tasksRatioEl) tasksRatioEl.textContent = `${tDone}/${tTotal}`;
    if (tasksProgEl) {
      const p = tTotal > 0 ? (tDone / tTotal) * 100 : 100;
      tasksProgEl.style.width = `${p}%`;
    }
    if (tasksTextEl) {
      const pending = tTotal - tDone;
      tasksTextEl.textContent = pending > 0 ? `${pending} task(s) remaining for today` : 'All tasks completed! Great work.';
    }

    // 4. Nearest Exam Preview
    const ex = d.nearestExam;
    const exSubjectEl = document.getElementById('dashExamSubject');
    const exCodeEl = document.getElementById('dashExamCode');
    const exRoomEl = document.getElementById('dashExamRoom');

    if (ex && ex.subject) {
      if (exSubjectEl) exSubjectEl.textContent = ex.subject;
      if (exCodeEl) exCodeEl.textContent = ex.code || 'EXAM';
      if (exRoomEl) exRoomEl.textContent = `Venue: ${ex.room || 'TBD'} • Weightage: ${ex.weightage || 30}%`;
    } else {
      if (exSubjectEl) exSubjectEl.textContent = 'No upcoming exams';
      if (exCodeEl) exCodeEl.textContent = 'NONE';
      if (exRoomEl) exRoomEl.textContent = 'Syllabus on track';
    }

    // 5. Today's Action Checklist
    const dashTasksContainer = document.getElementById('dashTasksList');
    if (dashTasksContainer) {
      const tasks = d.todayTasks || [];
      if (tasks.length === 0) {
        dashTasksContainer.innerHTML = '<div class="text-tertiary" style="padding: 1.5rem; text-align: center;">No tasks scheduled for today.</div>';
      } else {
        dashTasksContainer.innerHTML = tasks.slice(0, 5).map(task => `
          <div class="dash-task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
            <span class="task-title">${escapeHtml(task.title)}</span>
            <span class="task-priority-tag ${task.priority}">${task.priority}</span>
          </div>
        `).join('');

        dashTasksContainer.querySelectorAll('.task-checkbox').forEach(cb => {
          cb.addEventListener('change', async (e) => {
            const taskId = e.target.dataset.id;
            const completed = e.target.checked;
            await toggleTaskCompletion(taskId, completed);
          });
        });
      }
    }

    // 6. Upcoming Deadlines List
    const dashDeadlinesContainer = document.getElementById('dashDeadlinesList');
    if (dashDeadlinesContainer) {
      const deadlines = d.upcomingDeadlines || [];
      if (deadlines.length === 0) {
        dashDeadlinesContainer.innerHTML = '<div class="text-tertiary" style="padding: 1.5rem; text-align: center;">No upcoming deadlines in the next 7 days.</div>';
      } else {
        dashDeadlinesContainer.innerHTML = deadlines.slice(0, 4).map(dl => {
          const isOverdue = new Date(dl.dueDate) < new Date();
          const badgeClass = isOverdue ? 'overdue' : (dl.priority === 'high' ? 'soon' : 'safe');
          const badgeText = isOverdue ? 'Overdue' : formatRelativeTime(dl.dueDate);

          return `
            <div class="deadline-item ${isOverdue ? 'overdue' : ''}">
              <div class="deadline-item-left">
                <span class="deadline-title">
                  <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  ${escapeHtml(dl.title)}
                </span>
                <span class="deadline-sub">${escapeHtml(dl.subject)} • ${formatDateTime(dl.dueDate)}</span>
              </div>
              <span class="deadline-badge ${badgeClass}">${badgeText}</span>
            </div>
          `;
        }).join('');
      }
    }

    renderAttendanceChart();
  }

  // ==========================================================================
  // Chart.js: Attendance Area / Bar Chart with Linear Gradient Fill
  // ==========================================================================
  function renderAttendanceChart() {
    const canvas = document.getElementById('attendanceChartCanvas');
    if (!canvas || !window.Chart) return;

    const subjects = state.attendance || [];
    if (subjects.length === 0) return;

    const labels = subjects.map(s => s.code || s.subject.substring(0, 10));
    const dataValues = subjects.map(s => s.percentage || 0);

    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    if (state.chartInstance) {
      state.chartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    const gradientBar = ctx.createLinearGradient(0, 0, 0, 240);
    gradientBar.addColorStop(0, 'rgba(99, 102, 241, 0.9)');
    gradientBar.addColorStop(1, 'rgba(6, 182, 212, 0.6)');

    const barColors = dataValues.map(val => val >= 75 ? gradientBar : 'rgba(239, 68, 68, 0.85)');
    const barBorders = dataValues.map(val => val >= 75 ? '#6366f1' : '#ef4444');

    state.chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Attendance %',
            data: dataValues,
            backgroundColor: barColors,
            borderColor: barBorders,
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? 'rgba(16, 21, 36, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#94a3b8' : '#475569',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` Attendance: ${ctx.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              stepSize: 25,
              callback: (val) => `${val}%`
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor }
          }
        }
      }
    });
  }

  // ==========================================================================
  // Render: View 2 (Assignments - Kanban Board & Grid View)
  // ==========================================================================
  function renderAssignmentsView() {
    const kanbanBoard = document.getElementById('kanbanBoard');
    const gridView = document.getElementById('assignmentsGrid');
    if (!kanbanBoard || !gridView) return;

    const search = (document.getElementById('asgSearchInput')?.value || '').toLowerCase();
    const filterPriority = document.getElementById('asgFilterPriority')?.value || 'all';

    const filtered = (state.assignments || []).filter(a => {
      const matchSearch = a.title.toLowerCase().includes(search) || a.subject.toLowerCase().includes(search);
      const matchPriority = filterPriority === 'all' || a.priority === filterPriority;
      return matchSearch && matchPriority;
    });

    // 1. Render Kanban Columns (Pending, In Progress, Done)
    const colPending = document.getElementById('kanbanPendingList');
    const colInProgress = document.getElementById('kanbanInProgressList');
    const colDone = document.getElementById('kanbanDoneList');

    const pendingItems = filtered.filter(a => a.status === 'pending');
    const inProgressItems = filtered.filter(a => a.status === 'in-progress');
    const doneItems = filtered.filter(a => a.status === 'done');

    document.getElementById('countPending').textContent = pendingItems.length;
    document.getElementById('countInProgress').textContent = inProgressItems.length;
    document.getElementById('countDone').textContent = doneItems.length;

    function renderColumnCards(items) {
      if (items.length === 0) {
        return '<div class="text-tertiary" style="padding: 2rem 1rem; text-align: center; font-size: 0.78rem;">No items in this column</div>';
      }
      return items.map(a => {
        const isOverdue = a.status !== 'done' && new Date(a.dueDate) < new Date();
        return `
          <div class="glass-card kanban-card ${isOverdue ? 'overdue' : ''}" draggable="true" data-id="${a.id}">
            <div class="kanban-card-header">
              <span class="asg-subject-pill">${escapeHtml(a.subject)}</span>
              <span class="task-priority-tag ${a.priority}">${a.priority}</span>
            </div>
            <h4 class="asg-card-title">${escapeHtml(a.title)}</h4>
            ${a.description ? `<p class="asg-card-desc">${escapeHtml(a.description)}</p>` : ''}
            <div class="asg-card-footer">
              <div class="asg-due-pill ${isOverdue ? 'text-rose' : ''}">
                <svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>${formatDateTime(a.dueDate)}</span>
              </div>
              <div class="asg-actions">
                <button class="btn-icon btn-edit-asg" data-id="${a.id}" title="Edit Assignment" style="width: 28px; height: 28px;">
                  <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="btn-icon btn-delete-asg" data-id="${a.id}" title="Delete Assignment" style="width: 28px; height: 28px;">
                  <svg class="icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (colPending) colPending.innerHTML = renderColumnCards(pendingItems);
    if (colInProgress) colInProgress.innerHTML = renderColumnCards(inProgressItems);
    if (colDone) colDone.innerHTML = renderColumnCards(doneItems);

    // 2. Render Alternate Grid View
    gridView.innerHTML = filtered.map(a => {
      const isOverdue = a.status !== 'done' && new Date(a.dueDate) < new Date();
      return `
        <div class="glass-card assignment-card" data-asg-id="${a.id}">
          <div class="asg-card-top">
            <div class="asg-tags-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="asg-subject-pill">${escapeHtml(a.subject)}</span>
              <span class="task-priority-tag ${a.priority}">${a.priority}</span>
            </div>
            <h3 class="asg-card-title">${escapeHtml(a.title)}</h3>
            <p class="asg-card-desc">${escapeHtml(a.description || 'No description provided.')}</p>
          </div>

          <div class="asg-card-footer">
            <div class="asg-due-pill ${isOverdue ? 'text-rose' : ''}">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${formatDateTime(a.dueDate)}</span>
            </div>
            <div class="asg-actions">
              <select class="form-select select-compact status-select-btn" data-id="${a.id}">
                <option value="pending" ${a.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="in-progress" ${a.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="done" ${a.status === 'done' ? 'selected' : ''}>Done</option>
              </select>
              <button class="btn-icon btn-edit-asg" data-id="${a.id}" title="Edit Assignment">
                <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="btn-icon btn-delete-asg" data-id="${a.id}" title="Delete Assignment">
                <svg class="icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Toggle Visibility
    if (state.asgViewMode === 'kanban') {
      kanbanBoard.style.display = 'grid';
      gridView.style.display = 'none';
    } else {
      kanbanBoard.style.display = 'none';
      gridView.style.display = 'grid';
    }

    // Attach Kanban Drag-and-Drop
    initKanbanDragAndDrop();

    // Attach Edit & Delete Listeners
    document.querySelectorAll('.btn-edit-asg').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openEditAssignmentModal(id);
      });
    });

    document.querySelectorAll('.btn-delete-asg').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this assignment?')) {
          await api(`/api/assignments/${id}`, { method: 'DELETE' });
          state.assignments = state.assignments.filter(x => x.id !== id);
          showToast('Assignment deleted', 'info');
          renderAssignmentsView();
          loadDashboard();
        }
      });
    });

    document.querySelectorAll('.status-select-btn').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        const asg = state.assignments.find(x => x.id === id);
        if (asg) {
          asg.status = newStatus;
          await api(`/api/assignments/${id}`, { method: 'PUT', body: JSON.stringify(asg) });
          showToast(`Status updated to ${newStatus}`, 'success');
          renderAssignmentsView();
          loadDashboard();
        }
      });
    });
  }

  // Kanban Drag and Drop
  function initKanbanDragAndDrop() {
    let draggedId = null;

    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedId = null;
      });
    });

    document.querySelectorAll('.kanban-col').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const targetStatus = col.dataset.status;
        if (draggedId && targetStatus) {
          const asg = state.assignments.find(x => x.id === draggedId);
          if (asg && asg.status !== targetStatus) {
            asg.status = targetStatus;
            await api(`/api/assignments/${draggedId}`, { method: 'PUT', body: JSON.stringify(asg) });
            showToast(`Moved to ${targetStatus === 'in-progress' ? 'In Progress' : capitalize(targetStatus)}`, 'success');
            renderAssignmentsView();
            loadDashboard();
          }
        }
      });
    });
  }

  // ==========================================================================
  // Render: View 3 (Attendance Tracker & 75% Cutoff Math)
  // ==========================================================================
  function renderAttendanceView() {
    const grid = document.getElementById('attendanceGrid');
    if (!grid) return;

    const subjects = state.attendance || [];
    let totalClasses = 0;
    let attendedClasses = 0;
    let atRiskCount = 0;

    subjects.forEach(s => {
      totalClasses += s.total;
      attendedClasses += s.attended;
      if (s.isAtRisk) atRiskCount++;
    });

    const overallPct = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 1000) / 10 : 100;

    const overallVal = document.getElementById('attOverallVal');
    const overallSub = document.getElementById('attOverallSub');
    const riskTotal = document.getElementById('attRiskTotal');
    const riskDetails = document.getElementById('attRiskDetails');

    if (overallVal) {
      overallVal.textContent = `${overallPct}%`;
      overallVal.className = overallPct >= 75 ? 'att-banner-val text-emerald' : 'att-banner-val text-alert';
    }
    if (overallSub) overallSub.textContent = `Total: ${attendedClasses} / ${totalClasses} classes attended`;
    if (riskTotal) riskTotal.textContent = atRiskCount;
    if (riskDetails) riskDetails.textContent = atRiskCount > 0 ? `${atRiskCount} subject(s) below mandatory 75%` : 'All subjects safe';

    if (subjects.length === 0) {
      grid.innerHTML = '<div class="glass-card" style="grid-column: 1 / -1; padding: 3rem; text-align: center;">No subjects added. Click "+ Add Subject" to begin tracking.</div>';
      return;
    }

    grid.innerHTML = subjects.map(s => {
      const isDanger = s.isAtRisk;
      const pct = s.percentage || 0;

      let calcHtml = '';
      if (!isDanger) {
        const skip = s.classesCanSkip || 0;
        calcHtml = `
          <div class="att-calc-banner safe">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>You can safely bunk <strong>${skip}</strong> more class${skip === 1 ? '' : 'es'} while staying above 75%.</span>
          </div>
        `;
      } else {
        const mustAttend = s.classesMustAttend || 0;
        calcHtml = `
          <div class="att-calc-banner danger">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Danger! You must attend <strong>${mustAttend}</strong> consecutive class${mustAttend === 1 ? '' : 'es'} to recover to 75%.</span>
          </div>
        `;
      }

      return `
        <div class="glass-card attendance-subject-card" data-sub-id="${s.id}">
          <div>
            <div class="att-subject-header">
              <div>
                <span class="att-subject-code">${escapeHtml(s.code || 'COURSE')}</span>
                <h3 class="att-subject-title">${escapeHtml(s.subject)}</h3>
              </div>
              <span class="att-pct-pill ${isDanger ? 'danger' : ''}">${pct}%</span>
            </div>

            <div class="stat-progress-bar">
              <div class="stat-progress-fill ${isDanger ? 'bg-rose' : 'bg-emerald'}" style="width: ${Math.min(100, pct)}%"></div>
              <div class="stat-threshold-marker" style="left: 75%" title="75% Cutoff"></div>
            </div>

            <div class="stat-footer-meta">
              <span>${s.attended} Attended of ${s.total} Held</span>
              <span>Target: ${s.minimumRequired || 75}%</span>
            </div>

            ${calcHtml}
          </div>

          <div>
            <div class="att-action-buttons">
              <button class="btn btn-present btn-mark-present" data-id="${s.id}">+ Present</button>
              <button class="btn btn-absent btn-mark-absent" data-id="${s.id}">+ Absent</button>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: 0.75rem;">
              <button class="link-btn btn-edit-sub" data-id="${s.id}">Edit</button>
              <button class="link-btn text-rose btn-delete-sub" data-id="${s.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners
    grid.querySelectorAll('.btn-mark-present').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await markAttendance(id, true);
      });
    });

    grid.querySelectorAll('.btn-mark-absent').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await markAttendance(id, false);
      });
    });

    grid.querySelectorAll('.btn-edit-sub').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openEditSubjectModal(id);
      });
    });

    grid.querySelectorAll('.btn-delete-sub').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this subject from attendance tracking?')) {
          await api(`/api/attendance/${id}`, { method: 'DELETE' });
          state.attendance = state.attendance.filter(x => x.id !== id);
          showToast('Subject deleted', 'info');
          renderAttendanceView();
          loadDashboard();
        }
      });
    });
  }

  async function markAttendance(id, present) {
    try {
      const updated = await api(`/api/attendance/${id}/mark`, {
        method: 'POST',
        body: JSON.stringify({ present })
      });

      const idx = state.attendance.findIndex(x => x.id === id);
      if (idx !== -1) {
        state.attendance[idx] = updated;
      }

      showToast(present ? `Marked Present: ${updated.percentage}%` : `Marked Absent: ${updated.percentage}%`, present ? 'success' : 'alert');
      renderAttendanceView();
      loadDashboard();
    } catch (err) {
      console.error('Failed to mark attendance', err);
    }
  }

  // ==========================================================================
  // Render: View 4 (Deadlines & Calendar)
  // ==========================================================================
  function renderCalendar() {
    const daysGrid = document.getElementById('calendarDaysGrid');
    const monthTitle = document.getElementById('calMonthTitle');
    if (!daysGrid || !monthTitle) return;

    const currentYear = state.calendarDate.getFullYear();
    const currentMonth = state.calendarDate.getMonth();

    monthTitle.textContent = state.calendarDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    daysGrid.innerHTML = '';

    for (let i = firstDayIndex; i > 0; i--) {
      const dayNum = prevMonthDays - i + 1;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.innerHTML = `<span class="day-number">${dayNum}</span>`;
      daysGrid.appendChild(cell);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';

      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (dateStr === todayStr) {
        cell.classList.add('today');
      }
      if (state.selectedDateStr === dateStr) {
        cell.classList.add('selected');
      }

      const asgCount = (state.assignments || []).filter(a => a.dueDate.startsWith(dateStr)).length;
      const exCount = (state.exams || []).filter(e => e.date === dateStr).length;

      let dotsHtml = '<div class="day-dots">';
      if (asgCount > 0) dotsHtml += '<span class="day-dot bg-indigo" title="Assignment Due"></span>';
      if (exCount > 0) dotsHtml += '<span class="day-dot bg-violet" title="Exam Date"></span>';
      dotsHtml += '</div>';

      cell.innerHTML = `
        <span class="day-number">${day}</span>
        ${dotsHtml}
      `;

      cell.addEventListener('click', () => {
        state.selectedDateStr = dateStr;
        renderCalendar();
        renderChronologicalDeadlines(dateStr);
      });

      daysGrid.appendChild(cell);
    }
  }

  function renderChronologicalDeadlines(filterDate = null) {
    const listEl = document.getElementById('deadlinesChronologicalList');
    if (!listEl) return;

    let items = [];

    (state.assignments || []).forEach(a => {
      if (a.status !== 'done') {
        items.push({
          id: a.id,
          type: 'assignment',
          title: a.title,
          subject: a.subject,
          date: a.dueDate,
          priority: a.priority
        });
      }
    });

    (state.exams || []).forEach(e => {
      items.push({
        id: e.id,
        type: 'exam',
        title: `${e.subject} (${e.code})`,
        subject: e.subject,
        date: `${e.date}T${e.time}`,
        priority: 'high'
      });
    });

    items.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filterDate) {
      items = items.filter(x => x.date.startsWith(filterDate));
    }

    if (items.length === 0) {
      listEl.innerHTML = `<div class="text-tertiary" style="padding: 2rem; text-align: center;">No deadlines scheduled ${filterDate ? 'for ' + filterDate : ''}.</div>`;
      return;
    }

    listEl.innerHTML = items.map(item => {
      const isOverdue = new Date(item.date) < new Date();
      const badgeClass = isOverdue ? 'overdue' : (item.priority === 'high' ? 'soon' : 'safe');
      const badgeText = isOverdue ? 'Overdue' : formatRelativeTime(item.date);

      return `
        <div class="deadline-item ${isOverdue ? 'overdue' : ''}">
          <div class="deadline-item-left">
            <span class="deadline-title">
              <svg class="icon icon-sm" viewBox="0 0 24 24">${item.type === 'exam' ? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'}</svg>
              ${escapeHtml(item.title)}
            </span>
            <span class="deadline-sub">${escapeHtml(item.subject)} • ${formatDateTime(item.date)}</span>
          </div>
          <span class="deadline-badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // Render: View 5 (Exams & Live Countdown Clocks)
  // ==========================================================================
  function renderExamsView() {
    const grid = document.getElementById('examsGrid');
    if (!grid) return;

    const exams = state.exams || [];
    if (exams.length === 0) {
      grid.innerHTML = '<div class="glass-card" style="grid-column: 1 / -1; padding: 3rem; text-align: center;">No exams added. Click "+ Add Exam" to set up your countdowns.</div>';
      return;
    }

    grid.innerHTML = exams.map(e => `
      <div class="glass-card exam-card-full" data-exam-id="${e.id}">
        <div>
          <div class="exam-card-header">
            <div>
              <span class="att-subject-code">${escapeHtml(e.code || 'EXAM')}</span>
              <h3 class="exam-subject-heading">${escapeHtml(e.subject)}</h3>
            </div>
            <div style="display: flex; gap: var(--space-1);">
              <button class="btn-icon btn-edit-exam" data-id="${e.id}" title="Edit Exam" style="width: 32px; height: 32px;">
                <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="btn-icon btn-delete-exam" data-id="${e.id}" title="Delete Exam" style="width: 32px; height: 32px;">
                <svg class="icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>

          <div class="exam-live-countdown" id="countdown-exam-${e.id}">
            <div class="exam-cd-unit"><span class="exam-cd-digits cd-d">00</span><span class="exam-cd-label">DAYS</span></div>
            <div class="cd-sep">:</div>
            <div class="exam-cd-unit"><span class="exam-cd-digits cd-h">00</span><span class="exam-cd-label">HOURS</span></div>
            <div class="cd-sep">:</div>
            <div class="exam-cd-unit"><span class="exam-cd-digits cd-m">00</span><span class="exam-cd-label">MINS</span></div>
            <div class="cd-sep">:</div>
            <div class="exam-cd-unit"><span class="exam-cd-digits cd-s">00</span><span class="exam-cd-label">SECS</span></div>
          </div>

          <div class="exam-meta-pills">
            <span><svg class="icon icon-xs" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${e.date} • ${e.time}</span>
            <span><svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> ${escapeHtml(e.room || 'Main Hall')}</span>
            <span><svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/></svg> ${e.weightage || 30}% of Grade</span>
          </div>

          <div class="exam-syllabus-box">
            <strong>Syllabus Focus:</strong><br>
            ${escapeHtml(e.syllabusNotes || 'Comprehensive syllabus review.')}
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-edit-exam').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openEditExamModal(id);
      });
    });

    grid.querySelectorAll('.btn-delete-exam').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this exam?')) {
          await api(`/api/exams/${id}`, { method: 'DELETE' });
          state.exams = state.exams.filter(x => x.id !== id);
          showToast('Exam deleted', 'info');
          renderExamsView();
          loadDashboard();
        }
      });
    });

    updateAllCountdowns();
  }

  function startExamCountdowns() {
    if (state.countdownInterval) clearInterval(state.countdownInterval);
    state.countdownInterval = setInterval(updateAllCountdowns, 1000);
    updateAllCountdowns();
  }

  function updateAllCountdowns() {
    const now = new Date().getTime();

    // Dashboard mini countdown
    if (state.dashboard?.nearestExam && state.dashboard.nearestExam.date) {
      const ex = state.dashboard.nearestExam;
      const target = new Date(`${ex.date}T${ex.time || '09:00'}`).getTime();
      const diff = target - now;

      const cdD = document.getElementById('cdDays');
      const cdH = document.getElementById('cdHours');
      const cdM = document.getElementById('cdMins');
      const cdS = document.getElementById('cdSecs');

      if (diff > 0) {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        if (cdD) cdD.textContent = String(d).padStart(2, '0');
        if (cdH) cdH.textContent = String(h).padStart(2, '0');
        if (cdM) cdM.textContent = String(m).padStart(2, '0');
        if (cdS) cdS.textContent = String(s).padStart(2, '0');
      } else {
        if (cdD) cdD.textContent = '00';
        if (cdH) cdH.textContent = '00';
        if (cdM) cdM.textContent = '00';
        if (cdS) cdS.textContent = '00';
      }
    }

    // Exam Full View Cards
    (state.exams || []).forEach(e => {
      const container = document.getElementById(`countdown-exam-${e.id}`);
      if (!container) return;

      const target = new Date(`${e.date}T${e.time || '09:00'}`).getTime();
      const diff = target - now;

      const dEl = container.querySelector('.cd-d');
      const hEl = container.querySelector('.cd-h');
      const mEl = container.querySelector('.cd-m');
      const sEl = container.querySelector('.cd-s');

      if (diff > 0) {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        if (dEl) dEl.textContent = String(d).padStart(2, '0');
        if (hEl) hEl.textContent = String(h).padStart(2, '0');
        if (mEl) mEl.textContent = String(m).padStart(2, '0');
        if (sEl) sEl.textContent = String(s).padStart(2, '0');
      } else {
        if (dEl) dEl.textContent = '00';
        if (hEl) hEl.textContent = '00';
        if (mEl) mEl.textContent = '00';
        if (sEl) sEl.textContent = '00';
      }
    });
  }

  // ==========================================================================
  // Render: View 6 (Daily Tasks & Confetti Celebration)
  // ==========================================================================
  let activeTaskFilter = 'all';

  function renderTasksView() {
    const listEl = document.getElementById('tasksDraggableList');
    if (!listEl) return;

    const allTasks = state.tasks || [];
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 100;

    const ringFill = document.getElementById('tasksRingFill');
    const ringPct = document.getElementById('tasksRingPct');
    const statusBadge = document.getElementById('tasksStatusBadge');

    if (ringFill) ringFill.style.strokeDashoffset = 100 - pct;
    if (ringPct) ringPct.textContent = `${pct}%`;
    if (statusBadge) statusBadge.textContent = `${completed} of ${total} Completed`;

    const filtered = allTasks.filter(t => {
      if (activeTaskFilter === 'pending') return !t.completed;
      if (activeTaskFilter === 'completed') return t.completed;
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="glass-card" style="padding: 2.5rem; text-align: center;">No tasks in this view. Use the quick add bar above to create one!</div>';
      return;
    }

    listEl.innerHTML = filtered.map((task, idx) => `
      <div class="glass-card task-row-card ${task.completed ? 'completed' : ''}" draggable="true" data-id="${task.id}" data-index="${idx}">
        <span class="drag-handle" title="Drag to reorder">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
        </span>
        
        <div class="task-order-actions">
          <button class="btn-move-order btn-move-up" data-id="${task.id}" title="Move Up">
            <svg class="icon icon-xs" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="btn-move-order btn-move-down" data-id="${task.id}" title="Move Down">
            <svg class="icon icon-xs" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">

        <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
          <span class="task-title">${escapeHtml(task.title)}</span>
          <span class="text-tertiary" style="font-size: 0.72rem;">${escapeHtml(task.category || 'Academic')} • Due: ${task.dueDate || 'Today'}</span>
        </div>

        <span class="task-priority-tag ${task.priority}">${task.priority}</span>

        <button class="btn-icon btn-delete-task" data-id="${task.id}" title="Delete Task" style="width: 28px; height: 28px;">
          <svg class="icon icon-xs" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `).join('');

    listEl.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const val = e.target.checked;
        await toggleTaskCompletion(id, val);
        renderTasksView();
      });
    });

    listEl.querySelectorAll('.btn-delete-task').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await api(`/api/tasks/${id}`, { method: 'DELETE' });
        state.tasks = state.tasks.filter(t => t.id !== id);
        showToast('Task removed', 'info');
        renderTasksView();
        loadDashboard();
      });
    });

    listEl.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        moveTaskOrder(id, -1);
      });
    });

    listEl.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        moveTaskOrder(id, 1);
      });
    });

    initTaskDragAndDrop(listEl);
  }

  async function toggleTaskCompletion(id, completed) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = completed;
    try {
      await api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) });

      // Check if all tasks are completed -> Confetti burst!
      const allDone = state.tasks.length > 0 && state.tasks.every(t => t.completed);
      if (allDone && window.confetti) {
        window.confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 }
        });
        showToast('🎉 All daily tasks completed! Exceptional momentum!', 'success');
      } else {
        showToast(completed ? 'Task completed!' : 'Task marked as pending', 'success');
      }

      loadDashboard();
    } catch (err) {
      console.error('Failed to update task', err);
    }
  }

  function moveTaskOrder(id, delta) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= state.tasks.length) return;

    const temp = state.tasks[idx];
    state.tasks[idx] = state.tasks[targetIdx];
    state.tasks[targetIdx] = temp;

    saveTasksOrder();
  }

  function initTaskDragAndDrop(container) {
    let draggedItem = null;

    container.querySelectorAll('.task-row-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedItem = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        if (draggedItem) draggedItem.classList.remove('dragging');
        draggedItem = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.currentTarget;
        if (target && target !== draggedItem) {
          const rect = target.getBoundingClientRect();
          const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
          container.insertBefore(draggedItem, next ? target.nextSibling : target);
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        saveTasksOrderFromDOM(container);
      });
    });
  }

  async function saveTasksOrderFromDOM(container) {
    const ids = Array.from(container.querySelectorAll('.task-row-card')).map(el => el.dataset.id);
    await api('/api/tasks/reorder', { method: 'POST', body: JSON.stringify({ order: ids }) });
    showToast('Task order updated', 'info');
    const updated = await api('/api/tasks');
    state.tasks = updated;
    renderTasksView();
  }

  async function saveTasksOrder() {
    const ids = state.tasks.map(t => t.id);
    await api('/api/tasks/reorder', { method: 'POST', body: JSON.stringify({ order: ids }) });
    renderTasksView();
  }

  // ==========================================================================
  // Render: View 7 & Slide-over Drawer (AI Assistant)
  // ==========================================================================
  async function sendAiMessage(promptText, mode = 'chat') {
    if (!promptText || promptText.trim() === '') return;

    appendChatMessage('user', promptText);
    const typingId = appendTypingIndicator();

    try {
      const response = await api('/api/ai', {
        method: 'POST',
        body: JSON.stringify({ prompt: promptText, mode: mode })
      });

      removeTypingIndicator(typingId);

      if (response && response.reply) {
        appendChatMessage('bot', response.reply, response.provider);
      }
    } catch (err) {
      removeTypingIndicator(typingId);
      appendChatMessage('bot', '⚠️ Could not reach AI advisor. Running in local fallback mode.', 'Fallback');
    }
  }

  function appendChatMessage(sender, text, provider = null) {
    const fullContainer = document.getElementById('aiChatMessages');
    const drawerContainer = document.getElementById('aiDrawerMessages');

    const html = `
      <div class="chat-message ${sender}">
        <div class="msg-avatar">
          ${sender === 'bot' ? '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>' : 'AR'}
        </div>
        <div class="msg-content">
          <div class="msg-author">
            ${sender === 'bot' ? 'Aura' : 'You'}
            ${provider ? `<span style="font-size: 0.65rem; color: var(--text-tertiary); font-weight: normal;">(${provider})</span>` : ''}
            <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="msg-text">${formatMarkdown(text)}</div>
          ${sender === 'bot' ? `<div class="msg-actions"><button class="btn-copy-msg" title="Copy text"><svg class="icon icon-xs" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy</span></button></div>` : ''}
        </div>
      </div>
    `;

    if (fullContainer) {
      fullContainer.insertAdjacentHTML('beforeend', html);
      fullContainer.scrollTop = fullContainer.scrollHeight;
    }

    if (drawerContainer) {
      drawerContainer.insertAdjacentHTML('beforeend', html);
      drawerContainer.scrollTop = drawerContainer.scrollHeight;
    }

    document.querySelectorAll('.btn-copy-msg').forEach(btn => {
      btn.onclick = () => {
        const textToCopy = btn.closest('.msg-content').querySelector('.msg-text').innerText;
        navigator.clipboard.writeText(textToCopy);
        showToast('Copied to clipboard!', 'info');
      };
    });
  }

  function appendTypingIndicator() {
    const id = `typing-${Date.now()}`;
    const html = `
      <div class="chat-message bot" id="${id}">
        <div class="msg-avatar">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
        </div>
        <div class="msg-content">
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>
    `;

    const fullContainer = document.getElementById('aiChatMessages');
    const drawerContainer = document.getElementById('aiDrawerMessages');
    if (fullContainer) fullContainer.insertAdjacentHTML('beforeend', html);
    if (drawerContainer) drawerContainer.insertAdjacentHTML('beforeend', html);

    return id;
  }

  function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function formatMarkdown(text) {
    if (!text) return '';
    let parsed = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    parsed = parsed.replace(/^### (.*$)/gim, '<h4 style="font-size: 0.95rem; font-weight: 700; margin: 0.75rem 0 0.35rem 0; color: var(--accent-cyan);">$1</h4>');
    parsed = parsed.replace(/^#### (.*$)/gim, '<h5 style="font-size: 0.88rem; font-weight: 700; margin: 0.65rem 0 0.25rem 0; color: var(--accent-indigo);">$1</h5>');

    parsed = parsed.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    parsed = parsed.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    parsed = parsed.replace(/^> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-cyan); padding-left: 0.75rem; margin: 0.5rem 0; color: var(--text-secondary);">$1</blockquote>');
    parsed = parsed.replace(/^\- (.*$)/gim, '<li style="margin-left: 1.25rem; margin-bottom: 0.25rem;">$1</li>');
    parsed = parsed.replace(/\n/gim, '<br>');

    return parsed;
  }

  // ==========================================================================
  // Global Search Modal Engine
  // ==========================================================================
  function initGlobalSearch() {
    const trigger = document.getElementById('globalSearchTrigger');
    const modal = document.getElementById('modalSearch');
    const closeBtn = document.getElementById('btnCloseSearchModal');
    const input = document.getElementById('globalSearchInput');
    const resultsContainer = document.getElementById('searchResultsContainer');

    function openSearch() {
      modal.classList.add('show');
      input.value = '';
      input.focus();
      renderSearchResults('');
    }

    function closeSearch() {
      modal.classList.remove('show');
    }

    if (trigger) trigger.addEventListener('click', openSearch);
    if (closeBtn) closeBtn.addEventListener('click', closeSearch);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSearch();
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        closeSearch();
      }
    });

    if (input) {
      input.addEventListener('input', (e) => {
        renderSearchResults(e.target.value.toLowerCase().trim());
      });
    }

    function renderSearchResults(query) {
      if (!query) {
        resultsContainer.innerHTML = '<div class="search-empty-prompt">Type to search assignments, exams, tasks, and subjects...</div>';
        return;
      }

      let matches = [];

      (state.assignments || []).forEach(a => {
        if (a.title.toLowerCase().includes(query) || a.subject.toLowerCase().includes(query)) {
          matches.push({ type: 'Assignment', title: a.title, sub: a.subject, view: 'assignments' });
        }
      });

      (state.exams || []).forEach(e => {
        if (e.subject.toLowerCase().includes(query) || e.code.toLowerCase().includes(query)) {
          matches.push({ type: 'Exam', title: `${e.subject} (${e.code})`, sub: `Date: ${e.date}`, view: 'exams' });
        }
      });

      (state.tasks || []).forEach(t => {
        if (t.title.toLowerCase().includes(query)) {
          matches.push({ type: 'Task', title: t.title, sub: `Priority: ${t.priority}`, view: 'tasks' });
        }
      });

      (state.attendance || []).forEach(s => {
        if (s.subject.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)) {
          matches.push({ type: 'Subject', title: s.subject, sub: `${s.percentage}% Attendance`, view: 'attendance' });
        }
      });

      if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="search-empty-prompt">No matching items found.</div>';
        return;
      }

      resultsContainer.innerHTML = matches.map(m => `
        <div class="search-result-item" data-view="${m.view}">
          <div>
            <div style="font-size: 0.88rem; font-weight: 600;">${escapeHtml(m.title)}</div>
            <div style="font-size: 0.72rem; color: var(--text-tertiary);">${escapeHtml(m.sub)}</div>
          </div>
          <span class="nav-badge info">${m.type}</span>
        </div>
      `).join('');

      resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          closeSearch();
          switchView(item.dataset.view);
        });
      });
    }
  }

  // ==========================================================================
  // Modals & Forms Handlers
  // ==========================================================================
  function initModals() {
    document.querySelectorAll('.modal-dismiss').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('show'));
      });
    });

    // 1. Assignment Modal
    const formAsg = document.getElementById('formAssignment');
    document.getElementById('btnOpenAddAssignmentModal')?.addEventListener('click', openAddAssignmentModal);
    document.getElementById('quickAddAssignment')?.addEventListener('click', () => {
      closeQuickAddMenu();
      openAddAssignmentModal();
    });

    if (formAsg) {
      formAsg.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('asgInputId').value;
        const payload = {
          title: document.getElementById('asgInputTitle').value,
          subject: document.getElementById('asgInputSubject').value,
          dueDate: document.getElementById('asgInputDueDate').value,
          priority: document.getElementById('asgInputPriority').value,
          status: document.getElementById('asgInputStatus').value,
          weightage: parseInt(document.getElementById('asgInputWeightage').value) || 10,
          description: document.getElementById('asgInputDescription').value
        };

        if (id) {
          await api(`/api/assignments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          showToast('Assignment updated successfully', 'success');
        } else {
          await api('/api/assignments', { method: 'POST', body: JSON.stringify(payload) });
          showToast('New assignment added', 'success');
        }

        document.getElementById('modalAssignment').classList.remove('show');
        const updated = await api('/api/assignments');
        state.assignments = updated;
        renderAssignmentsView();
        loadDashboard();
      });
    }

    // 2. Attendance Subject Modal
    const formSub = document.getElementById('formSubject');
    document.getElementById('btnOpenAddSubjectModal')?.addEventListener('click', openAddSubjectModal);
    document.getElementById('quickAddSubject')?.addEventListener('click', () => {
      closeQuickAddMenu();
      openAddSubjectModal();
    });

    if (formSub) {
      formSub.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('subInputId').value;
        const payload = {
          subject: document.getElementById('subInputName').value,
          code: document.getElementById('subInputCode').value,
          attended: parseInt(document.getElementById('subInputAttended').value) || 0,
          total: parseInt(document.getElementById('subInputTotal').value) || 0,
          minimumRequired: parseInt(document.getElementById('subInputMin').value) || 75
        };

        if (id) {
          await api(`/api/attendance/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          showToast('Subject attendance updated', 'success');
        } else {
          await api('/api/attendance', { method: 'POST', body: JSON.stringify(payload) });
          showToast('New subject added', 'success');
        }

        document.getElementById('modalSubject').classList.remove('show');
        const updated = await api('/api/attendance');
        state.attendance = updated;
        renderAttendanceView();
        loadDashboard();
      });
    }

    // 3. Exam Modal
    const formExam = document.getElementById('formExam');
    document.getElementById('btnOpenAddExamModal')?.addEventListener('click', openAddExamModal);
    document.getElementById('quickAddExam')?.addEventListener('click', () => {
      closeQuickAddMenu();
      openAddExamModal();
    });

    if (formExam) {
      formExam.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('examInputId').value;
        const payload = {
          subject: document.getElementById('examInputSubject').value,
          code: document.getElementById('examInputCode').value,
          date: document.getElementById('examInputDate').value,
          time: document.getElementById('examInputTime').value,
          room: document.getElementById('examInputRoom').value,
          syllabusNotes: document.getElementById('examInputSyllabus').value
        };

        if (id) {
          await api(`/api/exams/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          showToast('Exam updated successfully', 'success');
        } else {
          await api('/api/exams', { method: 'POST', body: JSON.stringify(payload) });
          showToast('New exam added to schedule', 'success');
        }

        document.getElementById('modalExam').classList.remove('show');
        const updated = await api('/api/exams');
        state.exams = updated;
        renderExamsView();
        loadDashboard();
      });
    }

    // 4. Profile Modal
    const formProfile = document.getElementById('formProfile');
    document.getElementById('btnEditProfile')?.addEventListener('click', openProfileModal);

    if (formProfile) {
      formProfile.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('profInputName').value,
          major: document.getElementById('profInputMajor').value,
          semester: document.getElementById('profInputSemester').value,
          college: document.getElementById('profInputCollege').value,
          targetAttendance: parseInt(document.getElementById('profInputTarget').value) || 75
        };

        const updated = await api('/api/profile', { method: 'PUT', body: JSON.stringify(payload) });
        state.user = updated;
        renderUserProfile();
        showToast('Profile updated', 'success');
        document.getElementById('modalProfile').classList.remove('show');
      });
    }

    // 5. Quick Add Task
    const btnQuickTask = document.getElementById('btnQuickSubmitTask');
    const inputQuickTitle = document.getElementById('quickTaskTitle');

    async function handleQuickTask() {
      const title = inputQuickTitle.value.trim();
      if (!title) return;

      const priority = document.getElementById('quickTaskPriority').value;
      const category = document.getElementById('quickTaskCategory').value;

      const payload = {
        title: title,
        completed: false,
        priority: priority,
        category: category,
        dueDate: new Date().toISOString().split('T')[0]
      };

      await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      inputQuickTitle.value = '';
      showToast('Task added!', 'success');
      const updated = await api('/api/tasks');
      state.tasks = updated;
      renderTasksView();
      loadDashboard();
    }

    if (btnQuickTask) btnQuickTask.addEventListener('click', handleQuickTask);
    if (inputQuickTitle) {
      inputQuickTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleQuickTask();
      });
    }

    document.getElementById('quickAddTask')?.addEventListener('click', () => {
      closeQuickAddMenu();
      switchView('tasks');
      setTimeout(() => inputQuickTitle?.focus(), 300);
    });
  }

  function openAddAssignmentModal() {
    document.getElementById('modalAssignmentTitle').textContent = 'Add Assignment';
    document.getElementById('asgInputId').value = '';
    document.getElementById('asgInputTitle').value = '';
    document.getElementById('asgInputSubject').value = '';
    document.getElementById('asgInputDueDate').value = '';
    document.getElementById('asgInputPriority').value = 'medium';
    document.getElementById('asgInputStatus').value = 'pending';
    document.getElementById('asgInputWeightage').value = '10';
    document.getElementById('asgInputDescription').value = '';
    document.getElementById('modalAssignment').classList.add('show');
  }

  function openEditAssignmentModal(id) {
    const a = state.assignments.find(x => x.id === id);
    if (!a) return;
    document.getElementById('modalAssignmentTitle').textContent = 'Edit Assignment';
    document.getElementById('asgInputId').value = a.id;
    document.getElementById('asgInputTitle').value = a.title;
    document.getElementById('asgInputSubject').value = a.subject;
    document.getElementById('asgInputDueDate').value = a.dueDate;
    document.getElementById('asgInputPriority').value = a.priority;
    document.getElementById('asgInputStatus').value = a.status;
    document.getElementById('asgInputWeightage').value = a.weightage || 10;
    document.getElementById('asgInputDescription').value = a.description || '';
    document.getElementById('modalAssignment').classList.add('show');
  }

  function openAddSubjectModal() {
    document.getElementById('modalSubjectTitle').textContent = 'Add Attendance Subject';
    document.getElementById('subInputId').value = '';
    document.getElementById('subInputName').value = '';
    document.getElementById('subInputCode').value = '';
    document.getElementById('subInputAttended').value = '0';
    document.getElementById('subInputTotal').value = '0';
    document.getElementById('subInputMin').value = '75';
    document.getElementById('modalSubject').classList.add('show');
  }

  function openEditSubjectModal(id) {
    const s = state.attendance.find(x => x.id === id);
    if (!s) return;
    document.getElementById('modalSubjectTitle').textContent = 'Edit Attendance Subject';
    document.getElementById('subInputId').value = s.id;
    document.getElementById('subInputName').value = s.subject;
    document.getElementById('subInputCode').value = s.code;
    document.getElementById('subInputAttended').value = s.attended;
    document.getElementById('subInputTotal').value = s.total;
    document.getElementById('subInputMin').value = s.minimumRequired || 75;
    document.getElementById('modalSubject').classList.add('show');
  }

  function openAddExamModal() {
    document.getElementById('modalExamTitle').textContent = 'Add Examination';
    document.getElementById('examInputId').value = '';
    document.getElementById('examInputSubject').value = '';
    document.getElementById('examInputCode').value = '';
    document.getElementById('examInputDate').value = '';
    document.getElementById('examInputTime').value = '09:30';
    document.getElementById('examInputRoom').value = '';
    document.getElementById('examInputSyllabus').value = '';
    document.getElementById('modalExam').classList.add('show');
  }

  function openEditExamModal(id) {
    const e = state.exams.find(x => x.id === id);
    if (!e) return;
    document.getElementById('modalExamTitle').textContent = 'Edit Examination';
    document.getElementById('examInputId').value = e.id;
    document.getElementById('examInputSubject').value = e.subject;
    document.getElementById('examInputCode').value = e.code;
    document.getElementById('examInputDate').value = e.date;
    document.getElementById('examInputTime').value = e.time;
    document.getElementById('examInputRoom').value = e.room || '';
    document.getElementById('examInputSyllabus').value = e.syllabusNotes || '';
    document.getElementById('modalExam').classList.add('show');
  }

  function openProfileModal() {
    if (!state.user) return;
    document.getElementById('profInputName').value = state.user.name || '';
    document.getElementById('profInputMajor').value = state.user.major || '';
    document.getElementById('profInputSemester').value = state.user.semester || '';
    document.getElementById('profInputCollege').value = state.user.college || '';
    document.getElementById('profInputTarget').value = state.user.targetAttendance || 75;
    document.getElementById('modalProfile').classList.add('show');
  }

  function initQuickAddMenu() {
    const btn = document.getElementById('btnQuickAdd');
    const menu = document.getElementById('quickAddMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      menu.classList.remove('show');
    });
  }

  function closeQuickAddMenu() {
    document.getElementById('quickAddMenu')?.classList.remove('show');
  }

  // ==========================================================================
  // UI Interactions & Listeners
  // ==========================================================================
  function initUIListeners() {
    document.querySelectorAll('.sidebar-nav .nav-item, .mobile-bottom-nav .mb-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) switchView(view);
        document.getElementById('sidebar')?.classList.remove('open');
      });
    });

    document.getElementById('brandLogoHome')?.addEventListener('click', () => switchView('dashboard'));

    document.getElementById('mobileSidebarToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.add('open');
    });

    document.getElementById('mobileSidebarClose')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
    });

    // Hero Actions
    document.getElementById('heroCtaExplore')?.addEventListener('click', () => {
      window.scrollTo({ top: document.querySelector('.stats-grid')?.offsetTop - 80, behavior: 'smooth' });
    });

    document.getElementById('heroCtaPlan')?.addEventListener('click', () => {
      switchView('ai');
      sendAiMessage('Generate a comprehensive 7-day study plan based on my exams and assignments.', 'planner');
    });

    document.getElementById('heroDismiss')?.addEventListener('click', () => {
      document.getElementById('heroBanner')?.remove();
    });

    // Dashboard Quick Buttons
    document.getElementById('btnDashViewAllTasks')?.addEventListener('click', () => switchView('tasks'));
    document.getElementById('btnDashAddTask')?.addEventListener('click', () => switchView('tasks'));
    document.getElementById('btnDashViewDeadlines')?.addEventListener('click', () => switchView('deadlines'));
    document.getElementById('btnDashManageAttendance')?.addEventListener('click', () => switchView('attendance'));
    document.getElementById('btnDashOpenAiChat')?.addEventListener('click', () => switchView('ai'));

    // Dashboard AI prompt chips
    document.querySelectorAll('.ai-prompt-shortcuts .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt;
        switchView('ai');
        sendAiMessage(prompt, prompt.includes('plan') ? 'planner' : 'summary');
      });
    });

    // AI Full View Chips
    document.querySelectorAll('.ai-quick-prompts-bar .prompt-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt;
        const mode = btn.dataset.mode || 'chat';
        sendAiMessage(prompt, mode);
      });
    });

    // AI Full View Send button
    document.getElementById('btnAiSend')?.addEventListener('click', () => {
      const textarea = document.getElementById('aiInputText');
      const text = textarea?.value.trim();
      if (text) {
        sendAiMessage(text, 'chat');
        textarea.value = '';
      }
    });

    document.getElementById('aiInputText')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = e.target.value.trim();
        if (text) {
          sendAiMessage(text, 'chat');
          e.target.value = '';
        }
      }
    });

    document.getElementById('btnClearAiChat')?.addEventListener('click', () => {
      const full = document.getElementById('aiChatMessages');
      if (full) full.innerHTML = '';
      showToast('Chat history cleared', 'info');
    });

    // AI Drawer & FAB Trigger
    const drawer = document.getElementById('aiDrawer');
    const backdrop = document.getElementById('aiDrawerBackdrop');

    function openAiDrawer() {
      drawer?.classList.add('open');
      backdrop?.classList.add('show');
    }

    function closeAiDrawer() {
      drawer?.classList.remove('open');
      backdrop?.classList.remove('show');
    }

    document.getElementById('aiHeaderTrigger')?.addEventListener('click', openAiDrawer);
    document.getElementById('aiFabTrigger')?.addEventListener('click', openAiDrawer);
    document.getElementById('btnAiDrawerClose')?.addEventListener('click', closeAiDrawer);
    backdrop?.addEventListener('click', closeAiDrawer);

    // AI Drawer Send
    document.getElementById('btnAiDrawerSend')?.addEventListener('click', () => {
      const input = document.getElementById('aiDrawerInput');
      const text = input?.value.trim();
      if (text) {
        sendAiMessage(text, 'chat');
        input.value = '';
      }
    });

    document.getElementById('aiDrawerInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = e.target.value.trim();
        if (text) {
          sendAiMessage(text, 'chat');
          e.target.value = '';
        }
      }
    });

    // Assignments Toolbar Filters & View Toggle (Kanban vs Grid)
    document.getElementById('asgSearchInput')?.addEventListener('input', renderAssignmentsView);
    document.getElementById('asgFilterPriority')?.addEventListener('change', renderAssignmentsView);

    document.querySelectorAll('#asgViewModeSegment .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#asgViewModeSegment .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.asgViewMode = btn.dataset.asgView;
        renderAssignmentsView();
      });
    });

    // Calendar Navigation
    document.getElementById('calPrevMonth')?.addEventListener('click', () => {
      state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
      renderCalendar();
    });

    document.getElementById('calNextMonth')?.addEventListener('click', () => {
      state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
      renderCalendar();
    });

    // Deadlines segment filters
    document.querySelectorAll('#deadlinesFilterSegment .seg-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#deadlinesFilterSegment .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        renderFilteredDeadlines(filter);
      });
    });

    // Tasks filter tabs
    document.querySelectorAll('.tasks-filter-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tasks-filter-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTaskFilter = btn.dataset.taskTab;
        renderTasksView();
      });
    });
  }

  function renderFilteredDeadlines(filter) {
    const listEl = document.getElementById('deadlinesChronologicalList');
    if (!listEl) return;

    let items = [];
    (state.assignments || []).forEach(a => {
      if (a.status !== 'done') items.push({ id: a.id, type: 'assignment', title: a.title, subject: a.subject, date: a.dueDate, priority: a.priority });
    });
    (state.exams || []).forEach(e => {
      items.push({ id: e.id, type: 'exam', title: `${e.subject} (${e.code})`, subject: e.subject, date: `${e.date}T${e.time}`, priority: 'high' });
    });

    items.sort((a, b) => new Date(a.date) - new Date(b.date));

    const now = new Date();
    if (filter === 'overdue') {
      items = items.filter(x => new Date(x.date) < now);
    } else if (filter === 'upcoming') {
      items = items.filter(x => new Date(x.date) >= now);
    }

    if (items.length === 0) {
      listEl.innerHTML = `<div class="text-tertiary" style="padding: 2rem; text-align: center;">No ${filter} deadlines found.</div>`;
      return;
    }

    listEl.innerHTML = items.map(item => {
      const isOverdue = new Date(item.date) < now;
      const badgeClass = isOverdue ? 'overdue' : (item.priority === 'high' ? 'soon' : 'safe');
      const badgeText = isOverdue ? 'Overdue' : formatRelativeTime(item.date);

      return `
        <div class="deadline-item ${isOverdue ? 'overdue' : ''}">
          <div class="deadline-item-left">
            <span class="deadline-title">
              <svg class="icon icon-sm" viewBox="0 0 24 24">${item.type === 'exam' ? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'}</svg>
              ${escapeHtml(item.title)}
            </span>
            <span class="deadline-sub">${escapeHtml(item.subject)} • ${formatDateTime(item.date)}</span>
          </div>
          <span class="deadline-badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    }).join('');
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const d = new Date(dateStr);
    const diffHours = Math.round((d - now) / (1000 * 60 * 60));

    if (diffHours < 0) return 'Overdue';
    if (diffHours < 24) return `Due in ${diffHours}h`;
    const diffDays = Math.ceil(diffHours / 24);
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // Initialization Entry Point
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCardSpotlights();
    startLiveClock();
    initQuickAddMenu();
    initGlobalSearch();
    initModals();
    initUIListeners();
    loadAllData();
  });

})();
