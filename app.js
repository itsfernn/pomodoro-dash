/**
 * Pomodoro Stats - Static SPA App Logic
 */

Coloris({
  theme: 'default',
  themeMode: 'light',
  alpha: false,
});


function stringToColor(str) {
    let hash = 0x811c9dc5; // FNV-1a offset basis

    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193); // FNV prime
    }

  // Hue: 0–360
  const hue = Math.abs(hash) % 360;

  // Force vibrant values
  const saturation = 30 + (Math.abs(hash) % 20); // 75–94%
  const lightness = 40 + (Math.abs(hash >> 3) % 10); // 45–54%

  return hslToHex(hue, saturation, lightness);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n =>
    Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));

  const r = f(0);
  const g = f(8);
  const b = f(4);

  return (
    "#" +
    [r, g, b]
      .map(x => x.toString(16).padStart(2, "0"))
      .join("")
  );
}

const app = {
    // --- State ---
    sessions: [],
    project_colors: new Map(),
    currentView: 'weekly',
    selectedDate: new Date(),
    windowEndDate: new Date(),
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    firstLoad: true,
    editingId: null,
    settings: {
        defaultDuration: 25,
        timelineStartHour: 6,
        timelineEndHour: 20
    },
    timer: {
        running: false,
        startTime: null,
        project: '',
    },
    charts: {
        dashboard: null,
        timeline: null
    },

    addSessionModal: null,

    // --- Initialization ---
    init() {
        this.selectedDate.setHours(0,0,0,0);
        // Initial load shows the 7 days ending today
        this.windowEndDate = new Date(this.selectedDate);
        this.loadData();
        this.loadSettings();
        this.initEventListeners();
        this.updateView();
        this.firstLoad = false;
        this.loadProjectColors();
        
        // Use getOrCreateInstance to avoid multiple instances if data-attributes are also used
        this.addSessionModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('addSessionModal'));
    },

    loadProjectColors() {
        const storedColors = localStorage.getItem('project_colors');
        if (storedColors) {
            try {
                const parsed = JSON.parse(storedColors); // should be { name: color, ... }
                for (const [name, color] of Object.entries(parsed)) {
                    this.project_colors.set(name, color);
                }
            } catch (e) {
                console.warn("Failed to parse project_colors from localStorage", e);
            }
        }
    },

    // Helper to get Sunday of the week containing the date
    getEndOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay(); // 0 (Sun) to 6 (Sat)
        const diff = day === 0 ? 0 : 7 - day;
        d.setDate(d.getDate() + diff);
        return d;
    },

    initEventListeners() {
        const durationInput = document.getElementById('form-duration');
        const startInput = document.getElementById('form-start');
        const endInput = document.getElementById('form-end');

        const updateEnd = () => {
            const startMins = this.timeToMinutes(startInput.value);
            const duration = parseInt(durationInput.value) || 0;
            endInput.value = this.minutesToTime(startMins + duration);
        };

        const updateStart = () => {
            const endMins = this.timeToMinutes(endInput.value);
            const duration = parseInt(durationInput.value) || 0;
            startInput.value = this.minutesToTime(endMins - duration);
        };

        startInput.addEventListener('change', updateEnd);
        endInput.addEventListener('change', updateStart);
        durationInput.addEventListener('input', updateStart);

        const form = document.getElementById('sessionForm');

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveSessionModal();
        });

    },

    // --- Data Management ---
    loadData() {
        const stored = localStorage.getItem('pomodoro_sessions');
        if (stored) {
            this.sessions = JSON.parse(stored);
        } else {
            this.sessions = [];
        }
    },

    saveData() {
        localStorage.setItem('pomodoro_sessions', JSON.stringify(this.sessions));
    },

    loadSettings() {
        const stored = localStorage.getItem('pomodoro_settings');
        if (stored) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(stored) };
            } catch (e) {
                console.error("Error parsing settings", e);
            }
        }
        this.applySettings();
    },

    saveSettings() {
        const duration = parseInt(document.getElementById('settings-form-duration').value);
        const timelineStartHour = parseInt(document.getElementById('settings-form-timeline-start').value);
        const timelineEndHour = parseInt(document.getElementById('settings-form-timeline-end').value);
        if (!isNaN(duration)) this.settings.defaultDuration = duration;
        if (!isNaN(timelineStartHour)) this.settings.timelineStartHour = timelineStartHour;
        if (!isNaN(timelineEndHour)) this.settings.timelineEndHour = timelineEndHour;
        localStorage.setItem('pomodoro_settings', JSON.stringify(this.settings));
        this.applySettings();
        this.updateView();
    },

    applySettings() {
        document.getElementById('settings-form-duration').value = this.settings.defaultDuration;
        document.getElementById('settings-form-timeline-start').value = this.settings.timelineStartHour;
        document.getElementById('settings-form-timeline-end').value = this.settings.timelineEndHour;
    },

    saveSessionModal() {
        const id = document.getElementById('form-id').value;
        const project = document.getElementById('form-project').value;
        const date = document.getElementById('form-date').value;
        const startTime = document.getElementById('form-start').value;
        const duration = parseInt(document.getElementById('form-duration').value);
      
        this.saveSession(id, project, date, startTime, duration);
        console.log(`Session ${id ? 'updated' : 'created'}:`, { id, project, date, startTime, duration });
        this.addSessionModal.hide();
    },

    saveSession(id, project, date, startTime, duration) {
      if (id) {
        const index = this.sessions.findIndex(s => s.id == id);
        if (index !== -1) {
            this.sessions[index] = {
                ...this.sessions[index],
                project: project,
                date: date,
                start_time: startTime,
                duration_min: duration,
            };
        }
      } else {
        const session = {
            id: Date.now(),
            project: project,
            date: date,
            start_time: startTime,
            duration_min: duration,
        };
        console.log("Saving new session:", session);
        this.sessions.push(session);
      }
      this.saveData();
      this.updateView();
    },

    exportData() {
        const dataStr = JSON.stringify(this.sessions, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pomodoro_sessions_${this.formatDate(new Date())}.json`;
        link.click();
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    this.sessions = imported;
                    this.saveData();
                    this.updateView();
                    alert('Data imported successfully!');
                }
            } catch (err) {
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    },

    clearData() {
      if (confirm('Are you sure you want to delete ALL session data? This cannot be undone.')) {
          this.sessions = [];
          this.saveData();
          this.updateView();
      }
    },

    // --- View Routing ---
    showView(viewName, params = {}) {
        const previousView = this.currentView;
        this.currentView = viewName;
        
        // Handle params
        if (params.date) {
            this.selectedDate = this.parseDate(params.date);
            this.windowEndDate = this.getEndOfWeek(this.selectedDate);
        } else if (viewName === 'weekly') {
            const now = new Date();
            this.firstLoad = true;
            this.selectedDate = new Date(now);
            this.selectedDate.setHours(0,0,0,0);
            this.windowEndDate = new Date(this.selectedDate);
            this.currentMonth = now.getMonth();
            this.currentYear = now.getFullYear();
        }


        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');

        this.updateView();
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const nav = document.getElementById(`nav-${viewName}`);
        if (nav) nav.classList.add('active');


        this.firstLoad = false;
    },

    toggleSessionModal(params = {}) {
        const els = {
            id: document.getElementById('form-id'),
            title: document.getElementById('sessionModalLabel'),
            save: document.getElementById('session-save-btn'),
            del: document.getElementById('session-delete-btn'),
            project: document.getElementById('form-project'),
            date: document.getElementById('form-date'),
            start: document.getElementById('form-start'),
            end: document.getElementById('form-end'),
            duration: document.getElementById('form-duration'),
        };

        const isEdit = Boolean(params.id);
        let sessionData;

        if (isEdit) {
            els.id.value = params.id;
            console.log("Editing session with ID:", params.id);
            sessionData = this.sessions.find(s => s.id === params.id);
            sessionData.project = sessionData.project || 'Uncategorized';
        } else {
            els.id.value = '';

            const now = new Date();
            const duration = params.duration ?? this.settings.defaultDuration;
            const endTime = params.start
                ? new Date(params.start)
                : now;

            const startTime = new Date(endTime.getTime() - duration * 60000);

            sessionData = {
                project: params.project ?? '',
                date: params.date ?? this.formatDate(this.selectedDate),
                start_time: params.start
                    ? this.formatTime(new Date(params.start))
                    : this.formatTime(startTime),
                duration_min: duration,
            };
        }

        // Populate form
        els.project.value = sessionData.project;
        els.date.value = sessionData.date;
        els.start.value = sessionData.start_time;
        els.duration.value = sessionData.duration_min;

        // Calculate end time
        const startMins = this.timeToMinutes(sessionData.start_time);
        els.end.value = this.minutesToTime(startMins + sessionData.duration_min);

        // UI state
        els.title.innerText = isEdit ? '📝 Edit Session' : '📝 Log Session';
        els.save.innerText = isEdit ? 'Update Session' : 'Save Session';
        els.del.classList.toggle('d-none', !isEdit);

        if (isEdit) {
            els.del.onclick = () => {
                this.sessions = this.sessions.filter(s => s.id !== params.id);
                this.saveData();
                this.renderDashboard();
            };
        }

        this.addSessionModal.show();
    },


    updateView() {
        if (this.currentView === 'weekly') this.renderDashboard();
        if (this.currentView === 'monthly') this.renderMonthly();
    },

    getProjectColor(projectName) {
      if (this.project_colors.has(projectName)) {
          return this.project_colors.get(projectName).color;
      }
      return stringToColor(projectName);
    },

    setProjectColor(projectName, newColor) {
      this.project_colors.set(projectName, { color: newColor });
      const obj = Object.fromEntries(this.project_colors);
      localStorage.setItem('project_colors', JSON.stringify(obj));
    },

    // --- Rendering Logic ---

    renderDashboard() {
        const selectedDateStr = this.formatDate(this.selectedDate);

        const isMobile = window.innerWidth < 600;

        document.getElementById('selectedDayDisplay').innerText =
            this.selectedDate.toLocaleDateString(undefined, isMobile
                ? { month: 'short', day: 'numeric', year: 'numeric' }
                : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
            );

        const end = new Date(this.windowEndDate);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);

        const chartLabels = [];
        const chartHours = [];
        const chartColors = [];
        const chartBorders = [];
        const projects = new Map();

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = this.formatDate(d);
            const daySessions = this.sessions.filter(s => s.date === dateStr);
            
            const totalMins = daySessions.reduce((sum, s) => sum + s.duration_min, 0);
            const totalHours = totalMins / 60;
            const isSelected = dateStr === selectedDateStr;

            for (const s of daySessions) {
                const projectName = s.project || 'Uncategorized';
                if (!projects.has(projectName)) {
                    projects.set(projectName, { color: this.getProjectColor(projectName), duration_day: 0, duration_week: 0 });
                }
                projects.get(projectName).duration_week += s.duration_min;
                if (s.date === selectedDateStr) {
                    projects.get(projectName).duration_day += s.duration_min;
                }
            }

            chartLabels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
            chartHours.push(totalHours);
            chartColors.push(isSelected ? 'rgba(59, 104, 83, 0.9)' : 'rgba(81, 144, 114, 0.6)');
            chartBorders.push(isSelected ? 2 : 0);
        }

        this.renderWeeklyChart(chartLabels, chartHours,  chartColors, chartBorders, start);
        this.renderProjectTable(projects);
        this.renderTimeline(selectedDateStr);
    },

    renderWeeklyChart(labels, hours, colors, borders, startDate) {
        const ctx = document.getElementById('pomodoroChart').getContext('2d');
        if (this.charts.dashboard) this.charts.dashboard.destroy();

        this.charts.dashboard = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Hours',
                        type: 'bar',
                        data: hours,
                        backgroundColor: colors,
                        borderColor: '#3B6853',
                        borderWidth: borders,
                        borderRadius: 5,
                        yAxisID: 'y'
                    },
                ]
            },
            options: {
                animation: this.firstLoad,
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 8 } },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const targetDate = new Date(startDate);
                        targetDate.setDate(targetDate.getDate() + index);
                        this.selectedDate = targetDate;
                        this.renderDashboard();
                    }
                },
                onHover: (e, elements) => {
                  e.native.target.style.cursor = elements.length > 0 ? 'pointer': 'default';
                },
            }
        });
    },


    renderProjectTable(projects) {
        const body = document.getElementById('statsTableBody');
        body.innerHTML = '';
        projects.forEach((data, name) => {
            const tr = document.createElement('tr');

            const isActive = this.timer.project === name && this.timer.isRunning;
            const icon = isActive ? 'bi-pause-fill' : 'bi-play-fill';
            const projectName = name || '';


            tr.innerHTML = `
                <td>
                    <span class="badge" 
                          style="background-color: ${data.color}; width: 16px; height: 16px; display: inline-block; margin-right: 8px; border-radius: 4px; cursor: pointer;" 
                          onclick="this.nextElementSibling.click()">
                    </span>
                    <input type="text" value="${data.color}" class="coloris-input" style="width:1px;height:1px;opacity:0;position:absolute;" data-coloris
                           oninput="app.setProjectColor('${name}', this.value); app.renderDashboard();">
                    ${name}
                </td>
                <td class="text-center">${(data.duration_week / 60).toFixed(2)}h</td>
                <td class="text-center">${(data.duration_day / 60).toFixed(2)}h</td>
                <td class="text-center">
                    <button class="btn btn-secondary" onClick="app.toggleSessionModal({ project : '${projectName}'})">
                      <i class="bi bi-plus"></i>
                    </button>
                    <button class="btn btn-secondary" onClick="app.toggleTimer('${projectName}')">
                        <i class="bi ${icon}"></i>
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });
    },

    renderTimeline(dateStr) {
        const daySessions = this.sessions.filter(s => s.date === dateStr);

        const timelineData = this.prepareTimelineData(daySessions);
        
        const startHour = this.settings.timelineStartHour;
        const endHour = this.settings.timelineEndHour;
        const configuredMin = Math.min(startHour, endHour);
        const configuredMax = Math.max(startHour, endHour);
        
        let displayMin = configuredMin;
        let displayMax = configuredMax;

        if (timelineData.length > 0) {
          const starts = timelineData.map(s => s.x[0]);
          const ends   = timelineData.map(s => s.x[1]);

          const minSessionStart = Math.min(...starts);
          const maxSessionEnd   = Math.max(...ends);
          displayMin = Math.min(configuredMin, Math.floor(minSessionStart - 0.5));
          displayMax = Math.max(configuredMax, Math.ceil(maxSessionEnd + 0.5));
        }
        
        const ctx = document.getElementById('mainTimelineChart').getContext('2d');
        if (this.charts.timeline) this.charts.timeline.destroy();

        this.charts.timeline = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Timeline'],
                datasets: [{
                    data: timelineData,
                    backgroundColor: timelineData.map(d => d.color),
                    borderWidth: 1,
                    borderRadius: {topLeft: 5, topRight: 5, bottomLeft: 5, bottomRight: 5},
                    barPercentage: 3.0,
                     borderSkipped: false,
                }]
            },
            options: {
                indexAxis: 'y',
                animation: this.firstLoad,
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                     x: { min: displayMin, max: displayMax, ticks: { stepSize: 2, callback: v => v + ":00" } },
                    y: { display: false }
                },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const sessionData = this.charts.timeline.data.datasets[0].data[elements[0].index];
                        this.toggleSessionModal({ id: sessionData.id });
                    }
                },
                onHover: (e, elements) => {
                  e.native.target.style.cursor = elements.length > 0 ? 'pointer': 'default';
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const d = context.raw;
                                return `${d.project}: ${d.start_time} (${d.duration} mins)`;
                            }
                        }
                    }
                }
            }
        });
    },

    renderMonthly() {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('monthDisplay').innerText = `${monthNames[this.currentMonth]} ${this.currentYear}`;

        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        
        let startPadding = firstDay.getDay() - 1;
        if (startPadding === -1) startPadding = 6;

        const container = document.getElementById('heatmapContainer');
        container.innerHTML = '';

        for (let i = 0; i < startPadding; i++) {
            const div = document.createElement('div');
            div.className = 'heatmap-day empty';
            container.appendChild(div);
        }

        const monthSessions = this.sessions.filter(s => {
            const d = this.parseDate(s.date);
            return d.getMonth() === this.currentMonth && d.getFullYear() === this.currentYear;
        });

        const dailyHours = {};
        let maxHours = 1;
        monthSessions.forEach(s => {
            const day = this.parseDate(s.date).getDate();
            dailyHours[day] = (dailyHours[day] || 0) + (s.duration_min / 60);
            if (dailyHours[day] > maxHours) maxHours = dailyHours[day];
        });

        const todayStr = this.formatDate(new Date());

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateObj = new Date(this.currentYear, this.currentMonth, day);
            const dateStr = this.formatDate(dateObj);
            const hours = dailyHours[day] || 0;
            const opacity = hours > 0 ? (0.1 + (hours / maxHours) * 0.9) : 0;

            const div = document.createElement('div');
            div.className = `heatmap-day ${dateStr === todayStr ? 'today' : ''}`;
            div.style.backgroundColor = hours > 0 ? `rgba(81, 144, 114, ${opacity})` : 'white';
            div.style.cursor = 'pointer';
            div.onclick = () => this.showView('weekly', { date: dateStr });
            
            div.innerHTML = `
                <span class="fw-bold">${day}</span>
                ${dateStr === todayStr ? '<div class="small fw-bold">Today</div>' : ''}
                ${hours > 0 ? `<div class="small mt-1">${hours.toFixed(1)}h</div>` : ''}
            `;
            container.appendChild(div);
        }
    },

    // --- Timer Logic ---
    toggleTimer(project) {
      // save new session
      if (this.timer.isRunning) {
          this.saveSession(
              null,
              this.timer.project,
              this.formatDate(new Date()),
              this.formatTime(new Date(this.timer.startTime)),
              Math.round((Date.now() - this.timer.startTime) / 60000)
          );
      }

      if (this.timer.project === project) {
          this.timer.isRunning = !this.timer.isRunning;

          if (this.isRunning) {
              this.startTime = Date.now();
          }

      } else {
          this.timer.project = project;
          this.timer.isRunning = true;
          this.timer.startTime = Date.now();
      }
      this.renderDashboard();
    },

    // --- Helpers ---

    parseDate(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    },

    formatDate(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    prepareTimelineData(sessions) {
        return sessions.map(s => {
            const [h, m] = s.start_time.split(':').map(Number);
            const startDecimal = h + (m / 60);
            const durationHours = s.duration_min / 60;
            const endDecimal = startDecimal + durationHours;
            const projectName = s.project || 'Uncategorized';
            const color = this.getProjectColor(projectName);

            return {
                id: s.id,
                x: [startDecimal, endDecimal],
                y: 'Session',
                duration: s.duration_min,
                start_time: s.start_time,
                project: projectName,
                color: color
            };
        });
    },

    timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    },

    minutesToTime(totalMinutes) {
        let mins = totalMinutes;
        while (mins < 0) mins += 1440;
        while (mins >= 1440) mins -= 1440;
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    },

    formatTime(date) {
        return date.toTimeString().slice(0, 5);
    },

    changeMonth(direction) {
        this.currentMonth += direction;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.renderMonthly();
    },

    shiftWindow(direction) {
        this.windowEndDate.setDate(this.windowEndDate.getDate() + direction);
        this.renderDashboard();
    }
};

// Initialize app on load
window.onload = () => app.init();
