// --- Application State ---
window.appState = {
    currentScreen: 'loading',
    userName: localStorage.getItem('quizUserName') || '',
    userStandard: parseInt(localStorage.getItem('quizUserStandard')) || 0,
    selectedSubject: null,
    quizDataPool: {},
    currentQuiz: [],
    currentQuestionIndex: 0,
    score: 0,
    isAnswerLocked: false,
};

// --- Core Constants ---
const QUIZ_SESSION_SIZE = 50;
const SUBJECTS = ["Math", "Science", "Aptitude", "Reasoning", "Social"];
const STANDARDS = Array.from({ length: 7 }, (_, i) => i + 4); // Standards 4 to 10

// --- Utility Functions ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getGCD(a, b) {
    return b === 0 ? a : getGCD(b, a % b);
}

// --- Question Generators (same as before) ---
// (all question generation functions remain unchanged)
// ... keep your existing `generateArithmetic`, `generateRatioPercentage`, 
// `generateGeometry`, `generateAdvancedMath`, and `generateQuiz` functions here ...

// --- UI Renderer Functions ---
function updateHeader() {
    const { userName, userStandard, selectedSubject } = window.appState;
    const displayEl = document.getElementById('user-display');
    if (userName && userStandard) {
        let text = `Student: ${userName} | Standard: ${userStandard}`;
        if (selectedSubject) text += ` | Subject: ${selectedSubject}`;
        displayEl.innerHTML = text;
    } else {
        displayEl.innerHTML = 'Please enter your details to begin.';
    }
}

function renderAuthScreen() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="max-w-md mx-auto my-auto p-8 bg-gray-50 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-6 text-center text-indigo-600">Enter Details</h2>
            <div class="mb-4">
                <label for="userName" class="block text-sm font-medium text-gray-700">Your Name</label>
                <input type="text" id="userName" value="${window.appState.userName}"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                    placeholder="e.g., Alex Johnson" required>
            </div>
            <div class="mb-6">
                <label for="userStandard" class="block text-sm font-medium text-gray-700">Current Standard (Grade)</label>
                <select id="userStandard"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border">
                    <option value="0" disabled>Select your standard...</option>
                    ${STANDARDS.map(s => `<option value="${s}" ${window.appState.userStandard === s ? 'selected' : ''}>Standard ${s}</option>`).join('')}
                </select>
            </div>
            <button id="startQuizButton"
                class="w-full flex justify-center items-center py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                Start Quiz <span data-lucide="arrow-right" class="w-5 h-5 ml-2"></span>
            </button>
        </div>
    `;
    lucide.createIcons();
    updateHeader();

    document.getElementById('startQuizButton').addEventListener('click', () => {
        const name = document.getElementById('userName').value.trim();
        const standard = parseInt(document.getElementById('userStandard').value);
        if (name && standard >= 4) {
            window.appState.userName = name;
            window.appState.userStandard = standard;
            localStorage.setItem('quizUserName', name);
            localStorage.setItem('quizUserStandard', standard);
            window.renderApp('subject-select');
        } else {
            alert('Please enter your name and select a valid standard (4-10).');
        }
    });

    rerenderMath(); // ✅ Added
}

function renderSubjectSelectScreen() {
    const content = document.getElementById('app-content');
    const subjectIconMap = {
        'Math': { icon: 'sigma', color: 'bg-indigo-500' },
        'Science': { icon: 'flask-conical', color: 'bg-green-500' },
        'Social': { icon: 'globe', color: 'bg-red-500' },
        'Aptitude': { icon: 'puzzle', color: 'bg-yellow-500' },
        'Reasoning': { icon: 'brain-circuit', color: 'bg-purple-500' },
    };
    content.innerHTML = `
        <div class="w-full">
            <h2 class="text-2xl font-bold mb-6 text-indigo-700">Choose a Subject (Standard ${window.appState.userStandard})</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
                ${SUBJECTS.map(subject => {
                    const info = subjectIconMap[subject];
                    return `
                        <button data-subject="${subject}" class="subject-card flex flex-col items-center justify-center p-6 rounded-xl border border-gray-200 shadow-md hover:shadow-xl">
                            <div class="p-3 rounded-full ${info.color} text-white mb-3">
                                <span data-lucide="${info.icon}" class="w-8 h-8"></span>
                            </div>
                            <span class="text-lg font-semibold text-gray-800">${subject}</span>
                        </button>
                    `;
                }).join('')}
            </div>
            <div class="mt-8 text-center">
                <button id="changeDetailsButton" class="text-sm text-indigo-500 hover:text-indigo-700 flex items-center mx-auto">
                    <span data-lucide="user-cog" class="w-4 h-4 mr-1"></span> Change Name/Standard
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
    updateHeader();

    document.querySelectorAll('.subject-card').forEach(btn => {
        btn.addEventListener('click', e => {
            const subject = e.currentTarget.dataset.subject;
            window.appState.selectedSubject = subject;
            window.appState.currentQuiz = generateQuiz(subject, window.appState.userStandard);
            window.appState.currentQuestionIndex = 0;
            window.appState.score = 0;
            window.appState.isAnswerLocked = false;
            window.renderApp('quiz');
        });
    });

    document.getElementById('changeDetailsButton').addEventListener('click', () => window.renderApp('auth'));

    rerenderMath(); // ✅ Added
}

