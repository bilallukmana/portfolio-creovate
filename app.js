// Money Manager - Client-side logic
// Data model is stored in localStorage under the key MONEY_MANAGER_DATA_V1

const STORAGE_KEY = 'MONEY_MANAGER_DATA_V1';

/** @typedef {{id:string, amount:number, date:string, category:string, description?:string, createdAt:number}} Entry */
/** @typedef {{id:string, name:string, target:number, createdAt:number}} Goal */
/** @typedef {{incomes: Entry[], expenses: Entry[], goals: Goal[]}} AppData */

function loadData() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { incomes: [], expenses: [], goals: [] };
		const parsed = JSON.parse(raw);
		return {
			incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
			expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
			goals: Array.isArray(parsed.goals) ? parsed.goals : [],
		};
	} catch (e) {
		console.error('Failed to load data, resetting.', e);
		return { incomes: [], expenses: [], goals: [] };
	}
}

/**
 * @param {AppData} data
 */
function saveData(data) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateId(prefix = 'id') {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(amount) {
	const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: detectCurrency() });
	return formatter.format(amount);
}

function detectCurrency() {
	// Fallback to USD; attempts to use browser default if available
	try {
		const region = Intl.DateTimeFormat().resolvedOptions().locale;
		// Some very rough defaults by locale; customize as needed
		if (/^en-(US|PH|SG)/i.test(region)) return 'USD';
		if (/^en-GB/i.test(region)) return 'GBP';
		if (/^en-CA/i.test(region)) return 'CAD';
		if (/^en-AU/i.test(region)) return 'AUD';
		if (/^de-|^nl-|^fr-|^es-|^it-|^pt-/i.test(region)) return 'EUR';
		return 'USD';
	} catch { return 'USD'; }
}

/** @param {Entry[]} entries */
function sortEntries(entries) {
	return [...entries].sort((a, b) => {
		if (a.date !== b.date) return a.date < b.date ? 1 : -1; // newest first
		return b.createdAt - a.createdAt;
	});
}

function computeTotals(data) {
	const totalIncome = data.incomes.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
	const totalExpenses = data.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
	const profit = totalIncome - totalExpenses;
	return { totalIncome, totalExpenses, profit };
}

// DOM refs
const el = {
	tabButtons: Array.from(document.querySelectorAll('.tab-button')),
	tabPanels: {
		overview: document.getElementById('tab-overview'),
		income: document.getElementById('tab-income'),
		expenses: document.getElementById('tab-expenses'),
		goals: document.getElementById('tab-goals'),
	},
	// totals
	totalIncome: document.getElementById('totalIncome'),
	totalExpenses: document.getElementById('totalExpenses'),
	totalProfit: document.getElementById('totalProfit'),
	goalsProfit: document.getElementById('goalsProfit'),
	// forms
	formIncome: document.getElementById('formIncome'),
	formExpense: document.getElementById('formExpense'),
	formQuickIncome: document.getElementById('formQuickIncome'),
	formQuickExpense: document.getElementById('formQuickExpense'),
	formGoal: document.getElementById('formGoal'),
	// tables
	incomeTbody: document.getElementById('incomeTbody'),
	expenseTbody: document.getElementById('expenseTbody'),
	// goals
	goalsList: document.getElementById('goalsList'),
	goalsEmpty: document.getElementById('goalsEmpty'),
	// footer actions
	btnExport: document.getElementById('btnExport'),
	btnReset: document.getElementById('btnReset'),
	inputImport: document.getElementById('importFile'),
};

