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


// ----------------------------------------------------------------------
// --- Utility Functions (Must be defined first for generators to work) ---
// ----------------------------------------------------------------------

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


// ----------------------------------------------------------------------
// --- Dynamic Math Question Generation Logic ---
// ----------------------------------------------------------------------

// Helper to wrap math/aptitude questions with a dynamic explanation
function wrapDynamicQuestion(qObj, type) {
    let baseExp = `This is a ${type} question for Standard ${window.appState.userStandard}. The correct answer, ${qObj.a}, was obtained through the following principle: `;

    if (type === 'Arithmetic') {
        baseExp += `Perform the mathematical operation shown, ensuring correct order of operations (e.g., $10 \\times 5 = 50$).`;
    } else if (type === 'RatioPercentage') {
        if (qObj.q.includes('ratio')) {
            baseExp += `A ratio must be simplified by dividing both numbers by their Greatest Common Divisor.`;
        } else {
            baseExp += `To find the percentage, multiply the base number by the decimal equivalent of the percentage (e.g., $50\\%$ of $100$ is $0.5 \\times 100$).`;
        }
    } else if (type === 'Geometry') {
        baseExp += `Apply the correct geometric formula (e.g., Area of a rectangle = length $\\times$ width, Volume of a cylinder = $\\pi r^2 h$).`;
    } else if (type === 'AdvancedMath') {
        baseExp += `The solution requires applying an advanced algebraic, statistical, or trigonometric principle, such as factoring the quadratic equation or using $\\sin(\\theta)$ values.`;
    }
    qObj.exp = baseExp;
    return qObj;
}

// 1. Arithmetic/Fractions/Decimals (Standard 4-7)
function generateArithmetic(standard) {
    let num1, num2, q, a_val;
    
    if (standard >= 6 && Math.random() < 0.4) {
        const den = getRandomInt(4, 12);
        num1 = getRandomInt(1, den - 1);
        num2 = getRandomInt(1, den - 1);
        const operator = ['+', '-'][getRandomInt(0, 1)];
        
        if (operator === '+') {
            const a_num = num1 + num2;
            const gcd = getGCD(a_num, den);
            a_val = `\\frac{${a_num / gcd}}{${den / gcd}}`;
            q = `Calculate: $\\frac{${num1}}{${den}} + \\frac{${num2}}{${den}}$ (Simplify)`;
        } else {
            const n1 = Math.max(num1, num2);
            const n2 = Math.min(num1, num2);
            const a_num = n1 - n2;
            const gcd = getGCD(a_num, den);
            a_val = `\\frac{${a_num / gcd}}{${den / gcd}}`;
            q = `Calculate: $\\frac{${n1}}{${den}} - \\frac{${n2}}{${den}}$ (Simplify)`;
        }
    } else {
        const maxVal = standard * 100;
        num1 = getRandomInt(50, maxVal);
        num2 = getRandomInt(10, maxVal / 2);
        const operator = ['+', '-', '*', '/'][getRandomInt(0, 3)];

        if (operator === '*') {
            a_val = String(num1 * num2);
            q = `Calculate: ${num1} \\times ${num2}`;
        } else if (operator === '/') {
            num1 = num1 * num2;
            a_val = String(num1 / num2);
            q = `Calculate: ${num1} \\div ${num2}`;
        } else if (operator === '+') { // Replaced eval() for security
            a_val = String(num1 + num2);
            q = `Calculate: ${num1} + ${num2}`;
        } else { // operator === '-'
            a_val = String(num1 - num2);
            q = `Calculate: ${num1} - ${num2}`;
        }
    }

    const correctVal = String(a_val).replace(/\s/g, ''); 
    let wrongOptions = [];
    
    // IMPROVED: Logic to handle fractional and numeric answers separately for options
    if (correctVal.includes('\\frac')) {
        const match = correctVal.match(/\\frac{([0-9]+)}{([0-9]+)}/);
        if (match) {
            const num = parseInt(match[1]);
            const den = parseInt(match[2]);
            // Generate fractional wrong options by simple perturbation
            wrongOptions = [
                 `$\\frac{${num + 1}}{${den}}$`, 
                 `$\\frac{${num}}{${den + 1}}$`, 
                 `$\\frac{${den}}{${num}}$`      
            ].filter(o => o !== `$${correctVal}$`).slice(0, 3);
        }
    } else {
        // For simple numeric answers, use parseFloat for safety and perturb
        const numVal = parseFloat(correctVal);
        if (!isNaN(numVal)) {
             wrongOptions = [
                String((numVal + 1).toFixed(numVal % 1 !== 0 ? 1 : 0)), // Handles decimal precision
                String((numVal - 1).toFixed(numVal % 1 !== 0 ? 1 : 0)), 
                String((numVal + 10).toFixed(numVal % 1 !== 0 ? 1 : 0))
            ];
        }
    }

    // Ensure all options containing MathJax are correctly wrapped, and all options are strings.
    const finalOptions = shuffleArray([...new Set([`$${correctVal}$`, ...wrongOptions])])
        .slice(0, 4)
        .map(o => o.includes('\\frac') || o.includes('\\pi') || o.startsWith('$') ? o : String(o));
    
    const qObj = { q: `$${q}$`, options: finalOptions, a: `$${a_val}$` };
    return wrapDynamicQuestion(qObj, 'Arithmetic');
}

