// Parfait Life App - Main JavaScript File

// Configuration
const CONFIG = {
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyDyCVERAjM1pngXDWs-dR7CJDdFCZSPLYg",
        authDomain: "habitstracker-f050b.firebaseapp.com",
        databaseURL: "https://habitstracker-f050b-default-rtdb.firebaseio.com",
        projectId: "habitstracker-f050b",
        storageBucket: "habitstracker-f050b.firebasestorage.app",
        messagingSenderId: "41966376800",
        appId: "1:41966376800:web:8e7fc25f19bb8022f17005",
        measurementId: "G-1DTZC07DS2"
    },
    CLOUDINARY: {
        cloudName: 'dcybix8yr',
        uploadPreset: 'ml_default'  // Create this preset in Cloudinary dashboard if missing
    }
};

// Global State
let appState = {
    isAuthenticated: false,
    currentView: 'self-development',
    habits: [],
    calendar: {},
    incomeCards: [],
    videos: [],
    motivationCards: [],
    quotes: [],
    secrets: [],
    audioPlaylist: [],
    currentAudioIndex: 0,
    charts: {},
    videoThumbnailCache: {} // Cache for generated video thumbnails
};

let audioPlayer = new Audio();
let currentVideoIndex = 0;

// Firebase references
let database, storage;

// Initialize App
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

function initializeApp() {
    // Check if user is already authenticated
    const sessionAuth = sessionStorage.getItem('parfaitAuthenticated');
    if (sessionAuth === 'true') {
        appState.isAuthenticated = true;
        showApp();
        initializeFirebase();
        loadUserData();
    } else {
        showAuthModal();
    }

    setupEventListeners();
    setupAnimations();

    audioPlayer.addEventListener('ended', () => {
        // Random autoplay
        if (appState.audioPlaylist.length > 1) {
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * appState.audioPlaylist.length);
            } while (nextIndex === appState.currentAudioIndex);
            appState.currentAudioIndex = nextIndex;
            loadAudioTrack(appState.currentAudioIndex);
            audioPlayer.play();
        }
    });
}

// Authentication Functions
function showAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('hidden');

    const passwordInput = document.getElementById('passwordInput');
    passwordInput.focus();
    passwordInput.value = '';

    // Clear any previous error
    const error = document.getElementById('authError');
    error.classList.add('hidden');
}

function hideAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.add('hidden');
}

// Hash function using SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function authenticate() {
    const passwordInput = document.getElementById('passwordInput');
    const password = passwordInput.value;
    const errorElement = document.getElementById('authError');
    const authButton = document.getElementById('authButton');

    if (!password) {
        errorElement.classList.remove('hidden');
        return;
    }

    // Show loading state
    const originalButtonText = authButton.textContent;
    authButton.textContent = 'Verifying...';
    authButton.disabled = true;
    errorElement.classList.add('hidden');

    try {
        // Initialize Firebase first if not already initialized
        if (!database) {
            firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
            database = firebase.database();
            storage = firebase.storage();
        }

        // Hash the entered password
        const hashedPassword = await hashPassword(password);
        console.log('Password hashed successfully');

        // Get stored password hash from Firebase
        const snapshot = await database.ref('auth/passwordHash').once('value');
        const storedHash = snapshot.val();
        console.log('Retrieved hash from Firebase');

        // If no hash exists in Firebase, set it up (first time setup)
        if (!storedHash) {
            console.log('No stored hash found, setting up default password');
            // Hash the default password "Parfait42!!" and store it
            const defaultHash = await hashPassword('Parfait42!!');
            await database.ref('auth/passwordHash').set(defaultHash);

            // Check if entered password matches default
            if (hashedPassword === defaultHash) {
                console.log('Authentication successful (first time setup)');
                appState.isAuthenticated = true;
                sessionStorage.setItem('parfaitAuthenticated', 'true');
                hideAuthModal();
                showApp();
                setupFirebaseListeners();
                loadUserData();
            } else {
                console.log('Authentication failed - incorrect password');
                errorElement.classList.remove('hidden');
                passwordInput.value = '';
                passwordInput.focus();
                authButton.textContent = originalButtonText;
                authButton.disabled = false;
            }
        } else {
            // Compare hashes
            if (hashedPassword === storedHash) {
                console.log('Authentication successful');
                appState.isAuthenticated = true;
                sessionStorage.setItem('parfaitAuthenticated', 'true');
                hideAuthModal();
                showApp();
                setupFirebaseListeners();
                loadUserData();
            } else {
                console.log('Authentication failed - incorrect password');
                errorElement.classList.remove('hidden');
                passwordInput.value = '';
                passwordInput.focus();
                authButton.textContent = originalButtonText;
                authButton.disabled = false;
            }
        }
    } catch (err) {
        console.error('Authentication error:', err);
        errorElement.textContent = 'Connection error. Please try again.';
        errorElement.classList.remove('hidden');
        passwordInput.value = '';
        passwordInput.focus();
        authButton.textContent = originalButtonText;
        authButton.disabled = false;
    }
}

function showApp() {
    const appContainer = document.getElementById('appContainer');
    appContainer.classList.remove('hidden');
}

// Firebase Integration
function initializeFirebase() {
    try {
        firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
        database = firebase.database();
        storage = firebase.storage();

        console.log('Firebase initialized successfully');

        // Set up real-time listeners
        setupFirebaseListeners();
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showNotification('Failed to connect to database');
    }
}