// Toast helper
let toastEl;
function showToast(message) {
	if (!toastEl) {
		toastEl = document.createElement('div');
		toastEl.className = 'toast';
		document.body.appendChild(toastEl);
	}
	toastEl.textContent = message;
	toastEl.classList.add('show');
	setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// State
let data = loadData();

function renderTotals() {
	const { totalIncome, totalExpenses, profit } = computeTotals(data);
	el.totalIncome.textContent = formatCurrency(totalIncome);
	el.totalExpenses.textContent = formatCurrency(totalExpenses);
	el.totalProfit.textContent = formatCurrency(profit);
	el.goalsProfit.textContent = formatCurrency(profit);
}

function renderIncomeTable() {
	const entries = sortEntries(data.incomes);
	if (!entries.length) {
		el.incomeTbody.innerHTML = `<tr><td colspan="5" class="center empty">No income yet</td></tr>`;
		return;
	}
	el.incomeTbody.innerHTML = entries.map(e => `
		<tr data-id="${e.id}">
			<td>${escapeHtml(e.date)}</td>
			<td>${escapeHtml(e.category)}</td>
			<td>${escapeHtml(e.description || '')}</td>
			<td class="num">${formatCurrency(Number(e.amount) || 0)}</td>
			<td class="row-actions">
				<button class="btn small" data-action="delete" data-type="income" aria-label="Delete">Delete</button>
			</td>
		</tr>
	`).join('');
}

function renderExpenseTable() {
	const entries = sortEntries(data.expenses);
	if (!entries.length) {
		el.expenseTbody.innerHTML = `<tr><td colspan="5" class="center empty">No expenses yet</td></tr>`;
		return;
	}
	el.expenseTbody.innerHTML = entries.map(e => `
		<tr data-id="${e.id}">
			<td>${escapeHtml(e.date)}</td>
			<td>${escapeHtml(e.category)}</td>
			<td>${escapeHtml(e.description || '')}</td>
			<td class="num">${formatCurrency(Number(e.amount) || 0)}</td>
			<td class="row-actions">
				<button class="btn small" data-action="delete" data-type="expense" aria-label="Delete">Delete</button>
			</td>
		</tr>
	`).join('');
}

function renderGoals() {
	const profit = computeTotals(data).profit;
	if (!data.goals.length) {
		el.goalsEmpty.classList.remove('hidden');
		el.goalsList.innerHTML = '';
		return;
	}
	el.goalsEmpty.classList.add('hidden');
	el.goalsList.innerHTML = data.goals.map(g => {
		const target = Math.max(0, Number(g.target) || 0);
		const progress = target === 0 ? 0 : Math.max(0, Math.min(1, profit / target));
		const pct = Math.round(progress * 100);
		return `
			<div class="goal" data-id="${g.id}">
				<div class="goal-top">
					<div>
						<div class="goal-name">${escapeHtml(g.name)}</div>
						<div class="goal-amt">${formatCurrency(profit)} / ${formatCurrency(target)} (${pct}%)</div>
					</div>
					<div class="row-actions">
						<button class="btn small" data-action="delete-goal" aria-label="Delete goal">Delete</button>
					</div>
				</div>
				<div class="progress"><div style="width:${pct}%"></div></div>
			</div>
		`;
	}).join('');
}

function escapeHtml(str) {
	return String(str)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function addEntry(kind, values) {
	const entry = {
		id: generateId(kind),
		amount: Number(values.amount),
		date: values.date,
		category: values.category || '',
		description: values.description || '',
		createdAt: Date.now(),
	};
	if (kind === 'income') {
		data.incomes.push(entry);
	} else {
		data.expenses.push(entry);
	}
	saveData(data);
	renderTotals();
	renderIncomeTable();
	renderExpenseTable();
	renderGoals();
	showToast(`${kind === 'income' ? 'Income' : 'Expense'} added`);
}

function deleteEntry(kind, id) {
	if (kind === 'income') {
		data.incomes = data.incomes.filter(e => e.id !== id);
	} else {
		data.expenses = data.expenses.filter(e => e.id !== id);
	}
	saveData(data);
	renderTotals();
	renderIncomeTable();
	renderExpenseTable();
	renderGoals();
	showToast('Deleted');
}

function addGoal(name, target) {
	const goal = { id: generateId('goal'), name: name.trim(), target: Number(target), createdAt: Date.now() };
	data.goals.push(goal);
	saveData(data);
	renderGoals();
	showToast('Goal created');
}

function deleteGoal(id) {
	data.goals = data.goals.filter(g => g.id !== id);
	saveData(data);
	renderGoals();
	showToast('Goal deleted');
}

function bindTabs() {
	el.tabButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			const target = btn.dataset.tab;
			el.tabButtons.forEach(b => b.classList.toggle('active', b === btn));
			Object.entries(el.tabPanels).forEach(([key, panel]) => {
				panel.classList.toggle('active', `tab-${key}` === `tab-${target}`);
			});
		});
	});
}