// 2. Ratio and Percentage (Standard 5-8, great for Aptitude/Reasoning)
function generateRatioPercentage(standard) {
    const isRatio = Math.random() < 0.5;
    let q, a_val;

    if (isRatio) {
        const A = getRandomInt(2, 20);
        const B = getRandomInt(2, 20);
        const gcd = getGCD(A, B);
        a_val = `${A / gcd} : ${B / gcd}`;
        
        q = `If there are ${A} apples and ${B} bananas, what is the simplest ratio of apples to bananas?`;
        
        const wrongOptions = [
            `${B / gcd} : ${A / gcd}`, 
            `${A} : ${B}`, 
            `${(A / gcd) + 1} : ${B / gcd}`
        ];
        
        const qObj = { q, options: shuffleArray([a_val, ...wrongOptions]).slice(0, 4), a: a_val };
        return wrapDynamicQuestion(qObj, 'RatioPercentage');
    } else {
        const percent = getRandomInt(10, 90);
        const base = getRandomInt(2, 10) * 100;
        a_val = String((percent / 100) * base);
        
        q = `What is ${percent}\\% of ${base}?`;
        
        const wrongOptions = [
            String((percent / 100) * base * 2),
            String(percent + base),
            String(base - percent)
        ];
        
        const qObj = { q, options: shuffleArray([a_val, ...wrongOptions]).slice(0, 4), a: a_val };
        return wrapDynamicQuestion(qObj, 'RatioPercentage');
    }
}