function renderQuizScreen() {
    const { currentQuiz, currentQuestionIndex, selectedSubject } = window.appState;
    const currentQ = currentQuiz[currentQuestionIndex];
    const content = document.getElementById('app-content');
    if (!currentQ) return window.renderApp('result');

    content.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="flex justify-between items-center mb-4">
                <span class="text-lg font-bold text-gray-700">${selectedSubject} Quiz</span>
                <span class="text-xl font-extrabold text-indigo-600">${currentQuestionIndex + 1} / ${QUIZ_SESSION_SIZE}</span>
            </div>
            <div id="quiz-question-card" class="question-card flex-grow bg-white p-6 rounded-xl border border-indigo-100 shadow-lg mb-4 custom-scrollbar">
                <p class="text-xl font-semibold text-gray-900 mb-6">${currentQ.q}</p>
                <div id="options-container" class="grid grid-cols-1 md:grid-cols-2 gap-4" style="visibility: hidden;">
                    ${currentQ.options.map(option => `
                        <button data-option="${option}" class="option-button w-full text-left p-4 rounded-lg border border-gray-200 text-gray-800 bg-gray-50">
                            ${option}
                        </button>
                    `).join('')}
                </div>
                <div id="explanation-box" class="mt-8 p-4 rounded-lg bg-indigo-50 border-l-4 border-indigo-400 hidden">
                    <p class="font-bold text-indigo-700 flex items-center mb-2">
                        <span data-lucide="info" class="w-5 h-5 mr-2"></span> Explanation
                    </p>
                    <p id="explanation-text" class="text-gray-700"></p>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
    updateHeader();

    if (window.MathJax) {
        window.MathJax.typesetPromise([content]).then(() => {
            document.getElementById('options-container').style.visibility = 'visible';
        });
    } else {
        document.getElementById('options-container').style.visibility = 'visible';
    }

    rerenderMath(); // ✅ Added
}

function renderResultScreen() {
    const { score, selectedSubject, userStandard } = window.appState;
    const total = QUIZ_SESSION_SIZE;
    const percentage = ((score / total) * 100).toFixed(1);
    const content = document.getElementById('app-content');
    const message = percentage >= 80 ? "Excellent job!" : percentage >= 50 ? "Good effort!" : "Keep practicing!";
    content.innerHTML = `
        <div class="max-w-md mx-auto my-auto p-8 rounded-xl shadow-2xl text-center border-4 bg-indigo-50">
            <h2 class="text-3xl font-extrabold mb-2 text-gray-800">Quiz Complete!</h2>
            <p class="text-xl font-bold mb-4 text-indigo-600">${selectedSubject} - Standard ${userStandard}</p>
            <div class="my-6">
                <p class="text-5xl font-extrabold text-indigo-700">${score} / ${total}</p>
                <p class="text-2xl font-semibold text-gray-600 mt-2">Score: ${percentage}%</p>
            </div>
            <p class="text-md mb-8 italic text-gray-700">${message}</p>
            <div class="flex flex-col space-y-3">
                <button id="retakeQuizButton" class="w-full py-2 px-4 rounded-md shadow-md text-sm font-medium text-white bg-indigo-600">Retake ${selectedSubject} Quiz</button>
                <button id="backToSubjectsButton" class="w-full py-2 px-4 rounded-md shadow-sm text-sm font-medium text-indigo-600 border border-indigo-200 bg-white">Back to Subjects</button>
            </div>
        </div>
    `;
    lucide.createIcons();
    updateHeader();

    document.getElementById('retakeQuizButton').addEventListener('click', () => {
        window.appState.currentQuiz = generateQuiz(selectedSubject, userStandard);
        window.appState.currentQuestionIndex = 0;
        window.appState.score = 0;
        window.appState.isAnswerLocked = false;
        window.renderApp('quiz');
    });
    document.getElementById('backToSubjectsButton').addEventListener('click', () => {
        window.appState.selectedSubject = null;
        window.renderApp('subject-select');
    });

    rerenderMath(); // ✅ Added
}

// --- Global MathJax Re-render Helper ---
function rerenderMath() {
    if (window.MathJax) {
        window.MathJax.typesetPromise()
            .then(() => console.log("✅ MathJax rendering complete"))
            .catch(err => console.error("❌ MathJax render error:", err));
    }
}

// --- Initialization ---
async function initializeApp() {
    try {
        const response = await fetch('study_data.json');
        if (!response.ok) throw new Error(`HTTP error! ${response.status}`);
        window.appState.quizDataPool = await response.json();
        if (window.appState.userName && window.appState.userStandard) {
            window.renderApp('subject-select');
        } else {
            window.renderApp('auth');
        }
    } catch (error) {
        console.error("Error loading quiz data:", error);
        document.getElementById('app-content').innerHTML = `
            <div class="text-center p-8 bg-red-50 rounded-lg text-red-700">
                <p class="font-semibold">Initialization Error</p>
                <p>${error.message}</p>
            </div>`;
        lucide.createIcons();
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);
