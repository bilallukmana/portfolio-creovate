// Simple Money Manager with localStorage persistence

const STORAGE_KEYS = {
  transactions: 'mm_transactions_v1',
  goals: 'mm_goals_v1'
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse storage for', key, err);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to write storage for', key, err);
  }
}

let transactions = readStorage(STORAGE_KEYS.transactions, []);
let goals = readStorage(STORAGE_KEYS.goals, []);

const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

function computeTotals() {
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const t of transactions) {
    const amount = Number(t.amount) || 0;
    if (t.type === 'income') totalIncome += amount; else totalExpenses += amount;
  }
  const profit = totalIncome - totalExpenses;
  return { totalIncome, totalExpenses, profit };
}

function renderSummary() {
  const { totalIncome, totalExpenses, profit } = computeTotals();
  document.getElementById('totalIncome').textContent = fmt.format(totalIncome);
  document.getElementById('totalExpenses').textContent = fmt.format(totalExpenses);
  const profitEl = document.getElementById('netProfit');
  profitEl.textContent = fmt.format(profit);
  profitEl.style.color = profit >= 0 ? 'var(--success)' : 'var(--danger)';
}

function renderTransactions() {
  const tbody = document.getElementById('transactionsBody');
  tbody.innerHTML = '';
  const sorted = [...transactions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (const t of sorted) {
    const tr = document.createElement('tr');
    const date = t.date ? new Date(t.date) : null;
    const dateText = date ? date.toLocaleDateString() : '-';

    tr.innerHTML = `
      <td>${dateText}</td>
      <td><span class="chip ${t.type}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
      <td>${t.category || '-'}</td>
      <td>${t.description || '-'}</td>
      <td class="num">${fmt.format(Number(t.amount) || 0)}</td>
      <td class="num">
        <button class="btn small danger" data-action="delete" data-id="${t.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderGoals() {
  const { profit } = computeTotals();
  const list = document.getElementById('goalsList');
  list.innerHTML = '';
  for (const g of goals) {
    const target = Math.max(0, Number(g.target) || 0);
    const progress = Math.max(0, Math.min(1, target === 0 ? 1 : profit / target));
    const percentage = Math.round(progress * 100);

    const item = document.createElement('div');
    item.className = 'goal-item';
    item.innerHTML = `
      <div class="goal-head">
        <div class="goal-name">${g.name}</div>
        <div class="goal-actions">
          <button class="btn small danger" data-action="delete-goal" data-id="${g.id}">Delete</button>
        </div>
      </div>
      <div class="progress-bar"><div class="progress" style="width:${percentage}%"></div></div>
      <div class="goal-meta">
        <span>Profit: ${fmt.format(profit)}</span>
        <span>Target: ${fmt.format(target)} • ${percentage}%</span>
      </div>
    `;
    list.appendChild(item);
  }
}

function addTransaction(formData) {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  const tx = {
    id,
    type: formData.get('type') === 'expense' ? 'expense' : 'income',
    amount: Number(formData.get('amount') || 0),
    category: (formData.get('category') || '').trim(),
    description: (formData.get('description') || '').trim(),
    date: formData.get('date') || new Date().toISOString().slice(0, 10)
  };
  transactions.push(tx);
  writeStorage(STORAGE_KEYS.transactions, transactions);
  renderSummary();
  renderTransactions();
  renderGoals();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  writeStorage(STORAGE_KEYS.transactions, transactions);
  renderSummary();
  renderTransactions();
  renderGoals();
}

function addGoal(formData) {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  const goal = {
    id,
    name: (formData.get('goalName') || 'Untitled Goal').trim(),
    target: Number(formData.get('goalTarget') || 0)
  };
  goals.push(goal);
  writeStorage(STORAGE_KEYS.goals, goals);
  renderGoals();
}

function deleteGoal(id) {
  goals = goals.filter(g => g.id !== id);
  writeStorage(STORAGE_KEYS.goals, goals);
  renderGoals();
}

function setupTabs() {
  const buttons = document.querySelectorAll('.tab');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(target).classList.add('active');
    });
  });
}

function setupForms() {
  const txForm = document.getElementById('transactionForm');
  txForm.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(txForm);
    const amount = Number(data.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }
    addTransaction(data);
    txForm.reset();
  });

  const goalForm = document.getElementById('goalForm');
  goalForm.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(goalForm);
    const target = Number(data.get('goalTarget'));
    if (!Number.isFinite(target) || target <= 0) {
      alert('Please enter a valid target greater than 0');
      return;
    }
    addGoal(data);
    goalForm.reset();
  });
}

function setupTableActions() {
  const tbody = document.getElementById('transactionsBody');
  tbody.addEventListener('click', e => {
    const target = e.target;
    if (target.matches('button[data-action="delete"]')) {
      const id = target.getAttribute('data-id');
      deleteTransaction(id);
    }
  });
}

function setupGoalActions() {
  const list = document.getElementById('goalsList');
  list.addEventListener('click', e => {
    const target = e.target;
    if (target.matches('button[data-action="delete-goal"]')) {
      const id = target.getAttribute('data-id');
      deleteGoal(id);
    }
  });
}

function init() {
  setupTabs();
  setupForms();
  setupTableActions();
  setupGoalActions();
  renderSummary();
  renderTransactions();
  renderGoals();
}

document.addEventListener('DOMContentLoaded', init);