function setupFirebaseListeners() {
    const userId = 'parfait_user';

    database.ref(`users/${userId}/habits`).on('value', (snapshot) => {
        const habitsData = snapshot.val();
        appState.habits = habitsData ? Object.values(habitsData) : [];
        console.log('Habits loaded:', appState.habits.length);
        if (appState.currentView === 'self-development') {
            updateHabitsTable();
            updateConsistencyChart();
        }
    });

    database.ref(`users/${userId}/calendar`).on('value', (snapshot) => {
        appState.calendar = snapshot.val() || {};
        console.log('Calendar loaded:', Object.keys(appState.calendar).length, 'dates');
        if (appState.currentView === 'self-development') {
            updateHabitsTable();
            updateConsistencyChart();
        }
    });

    database.ref(`users/${userId}/incomeCards`).on('value', (snapshot) => {
        appState.incomeCards = snapshot.val() ? Object.values(snapshot.val()) : [];
        if (appState.currentView === 'income') renderIncomeView();
    });

    database.ref(`users/${userId}/videos`).on('value', (snapshot) => {
        appState.videos = snapshot.val() ? Object.values(snapshot.val()) : [];
        if (appState.currentView === 'remember') renderRememberView();
    });

    database.ref(`users/${userId}/quotes`).on('value', (snapshot) => {
        appState.quotes = snapshot.val() ? Object.values(snapshot.val()) : [];
        if (appState.currentView === 'read') renderReadView();
    });

    database.ref(`users/${userId}/secrets`).on('value', (snapshot) => {
        appState.secrets = snapshot.val() ? Object.values(snapshot.val()) : [];
        if (appState.currentView === 'secrets') renderSecretsView();
    });

    database.ref(`users/${userId}/motivationCards`).on('value', (snapshot) => {
        appState.motivationCards = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderMotivationCards();
    });

    database.ref(`users/${userId}/audioPlaylist`).on('value', (snapshot) => {
        const playlistData = snapshot.val();
        appState.audioPlaylist = playlistData ? Object.values(playlistData) : [];

        // Migrate old data: convert 'name' to 'title' and 'uploaded_at' to 'created_at'
        let needsMigration = false;
        appState.audioPlaylist = appState.audioPlaylist.map(audio => {
            if (audio.name && !audio.title) {
                needsMigration = true;
                return {
                    ...audio,
                    title: audio.name,
                    created_at: audio.uploaded_at || audio.created_at || Date.now()
                };
            }
            return audio;
        });

        // Save migrated data back to Firebase
        if (needsMigration) {
            const playlistObj = {};
            appState.audioPlaylist.forEach(a => playlistObj[a.id] = a);
            database.ref(`users/${userId}/audioPlaylist`).set(playlistObj);
        }

        if (appState.audioPlaylist.length > 0) {
            loadAudioTrack(appState.currentAudioIndex);
        }
        if (appState.currentView === 'read') {
            renderAudioManagement();
        }
    });
}

function loadAudioTrack(index) {
    if (appState.audioPlaylist[index]) {
        audioPlayer.src = appState.audioPlaylist[index].url;
        audioPlayer.volume = document.getElementById('volumeControl').value / 100;
    }
}





function loadUserData() {
    // Data is loaded via Firebase listeners
    // Just render initial views
    renderAllViews();
}

function saveToFirebase(path, data) {
    const userId = 'parfait_user';
    return database.ref(`users/${userId}/${path}`).set(data);
}

function pushToFirebase(path, data) {
    const userId = 'parfait_user';
    return database.ref(`users/${userId}/${path}`).push(data);
}

function updateFirebase(path, data) {
    const userId = 'parfait_user';
    return database.ref(`users/${userId}/${path}`).update(data);
}

function deleteFromFirebase(path) {
    const userId = 'parfait_user';
    return database.ref(`users/${userId}/${path}`).remove();
}

// Event Listeners
function setupEventListeners() {
    // Authentication
    const authButton = document.getElementById('authButton');
    const passwordInput = document.getElementById('passwordInput');

    authButton.addEventListener('click', authenticate);
    passwordInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            authenticate();
        }
    });

    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function () {
            const view = this.dataset.view;
            switchView(view);
        });
    });

    // Self Development
    const addHabitBtn = document.getElementById('addHabitBtn');
    const dateRangeSelect = document.getElementById('dateRangeSelect');

    addHabitBtn.addEventListener('click', () => {
        // Clear any hidden ID input to ensure we are adding, not editing
        const hiddenInput = document.getElementById('habitId');
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        document.getElementById('addHabitForm').reset();
        showModal('addHabitModal');
    });
    dateRangeSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        updateHabitsTable();
        updateConsistencyChart(); // Update chart to match selected date range
    });

    const scrollToGraphBtn = document.getElementById('scrollToGraphBtn');
    scrollToGraphBtn.addEventListener('click', () => {
        const chartContainer = document.querySelector('.consistency-chart-container');
        if (chartContainer) {
            // Get the position of the chart container
            const rect = chartContainer.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop - 20; // 20px offset from top

            // Smooth scroll to position
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });

    // Income
    const addIncomeCardBtn = document.getElementById('addIncomeCardBtn');
    addIncomeCardBtn.addEventListener('click', () => showModal('addIncomeCardModal'));

    // Remember
    const uploadVideoBtn = document.getElementById('uploadVideoBtn');
    const prevVideoBtn = document.getElementById('prevVideoBtn');
    const nextVideoBtn = document.getElementById('nextVideoBtn');
    const videoSearchInput = document.getElementById('videoSearchInput');

    uploadVideoBtn.addEventListener('click', handleVideoUpload);
    prevVideoBtn.addEventListener('click', () => navigateVideo(-1));
    nextVideoBtn.addEventListener('click', () => navigateVideo(1));
    videoSearchInput.addEventListener('input', filterVideos);

    // Read
    const addQuoteBtn = document.getElementById('addQuoteBtn');
    const uploadAudioBtn = document.getElementById('uploadAudioBtn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const volumeControl = document.getElementById('volumeControl');

    addQuoteBtn.addEventListener('click', () => showModal('addQuoteModal'));
    uploadAudioBtn.addEventListener('click', handleAudioUpload);
    playPauseBtn.addEventListener('click', toggleAudioPlayback);
    volumeControl.addEventListener('input', (e) => {
        if (audioPlayer) audioPlayer.volume = e.target.value / 100;
    });

    // Secrets
    const addSecretBtn = document.getElementById('addSecretBtn');
    const secretCategoryFilter = document.getElementById('secretCategoryFilter');
    const secretSearchInput = document.getElementById('secretSearchInput');

    addSecretBtn.addEventListener('click', () => {
        document.getElementById('secretId').value = '';
        document.getElementById('secretSubmitBtn').textContent = 'Add Secret';
        showModal('addSecretModal');
    });
    secretCategoryFilter.addEventListener('change', renderSecretsView);
    secretSearchInput.addEventListener('input', renderSecretsView);

    // Motivation
    const addMotivationBtn = document.getElementById('addMotivationBtn');
    addMotivationBtn.addEventListener('click', () => showModal('addMotivationModal'));

    // Modal forms
    setupModalForms();

    // Edit Video Form
    const editVideoForm = document.getElementById('editVideoForm');
    editVideoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        updateVideo();
    });

    // Edit Quote Form
    const editQuoteForm = document.getElementById('editQuoteForm');
    editQuoteForm.addEventListener('submit', function (e) {
        e.preventDefault();
        updateQuote();
    });

    // Window events
    window.addEventListener('beforeunload', function () {
        sessionStorage.removeItem('parfaitAuthenticated');
    });
}