// 3. Simple Geometry/Area/Volume (Standard 4-8)
function generateGeometry(standard) {
    const shape = standard >= 7 ? ['cylinder', 'triangle', 'rect'][getRandomInt(0, 2)] : ['rect', 'sq', 'triangle'][getRandomInt(0, 2)];
    let q, a_val, unit = 'm';

    if (shape === 'rect' || shape === 'sq') {
        const L = getRandomInt(5, 15);
        const W = shape === 'sq' ? L : getRandomInt(3, L - 1);
        const isArea = Math.random() < 0.5;
        
        if (isArea) {
            a_val = String(L * W);
            q = `A ${shape} has length ${L} ${unit} and width ${W} ${unit}. What is its **area** in $\\text{m}^2$?`;
        } else {
            a_val = String(2 * (L + W));
            q = `A ${shape} has length ${L} ${unit} and width ${W} ${unit}. What is its **perimeter** in ${unit}?`;
        }
    } else if (shape === 'triangle') {
        const base = getRandomInt(6, 20);
        const height = getRandomInt(4, 15);
        a_val = String((base * height) / 2);
        q = `A triangle has a base of ${base} ${unit} and a height of ${height} ${unit}. What is its **area** in $\\text{m}^2$?`;
        
    } else { // cylinder (Volume/Surface Area, Std 7+)
        const radius = getRandomInt(2, 6);
        const height = getRandomInt(4, 10);
        const isVolume = Math.random() < 0.6;

        if (isVolume) {
            const rSq = radius * radius;
            a_val = `\\pi \\cdot ${rSq * height}`; // Note: Using double-backslash \\ in strings will be interpreted correctly when MathJax runs
            q = `A cylinder has radius ${radius} ${unit} and height ${height} ${unit}. What is its **volume**? (In terms of $\\pi$)`;
        } else {
            const lsaCoeff = 2 * radius * height;
            a_val = `\\pi \\cdot ${lsaCoeff}`; 
            q = `A cylinder has radius ${radius} ${unit} and height ${height} ${unit}. What is its **Lateral Surface Area**? (In terms of $\\pi$)`;
        }
    }
    
    const correctVal = String(a_val).replace(/\s/g, ''); 
    let wrongOptions = [];
    
    // IMPROVED: Logic to handle pi-based and numeric answers separately for options
    if (correctVal.includes('\\pi')) {
        const coeffMatch = correctVal.match(/\\pi \\cdot\s*(\d+)/);
        if (coeffMatch) {
            const coeff = parseInt(coeffMatch[1]);
            // Generate pi-based wrong options by perturbing the coefficient
            wrongOptions = [
                `$\\pi \\cdot ${coeff + 2}$`,
                `$\\pi \\cdot ${coeff - 2}$`,
                `$\\pi \\cdot ${coeff * 2}$`
            ];
        }
    } else {
        // For simple numeric answers
        const numVal = parseFloat(correctVal);
        if (!isNaN(numVal)) {
            wrongOptions = [
                String(numVal + 2), 
                String(numVal - 2), 
                String(numVal * 2)
            ];
        }
    }

    // Ensure all options containing MathJax are correctly wrapped, and all options are strings.
    const finalOptions = shuffleArray([...new Set([`$${correctVal}$`, ...wrongOptions])])
        .slice(0, 4)
        .map(o => o.includes('\\pi') || o.startsWith('$') ? o : String(o));

    const qObj = { q: q, options: finalOptions, a: `$${a_val}$` }; // Ensure final answer is wrapped for consistency
    return wrapDynamicQuestion(qObj, 'Geometry');
}