function bindForms() {
	function parseForm(form) {
		const fd = new FormData(form);
		return Object.fromEntries(Array.from(fd.entries()));
	}
	// Income
	el.formIncome?.addEventListener('submit', (e) => {
		e.preventDefault();
		const values = parseForm(e.currentTarget);
		if (!(values.amount && values.date)) return;
		addEntry('income', values);
		e.currentTarget.reset();
	});
	el.formQuickIncome?.addEventListener('submit', (e) => {
		e.preventDefault();
		const values = parseForm(e.currentTarget);
		if (!(values.amount && values.date)) return;
		addEntry('income', values);
		e.currentTarget.reset();
	});
	// Expense
	el.formExpense?.addEventListener('submit', (e) => {
		e.preventDefault();
		const values = parseForm(e.currentTarget);
		if (!(values.amount && values.date)) return;
		addEntry('expense', values);
		e.currentTarget.reset();
	});
	el.formQuickExpense?.addEventListener('submit', (e) => {
		e.preventDefault();
		const values = parseForm(e.currentTarget);
		if (!(values.amount && values.date)) return;
		addEntry('expense', values);
		e.currentTarget.reset();
	});
	// Goal
	el.formGoal?.addEventListener('submit', (e) => {
		e.preventDefault();
		const values = new FormData(e.currentTarget);
		const name = String(values.get('name') || '').trim();
		const target = Number(values.get('target'));
		if (!name || !(target >= 0)) return;
		addGoal(name, target);
		e.currentTarget.reset();
	});
}

function bindTables() {
	el.incomeTbody?.addEventListener('click', (e) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		if (target.dataset.action === 'delete') {
			const tr = target.closest('tr');
			const id = tr?.getAttribute('data-id');
			if (id) deleteEntry('income', id);
		}
	});
	el.expenseTbody?.addEventListener('click', (e) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		if (target.dataset.action === 'delete') {
			const tr = target.closest('tr');
			const id = tr?.getAttribute('data-id');
			if (id) deleteEntry('expense', id);
		}
	});
	el.goalsList?.addEventListener('click', (e) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		if (target.dataset.action === 'delete-goal') {
			const container = target.closest('.goal');
			const id = container?.getAttribute('data-id');
			if (id) deleteGoal(id);
		}
	});
}

function bindFooterActions() {
	el.btnExport?.addEventListener('click', () => {
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `money-manager-export-${new Date().toISOString().slice(0,10)}.json`;
		document.body.appendChild(a);
		a.click();
		URL.revokeObjectURL(url);
		a.remove();
		showToast('Exported');
	});
	el.inputImport?.addEventListener('change', async (e) => {
		const file = e.currentTarget.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const imported = JSON.parse(text);
			if (!imported || typeof imported !== 'object') throw new Error('Invalid file');
			const next = {
				incomes: Array.isArray(imported.incomes) ? imported.incomes : [],
				expenses: Array.isArray(imported.expenses) ? imported.expenses : [],
				goals: Array.isArray(imported.goals) ? imported.goals : [],
			};
			data = next;
			saveData(data);
			renderAll();
			showToast('Imported');
		} catch (err) {
			console.error(err);
			showToast('Import failed');
		}
		// reset input so selecting same file again will trigger change
		e.currentTarget.value = '';
	});
	el.btnReset?.addEventListener('click', () => {
		if (!confirm('Reset all data? This cannot be undone.')) return;
		data = { incomes: [], expenses: [], goals: [] };
		saveData(data);
		renderAll();
		showToast('Reset complete');
	});
}

function renderAll() {
	renderTotals();
	renderIncomeTable();
	renderExpenseTable();
	renderGoals();
}

function init() {
	bindTabs();
	bindForms();
	bindTables();
	bindFooterActions();
	renderAll();
}

// Initialize on DOMContentLoaded in case this file is loaded in head in some contexts
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}