function setupModalForms() {
    // Add Habit Form
    const addHabitForm = document.getElementById('addHabitForm');
    addHabitForm.addEventListener('submit', function (e) {
        e.preventDefault();
        addNewHabit();
    });

    // Add Income Card Form
    const addIncomeCardForm = document.getElementById('addIncomeCardForm');
    addIncomeCardForm.addEventListener('submit', function (e) {
        e.preventDefault();
        addNewIncomeCard();
    });

    // Edit Income Card Form
    const editIncomeCardForm = document.getElementById('editIncomeCardForm');
    editIncomeCardForm.addEventListener('submit', function (e) {
        e.preventDefault();
        updateIncomeCard();
    });

    // Add Motivation Form
    const addMotivationForm = document.getElementById('addMotivationForm');
    addMotivationForm.addEventListener('submit', function (e) {
        e.preventDefault();
        addNewMotivationCard();
    });

    // Add Quote Form
    const addQuoteForm = document.getElementById('addQuoteForm');
    addQuoteForm.addEventListener('submit', function (e) {
        e.preventDefault();
        addNewQuote();
    });

    // Add Secret Form
    const addSecretForm = document.getElementById('addSecretForm');
    addSecretForm.addEventListener('submit', function (e) {
        e.preventDefault();
        addNewSecret();
    });
}

// View Management
function switchView(viewName) {
    // Reset scroll position to top when switching views
    window.scrollTo(0, 0);

    // Pause all media when switching views
    document.querySelectorAll('video, audio').forEach(media => {
        media.pause();
    });

    if (audioPlayer && !audioPlayer.paused) {
        audioPlayer.pause();
    }
    document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-play"></i>';

    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');

    appState.currentView = viewName;

    // Right sidebar is no longer used
    const mainContent = document.querySelector('.main-content');
    mainContent.classList.remove('with-sidebar');

    // Render specific view
    switch (viewName) {
        case 'self-development':
            renderHabitsView();
            break;
        case 'income':
            renderIncomeView();
            break;
        case 'remember':
            renderRememberView();
            break;
        case 'read':
            renderReadView();
            // Play random audio track when entering Read view
            if (appState.audioPlaylist.length > 0) {
                const randomIndex = Math.floor(Math.random() * appState.audioPlaylist.length);
                appState.currentAudioIndex = randomIndex;
                loadAudioTrack(randomIndex);
                audioPlayer.play();
                document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-pause"></i>';
            }
            break;
        case 'secrets':
            renderSecretsView();
            break;
    }
}

function renderAllViews() {
    renderHabitsView();
    renderIncomeView();
    renderRememberView();
    renderMotivationCards();
    renderReadView();
    renderSecretsView();
}

// Self Development View
function renderHabitsView() {
    updateHabitsTable();
    updateConsistencyChart();
}