// 4. Advanced Algebra/Trigonometry/Theorems (Standard 8-10)
function generateAdvancedMath(standard) {
    const type = standard === 10 ? ['quadratic', 'trigonometry', 'stats'][getRandomInt(0, 2)] : ['quadratic', 'linear_adv'][getRandomInt(0, 1)];
    
    const qObj = {}; 
    
    if (type === 'quadratic') {
        const r1 = getRandomInt(-4, 4);
        const r2 = getRandomInt(r1 + 1, r1 + 5);
        const b = -(r1 + r2);
        const c = r1 * r2;
        let bTerm = b > 0 ? ` + ${b}x` : b < 0 ? ` - ${Math.abs(b)}x` : '';
        let cTerm = c > 0 ? ` + ${c}` : c < 0 ? ` - ${Math.abs(c)}` : '';
        
        const q = `Find the largest root of the equation $x^2${bTerm}${cTerm} = 0$.`;
        const a_val = String(Math.max(r1, r2));
        
        const options = shuffleArray([a_val, String(Math.min(r1, r2)), String(Math.abs(r1) + 1), String(Math.abs(r2) - 1)]).filter(o => o !== a_val).slice(0, 3);
        options.push(a_val);
        qObj.q = q; qObj.a = a_val; qObj.options = shuffleArray(options);
        
    } else if (type === 'trigonometry') {
        const angle = [30, 45, 60][getRandomInt(0, 2)];
        const func = ['sin', 'cos', 'tan'][getRandomInt(0, 2)];
        
        let val;
        if (func === 'sin') {
            if (angle === 30) val = '\\frac{1}{2}';
            else if (angle === 45) val = '\\frac{1}{\\sqrt{2}}';
            else val = '\\frac{\\sqrt{3}}{2}';
        } else if (func === 'cos') {
            if (angle === 30) val = '\\frac{\\sqrt{3}}{2}';
            else if (angle === 45) val = '\\frac{1}{\\sqrt{2}}';
            else val = '\\frac{1}{2}';
        } else { // tan
            if (angle === 30) val = '\\frac{1}{\\sqrt{3}}';
            else if (angle === 45) val = '1';
            else val = '\\sqrt{3}';
        }
        
        const q = `What is the value of $\\text{${func} }${angle}^\\circ$?`;
        const a_val = `$${val}$`;
        
        const options = shuffleArray([a_val, `$\\frac{1}{2}$`, `$\\frac{\\sqrt{3}}{2}$`, `$1$`]).filter(o => o !== a_val).slice(0, 3);
        options.push(a_val);
        qObj.q = q; qObj.a = a_val; qObj.options = shuffleArray(options);
        
    } else if (type === 'stats') {
        const N = getRandomInt(4, 6);
        const data = Array.from({ length: N }, () => getRandomInt(5, 30)).sort((a, b) => a - b);
        const dataStr = data.join(', ');
        
        // Mean
        const sum = data.reduce((acc, curr) => acc + curr, 0);
        const mean = (sum / N).toFixed(1);
        const q = `Find the mean of the data set: ${dataStr}`;
        const a_val = String(mean);
        
        const wrongOptions = [String((sum / N * 1.1).toFixed(1)), String(data[Math.floor(N / 2)]), String(sum / (N + 1))];
        qObj.q = q; qObj.a = a_val; qObj.options = shuffleArray([a_val, ...wrongOptions]).slice(0, 4);

    } else {
        // Advanced Linear: ax + b = cx + d
        const a = getRandomInt(3, 7);
        const c = getRandomInt(1, a - 1); 
        const b = getRandomInt(1, 10);
        const d = getRandomInt(1, 10) * (Math.random() < 0.5 ? -1 : 1);
        
        const targetX = ((d - b) / (a - c));
        const finalX = targetX % 1 !== 0 ? targetX.toFixed(1) : String(targetX);

        const q = `Solve for $x$: $${a}x + ${b} = ${c}x ${d > 0 ? '+' : '-'} ${Math.abs(d)}$`;

        const a_val = String(finalX);
        const options = shuffleArray([a_val, String(parseFloat(a_val) + 1), String(parseFloat(a_val) - 1), String(targetX * -1)]).slice(0, 4);

        qObj.q = q; qObj.a = a_val; qObj.options = options;
    }

    return wrapDynamicQuestion(qObj, 'AdvancedMath');
}

// --- MAIN QUIZ GENERATOR FUNCTION ---
function generateQuiz(subject, standard) {
    const qCount = QUIZ_SESSION_SIZE;
    let potentialQuestions = [];

    if (subject === 'Math' || subject === 'Aptitude' || subject === 'Reasoning') {
        const genFuncs = [generateArithmetic, generateRatioPercentage, generateGeometry, generateAdvancedMath];
        
        for (let i = 0; i < qCount * 2; i++) { 
            const func = genFuncs[i % genFuncs.length];
            potentialQuestions.push(func(standard));
        }

    } else if (subject === 'Science' || subject === 'Social') {
        const pool = window.appState.quizDataPool[subject] || [];
        let relevantFacts = pool.filter(fact => fact.s <= standard);
        
        while (relevantFacts.length < qCount) {
            relevantFacts = relevantFacts.concat(pool.filter(fact => fact.s <= standard));
        }
        
        relevantFacts.forEach(fact => {
            const allOptions = [fact.a, ...fact.options];
            potentialQuestions.push({
                q: fact.q,
                options: shuffleArray(allOptions),
                a: fact.a,
                exp: fact.exp 
            });
        });
    }
    
    return shuffleArray(potentialQuestions).slice(0, qCount);
}


// ----------------------------------------------------------------------
// --- UI Renderer Functions (Handling MathJax and Explanations) ---
// ----------------------------------------------------------------------

