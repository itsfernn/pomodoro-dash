/**
 * Pomodoro Stats - Static SPA App Logic
 */

const app = {
    // --- State ---
    sessions: [],
    currentView: 'weekly',
    selectedDate: new Date(),
    windowEndDate: new Date(),
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    firstLoad: true,

    charts: {
        dashboard: null,
        timeline: null
    },

    // --- Initialization ---
    init() {
        this.selectedDate.setHours(0,0,0,0);
        // Initial load shows the 7 days ending today
        this.windowEndDate = new Date(this.selectedDate);
        this.loadData();
        this.initEventListeners();
        this.updateView();
        this.firstLoad = false;
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
        const form = document.getElementById('sessionForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSession();
        });

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

    saveSession() {
        const date = document.getElementById('form-date').value;
        const startTime = document.getElementById('form-start').value;
        const duration = parseInt(document.getElementById('form-duration').value);
        const quality = parseInt(document.getElementById('form-quality').value) || null;

        const session = {
            id: Date.now(),
            date,
            start_time: startTime,
            duration_min: duration,
            quality
        };

        this.sessions.push(session);
        this.saveData();
        this.showView('weekly');
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

    // --- View Routing ---
    showView(viewName, params = {}) {
        this.currentView = viewName;
        
        // Handle params
        if (params.date) {
            this.selectedDate = this.parseDate(params.date);
            this.windowEndDate = this.getEndOfWeek(this.selectedDate);
        }

        if (viewName === 'add') {
            const now = new Date();
            document.getElementById('form-date').value = this.formatDate(now);
            document.getElementById('form-start').value = this.formatTime(new Date(now.getTime() - 25 * 60000));
            document.getElementById('form-end').value = this.formatTime(now);
            document.getElementById('form-duration').value = 25;
            document.getElementById('form-quality').value = '';
        }

        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const nav = document.getElementById(`nav-${viewName}`);
        if (nav) nav.classList.add('active');

        this.updateView();
    },

    updateView() {
        if (this.currentView === 'weekly') this.renderDashboard();
        if (this.currentView === 'monthly') this.renderMonthly();
    },

    // --- Rendering Logic ---

    renderDashboard() {
        const selectedDateStr = this.formatDate(this.selectedDate);
        
        document.getElementById('selectedDayDisplay').innerText = 
            this.selectedDate.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});

        const end = new Date(this.windowEndDate);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);

        const stats = [];
        const chartLabels = [];
        const chartHours = [];
        const chartQuality = [];
        const chartColors = [];
        const chartBorders = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = this.formatDate(d);
            const daySessions = this.sessions.filter(s => s.date === dateStr);
            
            const sessionsCount = daySessions.length;
            const totalMins = daySessions.reduce((sum, s) => sum + s.duration_min, 0);
            const totalHours = totalMins / 60;
            const avgQuality = sessionsCount > 0 
                ? daySessions.reduce((sum, s) => sum + (s.quality || 0), 0) / daySessions.filter(s => s.quality).length || 0
                : 0;

            const isSelected = dateStr === selectedDateStr;

            stats.push({
                date: dateStr,
                weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
                sessions: sessionsCount,
                hours: totalHours.toFixed(2),
                quality: avgQuality.toFixed(1),
                isSelected: isSelected
            });

            chartLabels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
            chartHours.push(totalHours);
            chartQuality.push(avgQuality);
            chartColors.push(isSelected ? 'rgba(59, 104, 83, 0.9)' : 'rgba(81, 144, 114, 0.6)');
            chartBorders.push(isSelected ? 2 : 0);
        }

        this.renderWeeklyChart(chartLabels, chartHours, chartQuality, chartColors, chartBorders, start);
        this.renderWeeklyTable(stats);
        this.renderTimeline(selectedDateStr);
    },

    renderWeeklyChart(labels, hours, quality, colors, borders, startDate) {
        const ctx = document.getElementById('pomodoroChart').getContext('2d');
        if (this.charts.dashboard) this.charts.dashboard.destroy();

        this.charts.dashboard = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Quality',
                        data: quality,
                        type: 'line',
                        borderColor: '#55828B',
                        backgroundColor: '#55828B',
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Hours',
                        type: 'bar',
                        data: hours,
                        backgroundColor: colors,
                        borderColor: '#3B6853',
                        borderWidth: borders,
                        borderRadius: 5,
                        yAxisID: 'y1'
                    },
                ]
            },
            options: {
                animation: this.firstLoad,
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 10, position: 'right', grid: { drawOnChartArea: false } },
                    y1: { beginAtZero: true, max: 8 },
                },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const targetDate = new Date(startDate);
                        targetDate.setDate(targetDate.getDate() + index);
                        this.selectedDate = targetDate;
                        this.renderDashboard();
                    }
                }
            }
        });
    },

    renderWeeklyTable(stats) {
        const body = document.getElementById('statsTableBody');
        body.innerHTML = '';
        stats.reverse().forEach(row => {
            const qualityBadge = row.quality > 0 
                ? `<span class="badge bg-${row.quality >= 7 ? 'success' : row.quality >= 4 ? 'warning' : 'danger'}">${row.quality}</span>` 
                : '-';
            const tr = document.createElement('tr');
            if (row.isSelected) tr.className = 'table-primary';
            tr.style.cursor = 'pointer';
            tr.onclick = () => {
                this.selectedDate = this.parseDate(row.date);
                this.renderDashboard();
            };
            tr.innerHTML = `
                <td class="fw-bold">${row.weekday}</td>
                <td class="text-muted small">${row.date}</td>
                <td class="text-center">${row.sessions}</td>
                <td class="text-center">${row.hours}h</td>
                <td class="text-center">${qualityBadge}</td>
            `;
            body.appendChild(tr);
        });
    },

    renderTimeline(dateStr) {
        const daySessions = this.sessions.filter(s => s.date === dateStr);
        const timelineData = this.prepareTimelineData(daySessions);
        
        const ctx = document.getElementById('mainTimelineChart').getContext('2d');
        if (this.charts.timeline) this.charts.timeline.destroy();

        this.charts.timeline = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Timeline'],
                datasets: [{
                    data: timelineData,
                    backgroundColor: timelineData.map(d => d.color),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                animation: this.firstLoad,
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { min: 6, max: 22, ticks: { stepSize: 2, callback: v => v + ":00" } },
                    y: { display: false }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const d = context.raw;
                                return ` ${d.start_time} (${d.duration} mins) | Quality: ${d.quality}`;
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

            let color = 'rgba(255, 193, 7, 0.7)'; // Warning Yellow
            if (s.quality >= 7) color = 'rgba(25, 135, 84, 0.7)'; // Success Green
            else if (s.quality <= 3 && s.quality !== null) color = 'rgba(220, 53, 69, 0.7)'; // Danger Red

            return {
                x: [startDecimal, endDecimal],
                y: 'Sessions',
                quality: s.quality || '-',
                duration: s.duration_min,
                start_time: s.start_time,
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