// Helper to get local date string YYYY-MM-DD
function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updateHabitsTable() {
    const dateRange = parseInt(document.getElementById('dateRangeSelect').value);
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('habitsTableBody');

    // Clear existing content
    tableHeader.innerHTML = '<th>Habits</th>';
    tableBody.innerHTML = '';

    // Generate date columns - TODAY FIRST, then go backwards
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create dates array: today, yesterday, day before, etc.
    for (let i = 0; i < dateRange; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i); // Subtract days to go backwards
        dates.push(date);
    }

    // Generate header columns
    let lastMonth = '';
    dates.forEach((date, index) => {
        const th = document.createElement('th');
        const currentMonth = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();

        // Highlight today's column
        if (index === 0) {
            th.style.background = 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)';
            th.style.color = 'white';
            th.innerHTML = `<div style="font-size: 11px; font-weight: 700;">TODAY</div><div>${day}</div>`;
        } else if (currentMonth !== lastMonth) {
            th.innerHTML = `<div style="font-size: 11px; color: #667eea; font-weight: 700;">${currentMonth}</div><div>${day}</div>`;
            lastMonth = currentMonth;
        } else {
            th.textContent = day;
        }

        tableHeader.appendChild(th);
    });

    // Generate habit rows
    appState.habits.forEach(habit => {
        const row = document.createElement('tr');

        // Habit name cell
        const nameCell = document.createElement('td');
        nameCell.innerHTML = `
            <span class="habit-icon">${getHabitIcon(habit.icon)}</span>
            <div class="habit-name">
                <span>${habit.name}</span>
                <div class="habit-actions">
                    <button class="btn-icon" onclick="editHabit('${habit.id}')" title="Rename">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteHabit('${habit.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        row.appendChild(nameCell);

        // Date cells
        dates.forEach((date, index) => {
            const dateStr = getLocalDateString(date);
            const cell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'habit-checkbox';

            // Load checked state from calendar
            const isChecked = appState.calendar[dateStr]?.[habit.id] || false;
            checkbox.checked = isChecked;

            // Debug log for today's date
            if (index === 0) {
                console.log(`Habit ${habit.name} on ${dateStr}:`, isChecked, 'Calendar data:', appState.calendar[dateStr]);
            }

            // ONLY TODAY (index 0) is editable
            // All past days are read-only
            if (index === 0) {
                // Today - fully editable
                checkbox.title = 'Today - Click to mark complete';
                checkbox.style.cursor = 'pointer';
            } else {
                // All past days - read-only
                checkbox.disabled = true;
                checkbox.style.opacity = '0.3';
                checkbox.style.cursor = 'not-allowed';
                checkbox.title = 'Past day - View only';
            }

            checkbox.addEventListener('change', function () {
                toggleHabit(habit.id, dateStr, this.checked);
            });

            cell.appendChild(checkbox);
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });
}

function getHabitIcon(iconName) {
    const icons = {
        book: '📚',
        dumbbell: '🏋️',
        meditation: '🧘',
        water: '💧',
        sleep: '😴',
        heart: '❤️'
    };
    return icons[iconName] || '';
}

function toggleHabit(habitId, date, completed) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = getLocalDateString(today);

    // Only allow editing today
    if (date !== todayStr) {
        showNotification('Only today can be edited!');
        updateHabitsTable();
        return;
    }

    if (!appState.calendar[date]) {
        appState.calendar[date] = {};
    }
    appState.calendar[date][habitId] = completed;

    saveToFirebase('calendar', appState.calendar);
    showNotification(`Habit ${completed ? 'completed' : 'uncompleted'}!`);
}

function updateConsistencyChart() {
    const canvas = document.getElementById('consistencyChart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (appState.charts.consistency) {
        appState.charts.consistency.destroy();
    }

    // Calculate consistency data - SAME AS TABLE: today backwards
    const dateRange = parseInt(document.getElementById('dateRangeSelect').value);
    const dates = [];
    const consistency = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create dates array: today, yesterday, day before, etc.
    for (let i = 0; i < dateRange; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i); // Go backwards
        const dateStr = getLocalDateString(date);

        // Format label
        if (i === 0) {
            dates.push('Today');
        } else if (i === 1) {
            dates.push('Yesterday');
        } else {
            dates.push(date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            }));
        }

        // Calculate actual completion percentage for this date
        const dayData = appState.calendar[dateStr] || {};
        const totalHabits = appState.habits.length;

        if (totalHabits === 0) {
            consistency.push(0);
        } else {
            // Count only the habits that exist in the current habits list
            let completedCount = 0;
            appState.habits.forEach(habit => {
                if (dayData[habit.id] === true) {
                    completedCount++;
                }
            });
            const percentage = (completedCount / totalHabits) * 100;
            consistency.push(Math.round(percentage));
        }
    }

    // Reverse arrays so chart shows oldest to newest (left to right)
    dates.reverse();
    consistency.reverse();

    // Create chart
    appState.charts.consistency = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Consistency %',
                data: consistency,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow chart to fill container height
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return 'Completion: ' + context.parsed.y + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: function (value) {
                            return value + '%';
                        },
                        stepSize: 20,
                        autoSkip: false,
                        maxTicksLimit: 6
                    },
                    grid: {
                        display: true
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            },
            elements: {
                point: {
                    hoverRadius: 8
                }
            }
        }
    });
}

function addNewHabit() {
    const habitId = document.getElementById('habitId') ? document.getElementById('habitId').value : '';
    const name = document.getElementById('habitName').value;

    const habit = {
        id: habitId || 'h' + Date.now(),
        name: name,
        order: habitId ? appState.habits.find(h => h.id === habitId)?.order : appState.habits.length,
        created_at: habitId ? appState.habits.find(h => h.id === habitId)?.created_at : Date.now()
    };

    const habitsObj = {};
    appState.habits.forEach(h => habitsObj[h.id] = h);
    habitsObj[habit.id] = habit;

    saveToFirebase('habits', habitsObj);
    closeModal('addHabitModal');
    document.getElementById('addHabitForm').reset();

    showNotification(habitId ? 'Habit updated successfully!' : 'Habit added successfully!');
}

function editHabit(habitId) {
    const habit = appState.habits.find(h => h.id === habitId);
    if (!habit) return;

    if (!document.getElementById('habitId')) {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'habitId';
        document.getElementById('addHabitForm').prepend(hiddenInput);
    }

    document.getElementById('habitId').value = habit.id;
    document.getElementById('habitName').value = habit.name;

    showModal('addHabitModal');
}

function deleteHabit(habitId) {
    if (confirm('Are you sure you want to delete this habit?')) {
        deleteFromFirebase(`habits/${habitId}`);
        showNotification('Habit deleted successfully!');
    }
}

// Income View
function renderIncomeView() {
    updateIncomeCards();
    updateIncomeSummary();
    updateIncomeChart();

    // Apply staggered animations
    const summaryCards = document.querySelectorAll('.summary-card');
    const incomeCards = document.querySelectorAll('.income-card');
    applyStaggeredAnimation(summaryCards, 100);
    applyStaggeredAnimation(incomeCards, 50);
}

function applyStaggeredAnimation(elements, delay) {
    elements.forEach((el, index) => {
        el.classList.add('will-animate');
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, delay * index);
    });
}

function updateIncomeCards() {
    const grid = document.getElementById('incomeCardsGrid');
    grid.innerHTML = '';

    appState.incomeCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'income-card';
        cardElement.innerHTML = `
            <div class="card-header">
                <div class="card-title">${card.title}</div>
                <div class="card-type">${card.type}</div>
            </div>
            <div class="card-balance">${formatCurrency(card.balance, card.currency)}</div>
            <div class="card-currency">${card.currency}</div>
            <div class="card-actions">
                <button class="btn-icon" onclick="editIncomeCard('${card.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deleteIncomeCard('${card.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        grid.appendChild(cardElement);
    });
}

function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
}

function updateIncomeSummary() {
    const totalBalance = appState.incomeCards.reduce((sum, card) => {
        let usdAmount = card.balance;
        if (card.currency === 'RWF') {
            usdAmount = card.balance / 1450;
        } else if (card.currency === 'EUR') {
            usdAmount = card.balance * 1.1;
        } else if (card.currency === 'GBP') {
            usdAmount = card.balance * 1.27;
        }
        return sum + usdAmount;
    }, 0);

    document.getElementById('totalBalance').textContent = formatCurrency(totalBalance, 'USD');
    document.getElementById('accountCount').textContent = appState.incomeCards.length;
}