function updateHeader() {
    const { userName, userStandard, selectedSubject } = window.appState;
    const displayEl = document.getElementById('user-display');
    if (userName && userStandard) {
        let text = `Student: ${userName} | Standard: ${userStandard}`;
        if (selectedSubject) {
            text += ` | Subject: ${selectedSubject}`;
        }
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
                class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                Start Quiz
                <span data-lucide="arrow-right" class="w-5 h-5 ml-2"></span>
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
                    const info = subjectIconMap[subject] || { icon: 'book', color: 'bg-gray-500' };
                    return `
                        <button data-subject="${subject}"
                            class="subject-card flex flex-col items-center justify-center p-6 rounded-xl border border-gray-200 shadow-md hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-1">
                            <div class="p-3 rounded-full ${info.color} text-white mb-3">
                                <span data-lucide="${info.icon}" class="w-8 h-8"></span>
                            </div>
                            <span class="text-lg font-semibold text-gray-800">${subject}</span>
                        </button>
                    `;
                }).join('')}
            </div>
            <div class="mt-8 text-center">
                <button id="changeDetailsButton"
                    class="text-sm text-indigo-500 hover:text-indigo-700 flex items-center mx-auto">
                    <span data-lucide="user-cog" class="w-4 h-4 mr-1"></span>
                    Change Name/Standard
                </button>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    updateHeader();

    document.querySelectorAll('.subject-card').forEach(button => {
        button.addEventListener('click', (e) => {
            const subject = e.currentTarget.dataset.subject;
            window.appState.selectedSubject = subject;
            window.appState.currentQuiz = generateQuiz(subject, window.appState.userStandard);
            window.appState.currentQuestionIndex = 0;
            window.appState.score = 0;
            window.appState.isAnswerLocked = false;
            window.renderApp('quiz');
        });
    });

    document.getElementById('changeDetailsButton').addEventListener('click', () => {
        window.renderApp('auth');
    });
}


