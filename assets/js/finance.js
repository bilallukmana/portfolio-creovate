/* Finance Manager Logic - localStorage backed */
(function () {
    const storageKeys = {
        transactions: 'finance_transactions_v1',
        goals: 'finance_goals_v1'
    };

    function formatCurrency(value) {
        const numberValue = Number(value || 0);
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(numberValue);
    }

    function load(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            console.error('Failed to parse localStorage for', key, error);
            return fallback;
        }
    }

    function save(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getTransactions() {
        return load(storageKeys.transactions, []);
    }

    function setTransactions(transactions) {
        save(storageKeys.transactions, transactions);
        render();
    }

    function getGoals() {
        return load(storageKeys.goals, []);
    }

    function setGoals(goals) {
        save(storageKeys.goals, goals);
        render();
    }

    function calculateTotals(transactions) {
        let totalIncome = 0;
        let totalExpenses = 0;
        for (const tx of transactions) {
            if (tx.type === 'income') totalIncome += Number(tx.amount);
            if (tx.type === 'expense') totalExpenses += Number(tx.amount);
        }
        const profit = totalIncome - totalExpenses;
        return { totalIncome, totalExpenses, profit };
    }

    function renderSummary(totals) {
        const totalIncomeEl = document.getElementById('totalIncome');
        const totalExpensesEl = document.getElementById('totalExpenses');
        const totalProfitEl = document.getElementById('totalProfit');
        const availableProfitEl = document.getElementById('availableProfit');
        if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(totals.totalIncome);
        if (totalExpensesEl) totalExpensesEl.textContent = formatCurrency(totals.totalExpenses);
        if (totalProfitEl) totalProfitEl.textContent = formatCurrency(totals.profit);

        const goals = getGoals();
        const allocated = goals.reduce((sum, g) => sum + Number(g.allocated || 0), 0);
        const available = Math.max(0, totals.profit - allocated);
        if (availableProfitEl) availableProfitEl.textContent = formatCurrency(available);
    }

    function renderTransactions(transactions) {
        const tbody = document.getElementById('transactionsBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        for (const tx of sorted) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.date || ''}</td>
                <td><span class="badge ${tx.type === 'income' ? 'bg-success' : 'bg-danger'}">${tx.type}</span></td>
                <td>${tx.category || ''}</td>
                <td class="text-end">${formatCurrency(tx.amount)}</td>
                <td>${tx.note || ''}</td>
                <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-action="delete-tx" data-id="${tx.id}">Delete</button></td>
            `;
            tbody.appendChild(tr);
        }

        tbody.addEventListener('click', function (event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.matches('[data-action="delete-tx"]')) {
                const id = target.getAttribute('data-id');
                const remaining = getTransactions().filter(t => String(t.id) !== String(id));
                setTransactions(remaining);
            }
        }, { once: true });
    }

    function renderGoals(goals, totals) {
        const container = document.getElementById('goalsList');
        if (!container) return;
        container.innerHTML = '';

        const allocated = goals.reduce((sum, g) => sum + Number(g.allocated || 0), 0);
        const available = Math.max(0, totals.profit - allocated);

        for (const goal of goals) {
            const progress = goal.target > 0 ? Math.min(100, Math.round((Number(goal.allocated || 0) / Number(goal.target)) * 100)) : 0;
            const card = document.createElement('div');
            card.className = 'p-4 rounded-3 bg-white border';
            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-start gap-3">
                    <div>
                        <h6 class="mb-1">${goal.name}</h6>
                        <div class="small text-muted">Target: ${formatCurrency(goal.target)}${goal.deadline ? ' • Due: ' + goal.deadline : ''}</div>
                    </div>
                    <div class="text-end">
                        <div class="small text-muted">Saved</div>
                        <div class="fw-bold">${formatCurrency(goal.allocated || 0)}</div>
                    </div>
                </div>
                <div class="progress my-3" style="height:10px;">
                    <div class="progress-bar" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center">
                    <div class="text-muted small">Progress: ${progress}%</div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary" data-action="allocate" data-id="${goal.id}" ${available <= 0 ? 'disabled' : ''}>Allocate from Profit</button>
                        <button class="btn btn-sm btn-outline-secondary" data-action="deallocate" data-id="${goal.id}" ${Number(goal.allocated || 0) <= 0 ? 'disabled' : ''}>Remove Allocation</button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete-goal" data-id="${goal.id}">Delete</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        }

        container.addEventListener('click', function (event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const action = target.getAttribute('data-action');
            const id = target.getAttribute('data-id');
            if (!action || !id) return;

            if (action === 'delete-goal') {
                const remaining = getGoals().filter(g => String(g.id) !== String(id));
                setGoals(remaining);
                return;
            }

            if (action === 'allocate') {
                const goalsState = getGoals();
                const found = goalsState.find(g => String(g.id) === String(id));
                if (!found) return;

                const totalsNow = calculateTotals(getTransactions());
                const allocatedNow = goalsState.reduce((sum, g) => sum + Number(g.allocated || 0), 0);
                const availableNow = Math.max(0, totalsNow.profit - allocatedNow);
                if (availableNow <= 0) return;

                const remainingNeeded = Math.max(0, Number(found.target) - Number(found.allocated || 0));
                const toAllocate = Math.min(availableNow, remainingNeeded);
                found.allocated = Number(found.allocated || 0) + toAllocate;
                setGoals(goalsState);
                return;
            }

            if (action === 'deallocate') {
                const goalsState = getGoals();
                const found = goalsState.find(g => String(g.id) === String(id));
                if (!found) return;
                const amount = Number(found.allocated || 0);
                if (amount <= 0) return;
                // Deallocate everything for simplicity
                found.allocated = 0;
                setGoals(goalsState);
            }
        }, { once: true });
    }

    function render() {
        const transactions = getTransactions();
        const totals = calculateTotals(transactions);
        renderSummary(totals);
        renderTransactions(transactions);
        renderGoals(getGoals(), totals);
    }

    function onReady() {
        // Seed default date
        const dateInput = document.getElementById('date');
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const iso = today.toISOString().slice(0, 10);
            dateInput.value = iso;
        }

        const txForm = document.getElementById('transactionForm');
        if (txForm) {
            txForm.addEventListener('submit', function (event) {
                event.preventDefault();
                const formData = new FormData(txForm);
                const type = formData.get('type') || 'income';
                const amountInput = document.getElementById('amount');
                const categoryInput = document.getElementById('category');
                const dateInput = document.getElementById('date');
                const noteInput = document.getElementById('note');

                const amount = Number(amountInput.value);
                const category = categoryInput.value.trim();
                const date = dateInput.value;
                const note = (noteInput.value || '').trim();

                if (!category || !date || !isFinite(amount) || amount < 0) return;

                const newTx = {
                    id: Date.now().toString(36),
                    type: String(type),
                    amount: amount,
                    category: category,
                    date: date,
                    note: note
                };
                const all = getTransactions();
                all.push(newTx);
                setTransactions(all);
                txForm.reset();
                // keep default radio and date
                const typeIncome = document.getElementById('typeIncome');
                if (typeIncome) typeIncome.checked = true;
                const today = new Date().toISOString().slice(0, 10);
                const dateEl = document.getElementById('date');
                if (dateEl) dateEl.value = today;
            });
        }

        const clearBtn = document.getElementById('clearAllTransactions');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (confirm('Delete all transactions?')) {
                    setTransactions([]);
                }
            });
        }

        const goalForm = document.getElementById('goalForm');
        if (goalForm) {
            goalForm.addEventListener('submit', function (event) {
                event.preventDefault();
                const nameInput = document.getElementById('goalName');
                const targetInput = document.getElementById('goalTarget');
                const deadlineInput = document.getElementById('goalDeadline');

                const name = nameInput.value.trim();
                const target = Number(targetInput.value);
                const deadline = deadlineInput.value;
                if (!name || !isFinite(target) || target <= 0) return;

                const newGoal = {
                    id: Date.now().toString(36),
                    name: name,
                    target: target,
                    deadline: deadline || '',
                    allocated: 0
                };
                const all = getGoals();
                all.push(newGoal);
                setGoals(all);
                goalForm.reset();
            });
        }

        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();