function updateIncomeChart() {
    const canvas = document.getElementById('incomeChart');
    const ctx = canvas.getContext('2d');

    if (appState.charts.income) {
        appState.charts.income.destroy();
    }

    // Create pie chart for account distribution
    const data = appState.incomeCards.map(card => card.balance);
    const labels = appState.incomeCards.map(card => card.title);

    appState.charts.income = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#667eea',
                    '#764ba2',
                    '#f093fb',
                    '#f5576c',
                    '#4facfe',
                    '#00f2fe'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

function addNewIncomeCard() {
    const title = document.getElementById('cardTitle').value;
    const type = document.getElementById('cardType').value;
    const balance = parseFloat(document.getElementById('cardBalance').value);
    const currency = document.getElementById('cardCurrency').value;

    const newCard = {
        id: 'c' + Date.now(),
        title: title,
        type: type,
        balance: balance,
        currency: currency,
        notes: '',
        created_at: Date.now()
    };

    const cardsObj = {};
    appState.incomeCards.forEach(c => cardsObj[c.id] = c);
    cardsObj[newCard.id] = newCard;

    saveToFirebase('incomeCards', cardsObj);
    closeModal('addIncomeCardModal');
    document.getElementById('addIncomeCardForm').reset();
    showNotification('Account added successfully!');
}

function deleteIncomeCard(cardId) {
    const card = appState.incomeCards.find(c => c.id === cardId);
    if (!card) return;

    document.getElementById('deleteCardId').value = cardId;
    document.getElementById('deleteCardName').textContent = card.title;
    showModal('deleteIncomeCardModal');
}

function confirmDeleteIncomeCard() {
    const cardId = document.getElementById('deleteCardId').value;
    deleteFromFirebase(`incomeCards/${cardId}`);
    closeModal('deleteIncomeCardModal');
    showNotification('Account deleted successfully!');
}

function editIncomeCard(cardId) {
    const card = appState.incomeCards.find(c => c.id === cardId);
    if (!card) return;

    document.getElementById('editCardId').value = card.id;
    document.getElementById('editCardTitle').value = card.title;
    document.getElementById('editCardType').value = card.type;
    document.getElementById('editCardBalance').value = card.balance;
    document.getElementById('editCardCurrency').value = card.currency;

    showModal('editIncomeCardModal');
}

function updateIncomeCard() {
    const cardId = document.getElementById('editCardId').value;
    const title = document.getElementById('editCardTitle').value;
    const type = document.getElementById('editCardType').value;
    const balance = parseFloat(document.getElementById('editCardBalance').value);
    const currency = document.getElementById('editCardCurrency').value;

    const card = appState.incomeCards.find(c => c.id === cardId);
    if (card) {
        card.title = title;
        card.type = type;
        card.balance = balance;
        card.currency = currency;

        const cardsObj = {};
        appState.incomeCards.forEach(c => cardsObj[c.id] = c);

        saveToFirebase('incomeCards', cardsObj);
        closeModal('editIncomeCardModal');
        showNotification('Account updated successfully!');
    }
}

function viewTransactions(cardId) {
    // This function is no longer used since we removed the history button
}

// Remember View
function renderRememberView() {
    updateVideoThumbnails();
    if (appState.videos.length > 0) {
        currentVideoIndex = 0;
        displayCurrentVideo();
    } else {
        displayCurrentVideo();
    }
}

function displayCurrentVideo() {
    if (appState.videos.length === 0) {
        document.getElementById('videoFeed').innerHTML = `
            <div class="video-placeholder-main">
                <i class="fas fa-video"></i>
                <p>Upload or add videos to get started</p>
            </div>
        `;
        document.getElementById('videoCounter').textContent = '0 / 0';
        document.getElementById('prevVideoBtn').disabled = true;
        document.getElementById('nextVideoBtn').disabled = true;
        return;
    }

    const video = appState.videos[currentVideoIndex];
    const videoFeed = document.getElementById('videoFeed');

    videoFeed.innerHTML = `
        <video id="mainVideo" style="width: auto; height: 100%; max-width: 100%; object-fit: contain;" crossorigin="anonymous">
            <source src="${video.url}" type="video/mp4">
            <source src="${video.url}" type="video/webm">
            <source src="${video.url}">
        </video>
        <div class="video-overlay" id="videoOverlay">
            <i class="fas fa-play play-pause-icon" id="overlayIcon"></i>
        </div>
    `;

    const videoElement = document.getElementById('mainVideo');
    const overlay = document.getElementById('videoOverlay');
    const overlayIcon = document.getElementById('overlayIcon');

    videoElement.addEventListener('error', (e) => {
        console.error('Video load error:', {
            error: e,
            url: video.url,
            networkState: videoElement.networkState,
            readyState: videoElement.readyState,
            errorCode: videoElement.error ? videoElement.error.code : 'none',
            errorMessage: videoElement.error ? videoElement.error.message : 'none'
        });

        let errorMsg = 'Cannot play this video';
        if (videoElement.error) {
            switch (videoElement.error.code) {
                case 1: errorMsg = 'Video loading aborted'; break;
                case 2: errorMsg = 'Network error'; break;
                case 3: errorMsg = 'Video decode failed'; break;
                case 4: errorMsg = 'Video format not supported'; break;
            }
        }

        videoFeed.innerHTML = `
            <div class="video-placeholder-main">
                <i class="fas fa-exclamation-circle" style="color: #e53e3e; font-size: 48px; margin-bottom: 16px;"></i>
                <p style="color: #e53e3e; font-size: 18px; font-weight: 600;">${errorMsg}</p>
                <p style="font-size: 12px; color: #718096; margin-top: 8px; word-break: break-all; padding: 0 20px;">${video.url}</p>
                <a href="${video.url}" target="_blank" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-external-link-alt"></i> Open in new tab
                </a>
            </div>
        `;
    });

    videoElement.addEventListener('loadeddata', () => {
        console.log('Video loaded successfully');
    });

    videoElement.addEventListener('click', () => {
        if (videoElement.paused) {
            videoElement.play().catch(e => console.error('Play error:', e));
            overlayIcon.className = 'fas fa-play play-pause-icon';
        } else {
            videoElement.pause();
            overlayIcon.className = 'fas fa-pause play-pause-icon';
        }
        overlay.classList.add('show');
        setTimeout(() => overlay.classList.remove('show'), 500);
    });

    videoElement.addEventListener('ended', () => {
        if (appState.videos.length > 1) {
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * appState.videos.length);
            } while (nextIndex === currentVideoIndex);
            selectVideo(nextIndex);
        }
    });

    document.getElementById('videoCounter').textContent = `${currentVideoIndex + 1} / ${appState.videos.length}`;
    document.getElementById('prevVideoBtn').disabled = currentVideoIndex === 0;
    document.getElementById('nextVideoBtn').disabled = currentVideoIndex === appState.videos.length - 1;

    updateThumbnailActive();
}

function navigateVideo(direction) {
    const newIndex = currentVideoIndex + direction;
    if (newIndex >= 0 && newIndex < appState.videos.length) {
        currentVideoIndex = newIndex;
        displayCurrentVideo();

        // Auto-play new video
        setTimeout(() => {
            const videoElement = document.getElementById('mainVideo');
            if (videoElement) {
                videoElement.play();
            }
        }, 100);
    }
}