function renderQuizScreen() {
    const { currentQuiz, currentQuestionIndex, selectedSubject } = window.appState;
    const currentQ = currentQuiz[currentQuestionIndex];
    const content = document.getElementById('app-content');

    if (!currentQ) {
        window.renderApp('result');
        return;
    }
    
    const optionsDisabled = window.appState.isAnswerLocked ? 'disabled' : '';

    content.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="flex justify-between items-center mb-4">
                <span class="text-lg font-bold text-gray-700">${selectedSubject} Quiz</span>
                <span class="text-xl font-extrabold text-indigo-600">${currentQuestionIndex + 1} / ${QUIZ_SESSION_SIZE}</span>
            </div>

            <div id="quiz-question-card" class="question-card flex-grow bg-white p-6 rounded-xl border border-indigo-100 shadow-lg mb-4 custom-scrollbar">
                <p class="text-xl font-semibold text-gray-900 mb-6">${currentQ.q}</p>
                
                <div id="options-container" class="grid grid-cols-1 md:grid-cols-2 gap-4" style="visibility: hidden;">
                    ${currentQ.options.map((option, index) => `
                        <button data-option="${option}"
                            class="option-button w-full text-left p-4 rounded-lg border border-gray-200 text-gray-800 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-400 focus:outline-none disabled:opacity-100 disabled:cursor-not-allowed ${optionsDisabled}">
                            ${option}
                        </button>
                    `).join('')}
                </div>
                
                <div id="explanation-box" class="mt-8 p-4 rounded-lg bg-indigo-50 border-l-4 border-indigo-400 hidden">
                    <p class="font-bold text-indigo-700 flex items-center mb-2">
                        <span data-lucide="info" class="w-5 h-5 mr-2"></span>
                        Explanation
                    </p>
                    <p id="explanation-text" class="text-gray-700"></p>
                </div>
            </div>

            <div id="feedback-message" class="mt-2 text-center font-bold text-lg hidden"></div>

            <div class="mt-auto flex justify-between pt-4 border-t border-gray-100">
                <button id="exitQuizButton" class="text-sm text-gray-500 hover:text-red-500 flex items-center disabled:opacity-50">
                    <span data-lucide="log-out" class="w-4 h-4 mr-1"></span>
                    Exit
                </button>
                <button id="nextQuestionButton"
                    class="py-2 px-6 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    disabled>
                    ${currentQuestionIndex === QUIZ_SESSION_SIZE - 1 ? 'Finish Quiz' : 'Next Question'}
                    <span data-lucide="chevron-right" class="w-4 h-4 ml-2 inline-block align-middle"></span>
                </button>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    updateHeader();

    // Re-render MathJax (FIX 1: Prevents $ from showing in options)
    if (window.MathJax) {
        window.MathJax.typesetPromise([content]).then(() => {
            // Unhide the options container once MathJax is done processing the math
            document.getElementById('options-container').style.visibility = 'visible';
        });
    } else {
        // If MathJax somehow fails to load, still show the options
        document.getElementById('options-container').style.visibility = 'visible';
    }

    const optionsContainer = document.getElementById('options-container');
    const nextButton = document.getElementById('nextQuestionButton');
    const feedbackMessage = document.getElementById('feedback-message');
    const explanationBox = document.getElementById('explanation-box');
    const explanationText = document.getElementById('explanation-text');
    
    // IMPROVED: More robust answer normalization for fractions and pi
    const normalizeAnswer = (str) => String(str)
        .replace(/\$/g, '')          // Remove MathJax wrappers
        .replace(/\\frac{(\d+)}{(\d+)}/g, '$1/$2') // Convert \frac{1}{2} to 1/2 for consistent comparison
        .replace(/\\pi/g, 'pi')      // Convert \pi to a keyword 'pi'
        .replace(/\\cdot/g, '*')     // Convert \cdot (multiplication dot) to *
        .replace(/\\div/g, '/')      // Convert \div to /
        .replace(/\s/g, '')          // Remove all whitespace
        .trim();

    function handleAnswer(selectedOption) {
        if (window.appState.isAnswerLocked) return;

        window.appState.isAnswerLocked = true;
        const normalizedSelected = normalizeAnswer(selectedOption);
        const normalizedCorrect = normalizeAnswer(currentQ.a);
        const isCorrect = normalizedSelected === normalizedCorrect;
        
        const allButtons = optionsContainer.querySelectorAll('.option-button');

        allButtons.forEach(button => {
            button.disabled = true;
            const buttonText = normalizeAnswer(button.dataset.option);
            
            if (buttonText === normalizedSelected) {
                button.classList.add(isCorrect ? 'bg-green-100' : 'bg-red-100');
                button.classList.remove('hover:bg-indigo-50', 'hover:border-indigo-400');
            } else if (buttonText === normalizedCorrect) {
                button.classList.add('bg-green-200', 'border-green-500'); 
            }
        });

        if (isCorrect) {
            window.appState.score++;
            feedbackMessage.classList.remove('hidden', 'text-red-600');
            feedbackMessage.classList.add('text-green-600');
            feedbackMessage.innerText = 'Correct! ✅';
        } else {
            feedbackMessage.classList.remove('hidden', 'text-green-600');
            feedbackMessage.classList.add('text-red-600');
            feedbackMessage.innerText = 'Incorrect. ❌';
        }

        // Display Explanation (FIX 2: Prevents $ from showing in explanation text)
        explanationText.innerHTML = currentQ.exp || 'No detailed explanation available for this specific dynamic question.';
        
        if (window.MathJax) {
            // ONLY show the box AFTER MathJax has rendered the math inside the text
            window.MathJax.typesetPromise([explanationText]).then(() => {
                 explanationBox.classList.remove('hidden');
            });
        } else {
            // Fallback: if MathJax isn't loaded, just show the box immediately.
            explanationBox.classList.remove('hidden');
        }

        nextButton.disabled = false;
    }

    optionsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.option-button');
        if (button && !window.appState.isAnswerLocked) {
            handleAnswer(button.dataset.option);
        }
    });

    nextButton.addEventListener('click', () => {
        window.appState.isAnswerLocked = false;
        window.appState.currentQuestionIndex++;
        if (window.appState.currentQuestionIndex < QUIZ_SESSION_SIZE) {
            window.renderApp('quiz');
        } else {
            window.renderApp('result');
        }
    });

    document.getElementById('exitQuizButton').addEventListener('click', () => {
        if (confirm('Are you sure you want to exit the quiz? Your progress will be lost.')) {
            window.renderApp('subject-select');
        }
    });
}

