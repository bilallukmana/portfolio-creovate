(() => {
  const STORAGE_KEYS = {
    transactions: 'mm_transactions_v1',
    goals: 'mm_goals_v1'
  };

  const els = {
    tabs: document.querySelectorAll('.tab-button'),
    panels: document.querySelectorAll('.tab-panel'),
    totalIncome: document.getElementById('total-income'),
    totalExpenses: document.getElementById('total-expenses'),
    totalProfit: document.getElementById('total-profit'),
    goalsProfit: document.getElementById('goals-profit'),
    // transactions
    txForm: document.getElementById('transaction-form'),
    txType: document.getElementById('tx-type'),
    txAmount: document.getElementById('tx-amount'),
    txCategory: document.getElementById('tx-category'),
    txDate: document.getElementById('tx-date'),
    txNote: document.getElementById('tx-note'),
    txTableBody: document.getElementById('transactions-tbody'),
    clearAllTransactions: document.getElementById('clear-all-transactions'),
    // goals
    goalForm: document.getElementById('goal-form'),
    goalName: document.getElementById('goal-name'),
    goalTarget: document.getElementById('goal-target'),
    goalDue: document.getElementById('goal-due'),
    goalsList: document.getElementById('goals-list')
  };

  /** State */
  let transactions = loadFromStorage(STORAGE_KEYS.transactions, []);
  let goals = loadFromStorage(STORAGE_KEYS.goals, []);

  /** Utils */
  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function formatCurrency(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  function computeTotals() {
    let income = 0;
    let expenses = 0;
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount;
      else expenses += t.amount;
    }
    const profit = income - expenses;
    return { income, expenses, profit };
  }

  /** Tabs */
  function setupTabs() {
    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        els.tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const id = `tab-${btn.dataset.tab}`;
        els.panels.forEach(p => p.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        updateProfitBanner();
      });
    });
  }

  /** Transactions */
  function addTransaction(tx) {
    transactions.unshift(tx);
    saveToStorage(STORAGE_KEYS.transactions, transactions);
    render();
  }

  function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveToStorage(STORAGE_KEYS.transactions, transactions);
    render();
  }

  function clearAllTx() {
    if (!transactions.length) return;
    if (confirm('Delete all transactions?')) {
      transactions = [];
      saveToStorage(STORAGE_KEYS.transactions, transactions);
      render();
    }
  }

  function renderTransactions() {
    els.txTableBody.innerHTML = '';
    for (const t of transactions) {
      const tr = document.createElement('tr');
      const chipClass = t.type === 'income' ? 'chip-income' : 'chip-expense';
      tr.innerHTML = `
        <td><span class="chip ${chipClass}">${t.type}</span></td>
        <td>${formatCurrency(t.amount)}</td>
        <td>${escapeHtml(t.category || '')}</td>
        <td>${t.date || ''}</td>
        <td>${escapeHtml(t.note || '')}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-action="delete" data-id="${t.id}">Delete</button>
          </div>
        </td>
      `;
      els.txTableBody.appendChild(tr);
    }

    els.txTableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
    });
  }

  function escapeHtml(s) {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /** Goals */
  function addGoal(goal) {
    goals.unshift(goal);
    saveToStorage(STORAGE_KEYS.goals, goals);
    render();
  }

  function deleteGoal(id) {
    goals = goals.filter(g => g.id !== id);
    saveToStorage(STORAGE_KEYS.goals, goals);
    render();
  }

  function renderGoals() {
    els.goalsList.innerHTML = '';
    const { profit } = computeTotals();
    for (const g of goals) {
      const progress = g.targetAmount > 0 ? Math.min(100, Math.max(0, (profit / g.targetAmount) * 100)) : 0;
      const card = document.createElement('div');
      card.className = 'goal-card';
      card.innerHTML = `
        <h3>${escapeHtml(g.name)}</h3>
        <div class="goal-meta">Target: ${formatCurrency(g.targetAmount)}${g.dueDate ? ` • Due: ${g.dueDate}` : ''}</div>
        <div class="progress-bar">
          <div class="progress" style="width:${progress.toFixed(2)}%"></div>
        </div>
        <div class="goal-meta">Progress: ${progress.toFixed(1)}%</div>
        <div class="row-actions">
          <button class="icon-btn" data-action="delete-goal" data-id="${g.id}">Delete</button>
        </div>
      `;
      els.goalsList.appendChild(card);
    }

    els.goalsList.querySelectorAll('[data-action="delete-goal"]').forEach(btn => {
      btn.addEventListener('click', () => deleteGoal(btn.dataset.id));
    });
  }

  function updateProfitBanner() {
    const { income, expenses, profit } = computeTotals();
    els.totalIncome.textContent = formatCurrency(income);
    els.totalExpenses.textContent = formatCurrency(expenses);
    els.totalProfit.textContent = formatCurrency(profit);
    els.goalsProfit.textContent = formatCurrency(profit);
  }

  function render() {
    updateProfitBanner();
    renderTransactions();
    renderGoals();
  }

  /** Event bindings */
  function setupEvents() {
    els.txForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = els.txType.value;
      const amount = Number(els.txAmount.value);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const category = els.txCategory.value.trim();
      const date = els.txDate.value;
      const note = els.txNote.value.trim();
      addTransaction({
        id: crypto.randomUUID(),
        type,
        amount,
        category,
        date,
        note
      });
      els.txForm.reset();
    });

    els.clearAllTransactions.addEventListener('click', clearAllTx);

    els.goalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = els.goalName.value.trim();
      const targetAmount = Number(els.goalTarget.value);
      if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
      const dueDate = els.goalDue.value;
      addGoal({ id: crypto.randomUUID(), name, targetAmount, dueDate });
      els.goalForm.reset();
    });
  }

  /** Init */
  setupTabs();
  setupEvents();
  render();
})();