function updateThumbnailActive() {
    document.querySelectorAll('.video-thumbnail').forEach((thumb, index) => {
        if (index === currentVideoIndex) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
}

function selectVideo(index) {
    currentVideoIndex = index;
    displayCurrentVideo();

    // Auto-play selected video
    setTimeout(() => {
        const videoElement = document.getElementById('mainVideo');
        if (videoElement) {
            videoElement.play();
        }
    }, 100);
}

function updateVideoThumbnails() {
    const container = document.getElementById('videoThumbnails');
    const searchTerm = document.getElementById('videoSearchInput').value.toLowerCase();
    container.innerHTML = '';

    const filteredVideos = appState.videos.filter(video =>
        video.title.toLowerCase().includes(searchTerm)
    );

    if (filteredVideos.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #718096;">No videos found</div>';
        return;
    }

    filteredVideos.forEach((video, filteredIndex) => {
        const actualIndex = appState.videos.indexOf(video);
        const thumbnail = document.createElement('div');
        thumbnail.className = 'video-thumbnail';
        if (actualIndex === currentVideoIndex) thumbnail.classList.add('active');

        // Create thumbnail container
        const thumbnailId = `thumb-${video.id}`;

        thumbnail.innerHTML = `
            <div id="${thumbnailId}" class="video-thumbnail-img" style="display:flex;align-items:center;justify-content:center;font-size:24px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;position:relative;overflow:hidden;">
                <i class="fas fa-video" style="font-size: 28px;"></i>
            </div>
            <div class="thumbnail-info">
                <div class="thumbnail-title">${video.title}</div>
                <div class="thumbnail-source">${video.source}</div>
            </div>
            <div class="video-actions">
                <button class="btn-icon" onclick="editVideo('${video.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deleteVideo('${video.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        thumbnail.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-icon')) {
                selectVideo(actualIndex);
            }
        });
        container.appendChild(thumbnail);

        // Generate thumbnail from video
        generateVideoThumbnail(video.url, thumbnailId);
    });
}

function generateVideoThumbnail(videoUrl, thumbnailId) {
    // Check if thumbnail is already cached
    if (appState.videoThumbnailCache[videoUrl]) {
        const thumbElement = document.getElementById(thumbnailId);
        if (thumbElement) {
            thumbElement.innerHTML = `<img src="${appState.videoThumbnailCache[videoUrl]}" style="width:100%;height:100%;object-fit:cover;" alt="Video thumbnail">`;
        }
        return;
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener('loadeddata', function () {
        // Seek to 1 second or 10% of video duration
        video.currentTime = Math.min(1, video.duration * 0.1);
    });

    video.addEventListener('seeked', function () {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');

            // Calculate dimensions to maintain aspect ratio
            const aspectRatio = video.videoWidth / video.videoHeight;
            let drawWidth = canvas.width;
            let drawHeight = canvas.height;
            let offsetX = 0;
            let offsetY = 0;

            if (aspectRatio > 1) {
                drawHeight = canvas.width / aspectRatio;
                offsetY = (canvas.height - drawHeight) / 2;
            } else {
                drawWidth = canvas.height * aspectRatio;
                offsetX = (canvas.width - drawWidth) / 2;
            }

            // Fill background
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw video frame
            ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

            // Convert to image
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);

            // Cache the thumbnail
            appState.videoThumbnailCache[videoUrl] = thumbnailUrl;

            // Update thumbnail
            const thumbElement = document.getElementById(thumbnailId);
            if (thumbElement) {
                thumbElement.innerHTML = `<img src="${thumbnailUrl}" style="width:100%;height:100%;object-fit:cover;" alt="Video thumbnail">`;
            }
        } catch (error) {
            console.log('Could not generate thumbnail:', error);
            // Keep the default icon if thumbnail generation fails
        }
    });

    video.addEventListener('error', function () {
        console.log('Could not load video for thumbnail');
        // Keep the default icon if video fails to load
    });
}

function editVideo(videoId) {
    const video = appState.videos.find(v => v.id === videoId);
    if (!video) return;

    document.getElementById('editVideoId').value = video.id;
    document.getElementById('editVideoTitle').value = video.title;

    // No longer showing URL fields


    showModal('editVideoModal');
}

function updateVideo() {
    const videoId = document.getElementById('editVideoId').value;
    const newTitle = document.getElementById('editVideoTitle').value.trim();

    const video = appState.videos.find(v => v.id === videoId);
    if (video && newTitle) {
        video.title = newTitle;

        const videosObj = {};
        appState.videos.forEach(v => videosObj[v.id] = v);

        saveToFirebase('videos', videosObj);
        closeModal('editVideoModal');
        showNotification('Video updated successfully!');
    }
}

function deleteVideo(videoId) {
    if (confirm('Are you sure you want to delete this video?')) {
        deleteFromFirebase(`videos/${videoId}`);
        showNotification('Video deleted successfully!');
    }
}

function filterVideos() {
    updateVideoThumbnails();
}

function extractYouTubeId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : '';
}

function handleVideoUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const progressDiv = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        progressDiv.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = 'Uploading... 0%';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CONFIG.CLOUDINARY.uploadPreset);
        formData.append('resource_type', 'video');

        try {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressFill.style.width = percentComplete + '%';
                    progressText.textContent = `Uploading... ${percentComplete}%`;
                }
            });

            xhr.addEventListener('load', async () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);

                    if (data.secure_url) {
                        const newVideo = {
                            id: 'v' + Date.now(),
                            title: file.name.replace(/\.[^/.]+$/, ''),
                            source: 'uploaded',
                            url: data.secure_url,
                            thumbnail: data.secure_url.replace('/upload/', '/upload/w_400,h_300,c_fill/'),
                            created_at: Date.now()
                        };

                        const videosObj = {};
                        appState.videos.forEach(v => videosObj[v.id] = v);
                        videosObj[newVideo.id] = newVideo;

                        await saveToFirebase('videos', videosObj);
                        showNotification('Video uploaded successfully!');
                        progressDiv.classList.add('hidden');
                    }
                } else {
                    // Log the error response for debugging
                    console.error('Cloudinary upload failed:', {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        response: xhr.responseText
                    });
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        showNotification('Upload failed: ' + (errorData.error?.message || 'Unknown error'));
                    } catch {
                        showNotification('Upload failed: ' + xhr.statusText);
                    }
                    progressDiv.classList.add('hidden');
                    throw new Error('Upload failed');
                }
            });

            xhr.addEventListener('error', () => {
                console.error('Network error during upload');
                showNotification('Upload failed!');
                progressDiv.classList.add('hidden');
            });

            // Use auto-detect endpoint instead of /video/upload
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY.cloudName}/auto/upload`);
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Upload failed!');
            progressDiv.classList.add('hidden');
        }
    };

    input.click();
}

// Motivation Cards
function renderMotivationCards() {
    const container = document.getElementById('motivationCards');
    container.innerHTML = '';

    appState.motivationCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'motivation-card';
        cardElement.innerHTML = `
            <p>"${card.text}"</p>
            <div class="card-actions">
                <button class="btn-icon" onclick="deleteMotivationCard(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(cardElement);
    });
}

function addNewMotivationCard() {
    const text = document.getElementById('motivationText').value;

    const newCard = {
        id: 'm' + Date.now(),
        text: text,
        created_at: Date.now()
    };

    const cardsObj = {};
    appState.motivationCards.forEach(c => cardsObj[c.id] = c);
    cardsObj[newCard.id] = newCard;

    saveToFirebase('motivationCards', cardsObj);
    closeModal('addMotivationModal');
    document.getElementById('addMotivationForm').reset();
    showNotification('Motivation card added!');
}

function deleteMotivationCard(button) {
    if (confirm('Delete this motivation card?')) {
        const cardElement = button.closest('.motivation-card');
        cardElement.remove();

        // In a real app, you'd also remove from state and save
        showNotification('Motivation card deleted.');
    }
}

// Modal Management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('hidden');

    // Focus first input
    const firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) {
        firstInput.focus();
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
}

// Utility Functions
function setupAnimations() {
    // Add smooth scroll animation for motivation cards
    const motivationContainer = document.getElementById('motivationCards');
    if (motivationContainer) {
        // Clone cards for continuous scroll effect
        const cards = motivationContainer.innerHTML;
        motivationContainer.innerHTML = cards + cards;
    }
}

function showNotification(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Read View Functions
function renderReadView() {
    const container = document.getElementById('quotesContent');
    container.innerHTML = '';

    if (appState.quotes.length === 0) {
        container.innerHTML = '<div class="quote-card"><div class="quote-text">Add your first quote to get started</div></div>';
    } else {
        const shuffledQuotes = shuffleArray([...appState.quotes]);
        shuffledQuotes.forEach(quote => {
            const quoteCard = document.createElement('div');
            quoteCard.className = 'quote-card';
            quoteCard.innerHTML = `
                <div class="quote-text">"${quote.text}"</div>
                ${quote.author ? `<div class="quote-author">— ${quote.author}</div>` : ''}
            `;
            container.appendChild(quoteCard);
        });

        // Duplicate for seamless loop
        shuffledQuotes.forEach(quote => {
            const quoteCard = document.createElement('div');
            quoteCard.className = 'quote-card';
            quoteCard.innerHTML = `
                <div class="quote-text">"${quote.text}"</div>
                ${quote.author ? `<div class="quote-author">— ${quote.author}</div>` : ''}
            `;
            container.appendChild(quoteCard);
        });
    }

    renderQuotesManagementList();
    renderPlaylistManagementList();
}

function renderQuotesManagementList() {
    const listContainer = document.getElementById('quotesManagementList');
    listContainer.innerHTML = '';

    if (appState.quotes.length === 0) {
        listContainer.innerHTML = '<p>No quotes to manage.</p>';
        return;
    }

    appState.quotes.forEach(quote => {
        const item = document.createElement('div');
        item.className = 'management-item';
        item.innerHTML = `
            <div class="management-item-info">
                <p class="management-item-title">"${quote.text}"</p>
                <p class="management-item-subtitle">${quote.author || 'No author'}</p>
            </div>
            <div class="management-item-actions">
                <button class="btn-icon" onclick="editQuote('${quote.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deleteQuote('${quote.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function renderPlaylistManagementList() {
    const listContainer = document.getElementById('playlistManagementList');
    listContainer.innerHTML = '';

    if (appState.audioPlaylist.length === 0) {
        listContainer.innerHTML = '<p>No audio files to manage.</p>';
        return;
    }

    appState.audioPlaylist.forEach((audio, index) => {
        const item = document.createElement('div');
        item.className = 'management-item';
        item.innerHTML = `
            <div class="management-item-info">
                <p class="management-item-title">${audio.title}</p>
            </div>
            <div class="management-item-actions">
                <button class="btn-icon" onclick="editAudioName('${audio.id}')" title="Edit Name">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deleteAudio('${audio.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function editAudioName(audioId) {
    const audio = appState.audioPlaylist.find(a => a.id === audioId);
    if (!audio) return;

    const newName = prompt('Enter new name for the audio file:', audio.title);
    if (newName && newName.trim() !== '') {
        audio.title = newName.trim();
        const playlistObj = {};
        appState.audioPlaylist.forEach(a => playlistObj[a.id] = a);
        saveToFirebase('audioPlaylist', playlistObj);
        showNotification('Audio name updated successfully!');
    }
}

function deleteAudio(audioId) {
    if (confirm('Are you sure you want to delete this audio file?')) {
        const playlistObj = {};
        appState.audioPlaylist.forEach(a => {
            if (a.id !== audioId) {
                playlistObj[a.id] = a;
            }
        });
        saveToFirebase('audioPlaylist', playlistObj);
        showNotification('Audio deleted successfully!');
    }
}

function editQuote(quoteId) {
    const quote = appState.quotes.find(q => q.id === quoteId);
    if (!quote) return;

    document.getElementById('editQuoteId').value = quote.id;
    document.getElementById('editQuoteText').value = quote.text;
    document.getElementById('editQuoteAuthor').value = quote.author;

    showModal('editQuoteModal');
}

function deleteQuote(quoteId) {
    if (confirm('Are you sure you want to delete this quote?')) {
        const quotesObj = {};
        appState.quotes.forEach(q => {
            if (q.id !== quoteId) {
                quotesObj[q.id] = q;
            }
        });
        saveToFirebase('quotes', quotesObj);
        showNotification('Quote deleted successfully!');
    }
}

function updateQuote() {
    const quoteId = document.getElementById('editQuoteId').value;
    const text = document.getElementById('editQuoteText').value;
    const author = document.getElementById('editQuoteAuthor').value;

    const quoteIndex = appState.quotes.findIndex(q => q.id === quoteId);
    if (quoteIndex > -1) {
        const updatedQuote = {
            ...appState.quotes[quoteIndex],
            text: text,
            author: author
        };

        appState.quotes[quoteIndex] = updatedQuote;

        saveToFirebase(`quotes/${quoteId}`, updatedQuote);
        closeModal('editQuoteModal');
        showNotification('Quote updated successfully!');
    }
}

function addNewQuote() {
    const text = document.getElementById('quoteText').value;
    const author = document.getElementById('quoteAuthor').value;

    const newQuote = {
        id: 'q' + Date.now(),
        text: text,
        author: author,
        created_at: Date.now()
    };

    saveToFirebase(`quotes/${newQuote.id}`, newQuote);
    closeModal('addQuoteModal');
    document.getElementById('addQuoteForm').reset();
    showNotification('Quote added successfully!');
}

// Secrets View Functions
function renderSecretsView() {
    const container = document.getElementById('secretsGrid');
    const filter = document.getElementById('secretCategoryFilter').value;
    const searchTerm = document.getElementById('secretSearchInput').value.toLowerCase();
    container.innerHTML = '';

    let filteredSecrets = filter === 'all'
        ? appState.secrets
        : appState.secrets.filter(s => s.category === filter);

    if (searchTerm) {
        filteredSecrets = filteredSecrets.filter(s =>
            s.title.toLowerCase().includes(searchTerm) ||
            s.content.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredSecrets.length === 0) {
        container.innerHTML = '<div style="width: 100%; text-align: center; padding: 60px; color: #718096;">No secrets found.</div>';
        return;
    }

    filteredSecrets.forEach(secret => {
        const secretCard = document.createElement('div');
        secretCard.className = 'secret-card';

        // Format the date as dd/mm/yy
        const uploadDate = secret.created_at ? new Date(secret.created_at) : new Date();
        const day = String(uploadDate.getDate()).padStart(2, '0');
        const month = String(uploadDate.getMonth() + 1).padStart(2, '0');
        const year = String(uploadDate.getFullYear()).slice(-2);
        const formattedDate = `${day}/${month}/${year}`;

        secretCard.innerHTML = `
            <div class="secret-header">
                <div class="secret-title">${secret.title}</div>
                <div class="secret-category">${secret.category}</div>
            </div>
            <div class="secret-content">${secret.content}</div>
            <div class="secret-footer">
                <div class="secret-date">
                    <i class="fas fa-calendar-alt"></i> ${formattedDate}
                </div>
                <div class="secret-actions">
                    <button class="btn-icon" onclick="editSecret('${secret.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteSecret('${secret.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(secretCard);
    });
}

function addNewSecret() {
    const secretId = document.getElementById('secretId').value;
    const title = document.getElementById('secretTitle').value;
    const category = document.getElementById('secretCategory').value;
    const content = document.getElementById('secretContent').value;

    const secret = {
        id: secretId || 's' + Date.now(),
        title: title,
        category: category,
        content: content,
        created_at: secretId ? appState.secrets.find(s => s.id === secretId)?.created_at : Date.now(),
        updated_at: Date.now()
    };

    const secretsObj = {};
    appState.secrets.forEach(s => secretsObj[s.id] = s);
    secretsObj[secret.id] = secret;

    saveToFirebase('secrets', secretsObj);
    closeModal('addSecretModal');
    document.getElementById('addSecretForm').reset();
    showNotification(secretId ? 'Secret updated successfully!' : 'Secret added successfully!');
}

function editSecret(secretId) {
    const secret = appState.secrets.find(s => s.id === secretId);
    if (!secret) return;

    document.getElementById('secretId').value = secret.id;
    document.getElementById('secretTitle').value = secret.title;
    document.getElementById('secretCategory').value = secret.category;
    document.getElementById('secretContent').value = secret.content;
    document.getElementById('secretSubmitBtn').textContent = 'Update Secret';

    showModal('addSecretModal');
}

function deleteSecret(secretId) {
    if (confirm('Are you sure you want to delete this secret?')) {
        deleteFromFirebase(`secrets/${secretId}`);
        showNotification('Secret deleted successfully!');
    }
}

function handleAudioUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const progressDiv = document.getElementById('audioUploadProgress');
        const progressFill = document.getElementById('audioProgressFill');
        const progressText = document.getElementById('audioProgressText');

        progressDiv.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = 'Uploading... 0%';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CONFIG.CLOUDINARY.uploadPreset);
        formData.append('resource_type', 'video');

        try {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressFill.style.width = percentComplete + '%';
                    progressText.textContent = `Uploading... ${percentComplete}%`;
                }
            });

            xhr.addEventListener('load', async () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);

                    if (data.secure_url) {
                        const newAudio = {
                            id: 'a' + Date.now(),
                            title: file.name,
                            url: data.secure_url,
                            created_at: Date.now()
                        };

                        const playlistObj = {};
                        appState.audioPlaylist.forEach(a => playlistObj[a.id] = a);
                        playlistObj[newAudio.id] = newAudio;

                        await saveToFirebase('audioPlaylist', playlistObj);

                        showNotification('Audio uploaded successfully!');
                        progressDiv.classList.add('hidden');

                        if (appState.audioPlaylist.length === 1) {
                            appState.currentAudioIndex = 0;
                            loadAudioTrack(0);
                        }
                    }
                } else {
                    throw new Error('Upload failed');
                }
            });

            xhr.addEventListener('error', () => {
                showNotification('Upload failed!');
                progressDiv.classList.add('hidden');
            });

            xhr.open('POST', `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY.cloudName}/video/upload`);
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Upload failed!');
            progressDiv.classList.add('hidden');
        }
    };

    input.click();
}

function toggleAudioPlayback() {
    const btn = document.getElementById('playPauseBtn');

    if (audioPlayer.src && !audioPlayer.paused) {
        audioPlayer.pause();
        btn.innerHTML = '<i class="fas fa-play"></i>';
    } else if (audioPlayer.src) {
        audioPlayer.play();
        btn.innerHTML = '<i class="fas fa-pause"></i>';
    } else if (appState.audioPlaylist.length > 0) {
        // If no track is loaded, start with a random one
        appState.currentAudioIndex = Math.floor(Math.random() * appState.audioPlaylist.length);
        loadAudioTrack(appState.currentAudioIndex);
        audioPlayer.play();
        btn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        showNotification('Please upload an audio file first');
    }
}

// Add CSS for notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