function renderResultScreen() {
    const { score, selectedSubject, userStandard } = window.appState;
    const total = QUIZ_SESSION_SIZE;
    const percentage = ((score / total) * 100).toFixed(1);
    const content = document.getElementById('app-content');

    let message;
    let resultClass;
    if (percentage >= 80) {
        message = "Excellent job! You have a strong grasp of the subject.";
        resultClass = "text-green-600 border-green-200 bg-green-50";
    } else if (percentage >= 50) {
        message = "Good effort! You're making progress, but review is needed.";
        resultClass = "text-yellow-600 border-yellow-200 bg-yellow-50";
    } else {
        message = "Keep practicing! Focus on reviewing the core concepts.";
        resultClass = "text-red-600 border-red-200 bg-red-50";
    }

    content.innerHTML = `
        <div class="max-w-md mx-auto my-auto p-8 rounded-xl shadow-2xl text-center border-4 ${resultClass}">
            <div class="p-4 mb-4 rounded-full inline-block ${resultClass.split(' ')[0].replace('600', '800')} ${resultClass.split(' ')[2]}">
                 <span data-lucide="${percentage >= 50 ? 'trophy' : 'lightbulb'}" class="w-10 h-10"></span>
            </div>
            <h2 class="text-3xl font-extrabold mb-2 text-gray-800">Quiz Complete!</h2>
            <p class="text-xl font-bold mb-4 ${resultClass.split(' ')[0]}">${selectedSubject} - Standard ${userStandard}</p>
            
            <div class="my-6">
                <p class="text-5xl font-extrabold text-indigo-700">${score} / ${total}</p>
                <p class="text-2xl font-semibold text-gray-600 mt-2">Score: ${percentage}%</p>
            </div>

            <p class="text-md mb-8 italic text-gray-700">${message}</p>

            <div class="flex flex-col space-y-3">
                <button id="retakeQuizButton"
                    class="w-full py-2 px-4 rounded-md shadow-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                    Retake ${selectedSubject} Quiz
                </button>
                <button id="backToSubjectsButton"
                    class="w-full py-2 px-4 rounded-md shadow-sm text-sm font-medium text-indigo-600 border border-indigo-200 bg-white hover:bg-indigo-50">
                    Back to Subjects
                </button>
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
}

// --- Master Renderer ---
window.renderApp = function(screen) {
    window.appState.currentScreen = screen;
    
    // Clear MathJax output on screen transition to prevent rendering issues
    if (window.MathJax) {
        window.MathJax.startup.document.clear();
        window.MathJax.startup.document.updateDocument();
    }

    switch(screen) {
        case 'auth':
            renderAuthScreen();
            break;
        case 'subject-select':
            renderSubjectSelectScreen();
            break;
        case 'quiz':
            renderQuizScreen();
            break;
        case 'result':
            renderResultScreen();
            break;
        default:
            break;
    }
};

// --- Initialization ---

async function initializeApp() {
    try {
        const response = await fetch('study_data.json');
        if (!response.ok) {
            // This error handler is critical if the JSON file is malformed or missing
            throw new Error(`HTTP error! status: ${response.status} or JSON parsing failed.`);
        }
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
                <span data-lucide="alert-triangle" class="w-6 h-6 inline-block mb-2"></span>
                <p class="font-semibold">Initialization Error (Check study_data.json)</p>
                <p class="text-sm">The data file could not be loaded or parsed. Check your browser console for syntax errors in 'study_data.json'.</p>
                <p class="text-xs mt-2 text-red-500">Error details: ${error.message}</p>
            </div>
        `;
        lucide.createIcons();
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);
