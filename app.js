// State management with localStorage persistence
const STORAGE_KEYS = {
    transactions: 'mm_transactions_v1',
    goals: 'mm_goals_v1'
};

function loadState() {
    const transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions) || '[]');
    const goals = JSON.parse(localStorage.getItem(STORAGE_KEYS.goals) || '[]');
    return { transactions, goals };
}

function saveState(state) {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
    localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(state.goals));
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(value) {
    const number = Number(value) || 0;
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: guessCurrency() }).format(number);
}

function guessCurrency() {
    // Basic guess based on browser locale. Fallback USD.
    try {
        const locale = navigator.language || 'en-US';
        if (locale.startsWith('en-GB')) return 'GBP';
        if (locale.startsWith('en-AU')) return 'AUD';
        if (locale.startsWith('en-CA')) return 'CAD';
        if (locale.startsWith('en-IN')) return 'INR';
        if (locale.startsWith('en-NZ')) return 'NZD';
        if (locale.startsWith('de-') || locale.startsWith('fr-') || locale.startsWith('es-') || locale.startsWith('it-')) return 'EUR';
        if (locale.startsWith('ja-')) return 'JPY';
        if (locale.startsWith('zh-')) return 'CNY';
        return 'USD';
    } catch {
        return 'USD';
    }
}

// UI helpers
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function byId(id) { return document.getElementById(id); }

// Global app state
let appState = loadState();

// Derived totals
function computeTotals(transactions) {
    let totalIncome = 0;
    let totalExpenses = 0;
    for (const tx of transactions) {
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'income') totalIncome += amount;
        else totalExpenses += amount;
    }
    const profit = totalIncome - totalExpenses;
    return { totalIncome, totalExpenses, profit };
}

function renderOverview() {
    const { totalIncome, totalExpenses, profit } = computeTotals(appState.transactions);
    setText('totalIncome', formatCurrency(totalIncome));
    setText('totalExpenses', formatCurrency(totalExpenses));
    const profitEl = byId('profit');
    profitEl.textContent = formatCurrency(profit);
    profitEl.classList.toggle('positive', profit >= 0);
    profitEl.classList.toggle('negative', profit < 0);

    // Update inline profit on goals page
    setText('profitInline', formatCurrency(profit));
}

function renderTransactions() {
    const tbody = document.querySelector('#transactionsTable tbody');
    tbody.innerHTML = '';
    const sorted = [...appState.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const tx of sorted) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(tx.date)}</td>
            <td>${tx.type === 'income' ? 'Income' : 'Expense'}</td>
            <td>${escapeHtml(tx.category || '')}</td>
            <td class="num">${formatCurrency(tx.amount)}</td>
            <td>${escapeHtml(tx.note || '')}</td>
            <td class="row-actions">
                <button class="btn danger" data-action="delete" data-id="${tx.id}">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    }

    tbody.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.dataset && target.dataset.action === 'delete') {
            const id = target.dataset.id;
            appState.transactions = appState.transactions.filter(t => t.id !== id);
            saveState(appState);
            renderAll();
        }
    }, { once: true });
}

function renderGoals() {
    const { profit } = computeTotals(appState.transactions);
    const list = byId('goalsList');
    list.innerHTML = '';

    if (appState.goals.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'helper-note';
        empty.textContent = 'No goals yet. Create your first goal above!';
        list.appendChild(empty);
        return;
    }

    for (const goal of appState.goals) {
        const progress = Math.max(0, Math.min(1, goal.targetAmount > 0 ? profit / goal.targetAmount : 0));
        const percent = Math.round(progress * 100);
        const card = document.createElement('div');
        card.className = 'goal-card';
        card.innerHTML = `
            <div>
                <div class="goal-title">${escapeHtml(goal.name)}</div>
                <div class="goal-meta">Target: ${formatCurrency(goal.targetAmount)} • Progress: ${percent}%</div>
                <div class="progress" aria-label="Goal progress">
                    <div class="bar" style="width:${percent}%"></div>
                </div>
            </div>
            <div class="goal-actions">
                <button class="btn danger" data-action="delete-goal" data-id="${goal.id}">Delete</button>
            </div>
        `;
        list.appendChild(card);
    }

    list.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.dataset && target.dataset.action === 'delete-goal') {
            const id = target.dataset.id;
            appState.goals = appState.goals.filter(g => g.id !== id);
            saveState(appState);
            renderAll();
        }
    }, { once: true });
}

function renderAll() {
    renderOverview();
    renderTransactions();
    renderGoals();
}

// Form handlers
function setupTransactionForm() {
    const form = byId('transactionForm');
    const dateInput = byId('txDate');
    // default date = today
    const today = new Date();
    dateInput.value = today.toISOString().slice(0, 10);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = byId('txType').value;
        const date = byId('txDate').value;
        const category = byId('txCategory').value.trim();
        const amount = parseFloat(byId('txAmount').value);
        const note = byId('txNote').value.trim();

        if (!date || !category || isNaN(amount) || amount < 0) {
            alert('Please provide a valid type, date, category and non-negative amount.');
            return;
        }

        const tx = { id: generateId('tx'), type, date, category, amount, note };
        appState.transactions.push(tx);
        saveState(appState);
        form.reset();
        byId('txType').value = type; // keep last used type
        byId('txDate').value = date; // keep date
        renderAll();
    });
}

function setupGoalForm() {
    const form = byId('goalForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = byId('goalName').value.trim();
        const targetAmount = parseFloat(byId('goalTarget').value);
        if (!name || isNaN(targetAmount) || targetAmount <= 0) {
            alert('Please provide a goal name and a positive target amount.');
            return;
        }
        const goal = { id: generateId('goal'), name, targetAmount };
        appState.goals.push(goal);
        saveState(appState);
        form.reset();
        renderGoals();
    });
}

// Tabs
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            tabButtons.forEach(b => b.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
    });
}

// Export/Import
function setupDataTransfer() {
    const exportBtn = byId('exportData');
    exportBtn.addEventListener('click', () => {
        const data = JSON.stringify(appState, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'money-manager-data.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    const importInput = byId('importData');
    importInput.addEventListener('change', async () => {
        const file = importInput.files && importInput.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.goals)) {
                throw new Error('Invalid data format');
            }
            appState = { transactions: parsed.transactions, goals: parsed.goals };
            saveState(appState);
            renderAll();
        } catch (err) {
            alert('Failed to import data: ' + (err && err.message ? err.message : String(err)));
        } finally {
            importInput.value = '';
        }
    });
}

// Utilities
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Initialize
setupTabs();
setupTransactionForm();
setupGoalForm();
setupDataTransfer();
renderAll();

