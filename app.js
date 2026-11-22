// 日本東北 7 天 6 夜雪國手帳網頁互動邏輯（單日頁籤＋總結財務頁）

(function () {
  const STORAGE_KEYS = {
    EXPENSES: 'tohoku_expenses_v1',
    RATE: 'tohoku_rate_v1',
    CHECKS: 'tohoku_checks_v1',
    TAB: 'tohoku_active_tab_v1',
  };

  const VALID_TABS = ['day-1', 'day-2', 'day-3', 'day-4', 'day-5', 'day-6', 'day-7', 'summary'];
  const DAY_ORDER = ['行前預訂', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
  const CATEGORIES = ['交通', '餐飲', '門票/體驗', '購物', '住宿', '其他'];

  const DAY_DINING_MAP = {
    1: ['dn-sendai'],
    6: ['dn-aomori'],
    7: ['dn-hanamaki'],
  };

  let state = {
    activeTab: loadActiveTab(),
    exchangeRate: loadExchangeRate(),
    expenses: loadExpenses(),
    checks: loadChecks(),
    tableFilters: {
      day: 'ALL',
      method: 'ALL',
      category: 'ALL',
      status: 'ALL',
    },
  };

  const openInlineForms = new Set();

  // === Storage Helpers ===
  function loadActiveTab() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TAB);
      return VALID_TABS.includes(saved) ? saved : 'day-1';
    } catch {
      return 'day-1';
    }
  }

  function saveActiveTab() {
    try {
      localStorage.setItem(STORAGE_KEYS.TAB, state.activeTab);
    } catch {
      // Ignore storage errors
    }
  }

  function loadExchangeRate() {
    try {
      const saved = parseFloat(localStorage.getItem(STORAGE_KEYS.RATE));
      return Number.isFinite(saved) && saved > 0 ? saved : TRIP_INFO.defaultRate;
    } catch {
      return TRIP_INFO.defaultRate;
    }
  }

  function saveExchangeRate() {
    try {
      localStorage.setItem(STORAGE_KEYS.RATE, String(state.exchangeRate));
    } catch {
      // Ignore storage errors
    }
  }

  function loadExpenses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (!raw) return cloneDefaults();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return cloneDefaults();
      const defaultMap = new Map(DEFAULT_EXPENSES.map((d) => [d.id, d.stopKey]));
      return parsed.map((item) =>
        !item.stopKey && defaultMap.has(item.id)
          ? { ...item, stopKey: defaultMap.get(item.id) }
          : item
      );
    } catch {
      return cloneDefaults();
    }
  }

  function saveExpenses() {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(state.expenses));
    } catch {
      // Ignore storage errors
    }
  }

  function loadChecks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CHECKS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveChecks() {
    try {
      localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(state.checks));
    } catch {
      // Ignore storage errors
    }
  }

  function cloneDefaults() {
    return DEFAULT_EXPENSES.map((item) => ({ ...item }));
  }

  // === Format & Math Helpers ===
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtNum(num) {
    return Math.round(num).toLocaleString('zh-TW');
  }

  function toTwd(item) {
    const amt = Number(item.amount) || 0;
    return item.currency === 'TWD' ? amt : amt * state.exchangeRate;
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function inferCategoryFromStop(cat) {
    if (!cat) return '其他';
    if (cat.includes('交通') || cat.includes('鐵道') || cat.includes('移動') || cat.includes('機場') || cat.includes('專車')) {
      return '交通';
    }
    if (cat.includes('美食') || cat.includes('早市') || cat.includes('午餐') || cat.includes('晚餐') || cat.includes('茶屋')) {
      return '餐飲';
    }
    if (cat.includes('採買') || cat.includes('購物')) {
      return '購物';
    }
    if (cat.includes('住宿') || cat.includes('溫泉宿')) {
      return '住宿';
    }
    if (cat.includes('必遊') || cat.includes('古剎') || cat.includes('藝術') || cat.includes('神社') || cat.includes('絕景') || cat.includes('秘境') || cat.includes('散策')) {
      return '門票/體驗';
    }
    return '其他';
  }

  function pickStopSticker(cat) {
    if (typeof ILLUSTRATIONS === 'undefined' || !ILLUSTRATIONS.stickers) return '';
    const s = ILLUSTRATIONS.stickers;
    if (!cat) return s.snowflake;
    if (cat.includes('交通') || cat.includes('鐵道') || cat.includes('列車') || cat.includes('移動') || cat.includes('機場')) {
      return s.train;
    }
    if (cat.includes('溫泉') || cat.includes('秘境') || cat.includes('茶屋')) {
      return s.onsen;
    }
    if (cat.includes('伴手禮') || cat.includes('購物') || cat.includes('美食') || cat.includes('採買') || cat.includes('神社')) {
      return s.apple;
    }
    if (cat.includes('必遊') || cat.includes('絕景') || cat.includes('藝術')) {
      return s.ribbon;
    }
    return s.snowflake;
  }

  // === Render: Static Illustrations ===
  function renderHeroAndSummaryIllustrations() {
    if (typeof ILLUSTRATIONS === 'undefined') return;
    const heroIllust = document.getElementById('hero-illustration');
    if (heroIllust) heroIllust.innerHTML = ILLUSTRATIONS.hero;

    const sumIllust = document.getElementById('summary-illustration');
    if (sumIllust) sumIllust.innerHTML = ILLUSTRATIONS.summary;
  }

  // === Tab Navigation ===
  function switchTab(tabId, scrollToContent = true) {
    if (!VALID_TABS.includes(tabId)) return;
    state.activeTab = tabId;
    saveActiveTab();

    let activeBtn = null;
    document.querySelectorAll('#main-tab-bar [data-tab]').forEach((btn) => {
      const isCurrent = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isCurrent);
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      if (isCurrent) activeBtn = btn;
    });

    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    const panelItin = document.getElementById('panel-itinerary');
    const panelSummary = document.getElementById('panel-summary');
    const isSummary = tabId === 'summary';

    if (panelItin && panelSummary) {
      panelItin.hidden = isSummary;
      panelItin.classList.toggle('active', !isSummary);
      panelSummary.hidden = !isSummary;
      panelSummary.classList.toggle('active', isSummary);
    }

    if (!isSummary) {
      renderCurrentDay();
    }

    if (scrollToContent) {
      requestAnimationFrame(() => {
        const mainEl = document.querySelector('main');
        const navEl = document.querySelector('.sticky-nav');
        const navHeight = navEl ? navEl.offsetHeight : 0;
        const targetY = mainEl
          ? mainEl.getBoundingClientRect().top + window.scrollY - navHeight - 8
          : 0;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      });
    }
  }

  function getDayExpenseTwd(dayNum) {
    const dayKey = `Day ${dayNum}`;
    return state.expenses
      .filter((e) => e.day === dayKey)
      .reduce((sum, e) => sum + toTwd(e), 0);
  }

  function renderInlineExpenseRows(items) {
    return items
      .map((item) => {
        const amt = Number(item.amount) || 0;
        const curSymbol = item.currency === 'TWD' ? 'NT$' : '¥';
        const twdVal = toTwd(item);
        return `
          <div class="stop-expense-row ${item.paid ? 'is-paid' : ''}" data-exp-id="${escapeHtml(item.id)}">
            <label class="stop-exp-check" title="勾選為已發生支出">
              <input type="checkbox" class="inline-paid-toggle" ${item.paid ? 'checked' : ''} />
              <span class="status-pill ${item.paid ? 'status-paid' : 'status-pending'}">
                ${item.paid ? '已支出' : '預估'}
              </span>
            </label>
            <div class="stop-exp-main">
              <div class="stop-exp-title">${escapeHtml(item.title)}</div>
              ${item.note ? `<div class="stop-exp-note">${escapeHtml(item.note)}</div>` : ''}
            </div>
            <span class="method-badge ${methodBadgeClass(item.method)}">${escapeHtml(item.method)}</span>
            <div class="stop-exp-amount">
              <span>${curSymbol}</span>
              <input
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                class="amount-input inline-amount-input ${amt === 0 ? 'unknown-zero' : ''}"
                value="${amt}"
                aria-label="修改 ${escapeHtml(item.title)} 金額"
              />
              <span class="stop-exp-twd">≈ NT$${fmtNum(twdVal)}</span>
            </div>
            <button type="button" class="btn btn-danger-soft btn-sm inline-delete-btn" title="刪除此筆">✕</button>
          </div>
        `;
      })
      .join('');
  }

  function wireInlineExpenseEvents(rootEl) {
    rootEl.querySelectorAll('.stop-expense-row[data-exp-id]').forEach((row) => {
      const id = row.getAttribute('data-exp-id');

      row.querySelector('.inline-paid-toggle').addEventListener('change', (ev) => {
        const target = state.expenses.find((e) => e.id === id);
        if (!target) return;
        target.paid = ev.target.checked;
        saveExpenses();
        refreshExpenseViews();
        showToast(target.paid ? `已勾選支出「${target.title}」` : `已改回預估「${target.title}」`);
      });

      row.querySelector('.inline-amount-input').addEventListener('change', (ev) => {
        const target = state.expenses.find((e) => e.id === id);
        if (!target) return;
        const nextVal = Math.max(0, Number(ev.target.value) || 0);
        target.amount = nextVal;
        if (nextVal > 0 && target.isUnknown) {
          target.isUnknown = false;
          target.paid = true;
        }
        saveExpenses();
        refreshExpenseViews();
        showToast(`已更新「${target.title}」金額`);
      });

      row.querySelector('.inline-delete-btn').addEventListener('click', () => {
        const target = state.expenses.find((e) => e.id === id);
        state.expenses = state.expenses.filter((e) => e.id !== id);
        saveExpenses();
        refreshExpenseViews();
        if (target) showToast(`已刪除「${target.title}」`);
      });
    });
  }

  // === Render: Single Active Day Page ===
  function renderCurrentDay() {
    const container = document.getElementById('days-container');
    const pageTurnEl = document.getElementById('page-turn-nav');
    if (!container) return;

    const dayNum = parseInt(state.activeTab.replace('day-', ''), 10) || 1;
    const dayObj = DAYS_DATA.find((d) => d.day === dayNum) || DAYS_DATA[0];
    const dayTwd = getDayExpenseTwd(dayObj.day);
    const daySvg = typeof ILLUSTRATIONS !== 'undefined' ? ILLUSTRATIONS.days[dayObj.day] || '' : '';
    const ribbonSvg = typeof ILLUSTRATIONS !== 'undefined' ? ILLUSTRATIONS.stickers.ribbon : '';
    const dayStopKeys = new Set(dayObj.stops.map((s) => s.stopKey));

    const stopsHtml = dayObj.stops
      .map((stop) => {
        const secondaryHtml = (stop.secondaryLinks || [])
          .map(
            (l) =>
              `<a class="map-link-btn" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">📍 ${escapeHtml(l.label)} ↗</a>`
          )
          .join('');
        const stickerHtml = pickStopSticker(stop.category);
        const stopExpenses = state.expenses.filter((e) => e.stopKey === stop.stopKey);
        const stopTotalTwd = stopExpenses.reduce((sum, e) => sum + toTwd(e), 0);
        const isFormOpen = openInlineForms.has(stop.stopKey);
        const defaultCat = inferCategoryFromStop(stop.category);

        const categoryOptionsHtml = CATEGORIES.map(
          (c) => `<option value="${escapeHtml(c)}" ${c === defaultCat ? 'selected' : ''}>${escapeHtml(c)}</option>`
        ).join('');

        return `
          <article class="stop-item" data-stop-card="${escapeHtml(stop.stopKey)}">
            <div class="stop-top">
              <div class="stop-title-group">
                <span class="stop-sticker-icon">${stickerHtml}</span>
                <span class="stop-time">${escapeHtml(stop.time)}</span>
                <h4 class="stop-name">${escapeHtml(stop.name)}</h4>
                <span class="stop-cat">${escapeHtml(stop.category)}</span>
              </div>
              <span class="stop-cost-badge">${escapeHtml(stop.costText)}</span>
            </div>
            <p class="stop-desc">${escapeHtml(stop.description)}</p>
            ${stop.tips ? `<div class="stop-tips">💡 <strong>實用提醒：</strong>${escapeHtml(stop.tips)}</div>` : ''}
            <div class="stop-actions">
              <a class="map-link-btn" href="${escapeHtml(stop.mapUrl)}" target="_blank" rel="noopener noreferrer">📍 Google 地圖定位 ↗</a>
              ${secondaryHtml}
              <button
                type="button"
                class="btn btn-outline btn-sm toggle-inline-form-btn"
                data-stop-key="${escapeHtml(stop.stopKey)}"
              >
                ${isFormOpen ? '✕ 收起記帳表單' : '＋ 記一筆費用'}
              </button>
            </div>

            ${
              stopExpenses.length > 0 || isFormOpen
                ? `
              <div class="stop-expense-box">
                <div class="stop-expense-header">
                  <span>💰 本站費用核對與預估（${stopExpenses.length} 筆）</span>
                  <span class="stop-expense-sub">小計約 NT$ ${fmtNum(stopTotalTwd)}</span>
                </div>
                ${
                  stopExpenses.length > 0
                    ? `<div class="stop-expense-list">${renderInlineExpenseRows(stopExpenses)}</div>`
                    : ''
                }
                ${
                  isFormOpen
                    ? `
                  <form class="inline-expense-form" data-inline-form="${escapeHtml(stop.stopKey)}" data-day="Day ${dayObj.day}">
                    <div class="inline-form-grid">
                      <div class="form-field inline-span-2">
                        <label>費用項目名稱</label>
                        <input type="text" name="title" value="${escapeHtml(stop.name)}" required />
                      </div>
                      <div class="form-field">
                        <label>金額</label>
                        <input type="number" inputmode="numeric" name="amount" min="0" step="1" placeholder="輸入金額" required />
                      </div>
                      <div class="form-field">
                        <label>幣別</label>
                        <select name="currency">
                          <option value="JPY" selected>日幣 (¥)</option>
                          <option value="TWD">台幣 (NT$)</option>
                        </select>
                      </div>
                      <div class="form-field">
                        <label>付款方式</label>
                        <select name="method">
                          <option value="日幣現鈔">日幣現鈔</option>
                          <option value="Suica">Suica</option>
                          <option value="信用卡">信用卡</option>
                        </select>
                      </div>
                      <div class="form-field">
                        <label>分類</label>
                        <select name="category">${categoryOptionsHtml}</select>
                      </div>
                      <div class="form-field inline-span-2">
                        <label>備註（選填）</label>
                        <input type="text" name="note" placeholder="例：門票、伴手禮、與同行分攤" />
                      </div>
                      <div class="form-field inline-paid-field">
                        <label>狀態</label>
                        <label class="checkbox-inline">
                          <input type="checkbox" name="paid" checked />
                          <span>已發生</span>
                        </label>
                      </div>
                      <div class="inline-form-actions">
                        <button type="submit" class="btn btn-primary btn-sm">✓ 加入本站費用</button>
                        <button type="button" class="btn btn-outline btn-sm cancel-inline-form-btn" data-stop-key="${escapeHtml(stop.stopKey)}">取消</button>
                      </div>
                    </div>
                  </form>
                `
                    : ''
                }
              </div>
            `
                : ''
            }
          </article>
        `;
      })
      .join('');

    // 若使用者於總結頁手動新增屬於這一天、但未關聯特定站點的額外費用
    const extraDayExpenses = state.expenses.filter(
      (e) => e.day === `Day ${dayObj.day}` && (!e.stopKey || !dayStopKeys.has(e.stopKey))
    );
    const extraExpensesHtml = extraDayExpenses.length
      ? `
        <div class="day-extra-expenses">
          <div class="stop-expense-header">
            <span>🧾 本日其他已記錄費用（${extraDayExpenses.length} 筆）</span>
            <span class="stop-expense-sub">小計約 NT$ ${fmtNum(extraDayExpenses.reduce((s, e) => s + toTwd(e), 0))}</span>
          </div>
          <div class="stop-expense-list">${renderInlineExpenseRows(extraDayExpenses)}</div>
        </div>
      `
      : '';

    // 當日專屬餐廳攻略小卡
    const matchedDiningIds = DAY_DINING_MAP[dayObj.day] || [];
    const dayDiningItems = DINING_GUIDE.filter((d) => matchedDiningIds.includes(d.id));
    const dayDiningHtml = dayDiningItems.length
      ? `
        <div class="day-dining-callout">
          <div class="day-dining-header">
            <span class="sticker-inline">${ribbonSvg}</span>
            <h4>🍽️ 本日餐廳排隊與訂位小幫手</h4>
          </div>
          <div class="day-dining-list">
            ${dayDiningItems
              .map(
                (d) => `
                <div class="day-dining-item">
                  <div class="dining-top">
                    <strong>${escapeHtml(d.title)}</strong>
                    <span class="dining-badge">${escapeHtml(d.badge)}</span>
                  </div>
                  <ul>${d.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `
      : '';

    container.innerHTML = `
      <section class="day-card" id="day-${dayObj.day}">
        <div class="day-card-header day-hero-banner">
          <div class="day-header-main">
            <div class="day-badge-row">
              <span class="day-num-badge">Day ${dayObj.day} / 7</span>
              <span class="day-meta-chip">📅 ${escapeHtml(dayObj.date)}</span>
              <span class="day-meta-chip">📍 ${escapeHtml(dayObj.area)}</span>
              <span class="day-meta-chip">🌡️ ${escapeHtml(dayObj.temp)}</span>
            </div>
            <h2 class="day-title">${escapeHtml(dayObj.title)}</h2>
            <p class="day-summary">${escapeHtml(dayObj.summary)}</p>

            <div class="day-side-info-inline">
              <div class="day-side-row"><strong>🏨 住宿：</strong>${escapeHtml(dayObj.hotel)}</div>
              <div class="day-side-row"><strong>🚄 主要交通：</strong>${escapeHtml(dayObj.transitSummary)}</div>
              <div class="day-side-row">
                <strong>💰 本日已列計費用：</strong>
                <span class="day-cost-pill">約 NT$ ${fmtNum(dayTwd)}</span>
              </div>
            </div>
          </div>

          <aside class="day-illust-card">
            ${daySvg}
            <span class="day-illust-caption">✨ Day ${dayObj.day} 旅遊插畫小卡</span>
          </aside>
        </div>

        <div class="timeline">${stopsHtml}</div>
        ${extraExpensesHtml}
        ${dayDiningHtml}
      </section>
    `;

    wireInlineExpenseEvents(container);

    // 展開／收起本站內嵌記帳表單（不跳轉頁面）
    container.querySelectorAll('.toggle-inline-form-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stopKey = btn.getAttribute('data-stop-key');
        const opening = !openInlineForms.has(stopKey);
        if (opening) openInlineForms.add(stopKey);
        else openInlineForms.delete(stopKey);
        renderCurrentDay();
        if (opening) {
          const amountInput = container.querySelector(`form[data-inline-form="${stopKey}"] input[name="amount"]`);
          if (amountInput) amountInput.focus();
        }
      });
    });

    container.querySelectorAll('.cancel-inline-form-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        openInlineForms.delete(btn.getAttribute('data-stop-key'));
        renderCurrentDay();
      });
    });

    container.querySelectorAll('form[data-inline-form]').forEach((form) => {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const stopKey = form.getAttribute('data-inline-form');
        const dayVal = form.getAttribute('data-day');
        const title = form.elements.title.value.trim();
        const amount = Math.max(0, Number(form.elements.amount.value) || 0);
        if (!title) return;

        const newItem = {
          id: `exp-inline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          day: dayVal,
          stopKey,
          title,
          category: form.elements.category.value,
          method: form.elements.method.value,
          currency: form.elements.currency.value,
          amount,
          paid: form.elements.paid.checked,
          note: form.elements.note.value.trim(),
          isUnknown: false,
        };

        state.expenses.unshift(newItem);
        openInlineForms.delete(stopKey);
        saveExpenses();
        refreshExpenseViews();
        showToast(`已在「${title}」新增一筆費用並累計至總額！`);
      });
    });

    // 底部翻頁按鈕
    if (pageTurnEl) {
      const prevBtn =
        dayObj.day > 1
          ? `<button type="button" class="btn btn-outline" data-page-turn="day-${dayObj.day - 1}">◀ 上一天：Day ${dayObj.day - 1}</button>`
          : `<button type="button" class="btn btn-outline" data-page-turn="summary">💰 直接前往：總結＆財務計算</button>`;

      const nextBtn =
        dayObj.day < 7
          ? `<button type="button" class="btn btn-primary" data-page-turn="day-${dayObj.day + 1}">下一天：Day ${dayObj.day + 1} ▶</button>`
          : `<button type="button" class="btn btn-primary" data-page-turn="summary">最後一頁：總結＆財務計算 💰▶</button>`;

      pageTurnEl.innerHTML = `${prevBtn}${nextBtn}`;
      pageTurnEl.querySelectorAll('[data-page-turn]').forEach((btn) => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-page-turn'), true));
      });
    }
  }

  // === Render: Expense Dashboard & Table ===
  function calculateTotals() {
    let grandJpy = 0;
    let grandTwdRaw = 0;
    let paidJpy = 0;
    let paidTwdRaw = 0;
    let pendingJpy = 0;
    let pendingTwdRaw = 0;

    let cashJpy = 0;
    let cashTwdRaw = 0;
    let suicaJpy = 0;
    let suicaTwdRaw = 0;
    let cardJpy = 0;
    let cardTwdRaw = 0;

    const byDayTwd = {};
    DAY_ORDER.forEach((d) => (byDayTwd[d] = 0));

    const byCatTwd = {};
    CATEGORIES.forEach((c) => (byCatTwd[c] = 0));

    for (const item of state.expenses) {
      const amt = Number(item.amount) || 0;
      const itemTwd = toTwd(item);

      if (item.currency === 'TWD') {
        grandTwdRaw += amt;
        if (item.paid) paidTwdRaw += amt;
        else pendingTwdRaw += amt;
      } else {
        grandJpy += amt;
        if (item.paid) paidJpy += amt;
        else pendingJpy += amt;
      }

      if (item.method === '日幣現鈔') {
        if (item.currency === 'TWD') cashTwdRaw += amt;
        else cashJpy += amt;
      } else if (item.method === 'Suica') {
        if (item.currency === 'TWD') suicaTwdRaw += amt;
        else suicaJpy += amt;
      } else {
        if (item.currency === 'TWD') cardTwdRaw += amt;
        else cardJpy += amt;
      }

      if (byDayTwd[item.day] === undefined) byDayTwd[item.day] = 0;
      byDayTwd[item.day] += itemTwd;

      if (byCatTwd[item.category] === undefined) byCatTwd[item.category] = 0;
      byCatTwd[item.category] += itemTwd;
    }

    return {
      grandJpy,
      grandTwdRaw,
      grandTotalTwd: grandTwdRaw + grandJpy * state.exchangeRate,
      paidJpy,
      paidTwdRaw,
      paidTotalTwd: paidTwdRaw + paidJpy * state.exchangeRate,
      pendingJpy,
      pendingTwdRaw,
      pendingTotalTwd: pendingTwdRaw + pendingJpy * state.exchangeRate,
      cashJpy,
      cashTotalTwd: cashTwdRaw + cashJpy * state.exchangeRate,
      suicaJpy,
      suicaTotalTwd: suicaTwdRaw + suicaJpy * state.exchangeRate,
      cardJpy,
      cardTwdRaw,
      cardTotalTwd: cardTwdRaw + cardJpy * state.exchangeRate,
      byDayTwd,
      byCatTwd,
    };
  }

  function renderBars(containerId, mapObj, orderedKeys) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const values = orderedKeys.map((k) => mapObj[k] || 0);
    const maxVal = Math.max(...values, 1);

    el.innerHTML = orderedKeys
      .map((key) => {
        const val = mapObj[key] || 0;
        const pct = Math.min(100, Math.round((val / maxVal) * 100));
        return `
          <div class="bar-row">
            <div class="bar-label-row">
              <span>${escapeHtml(key)}</span>
              <span>NT$ ${fmtNum(val)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderExpenseSummary() {
    const t = calculateTotals();
    const unknownCount = state.expenses.filter((e) => (Number(e.amount) || 0) === 0).length;
    const paidCount = state.expenses.filter((e) => e.paid).length;

    document.getElementById('hero-total-twd').textContent = `NT$ ${fmtNum(t.grandTotalTwd)}`;
    document.getElementById('hero-total-sub').textContent = `日幣 ¥${fmtNum(t.grandJpy)} ＋ 台幣 NT$${fmtNum(t.grandTwdRaw)}`;
    document.getElementById('hero-paid-twd').textContent = `NT$ ${fmtNum(t.paidTotalTwd)}`;
    document.getElementById('hero-paid-sub').textContent = `已發生 ${paidCount} 筆・待填金額 ${unknownCount} 筆`;

    document.getElementById('sum-grand-twd').textContent = `NT$ ${fmtNum(t.grandTotalTwd)}`;
    document.getElementById('sum-grand-detail').textContent = `日幣 ¥${fmtNum(t.grandJpy)} ＋ 台幣 NT$${fmtNum(t.grandTwdRaw)}`;

    document.getElementById('sum-paid-twd').textContent = `NT$ ${fmtNum(t.paidTotalTwd)}`;
    document.getElementById('sum-paid-detail').textContent = `¥${fmtNum(t.paidJpy)} ＋ NT$${fmtNum(t.paidTwdRaw)}（${paidCount} 筆）`;

    document.getElementById('sum-pending-twd').textContent = `NT$ ${fmtNum(t.pendingTotalTwd)}`;
    document.getElementById('sum-pending-detail').textContent = `¥${fmtNum(t.pendingJpy)} ＋ NT$${fmtNum(t.pendingTwdRaw)}（尚有 ${unknownCount} 筆待填）`;

    document.getElementById('sum-cash-jpy').textContent = `¥${fmtNum(t.cashJpy)}`;
    document.getElementById('sum-cash-twd').textContent = `折合約 NT$${fmtNum(t.cashTotalTwd)}`;

    document.getElementById('sum-suica-jpy').textContent = `¥${fmtNum(t.suicaJpy)}`;
    document.getElementById('sum-suica-twd').textContent = `折合約 NT$${fmtNum(t.suicaTotalTwd)}`;

    document.getElementById('sum-card-twd').textContent = `NT$ ${fmtNum(t.cardTotalTwd)}`;
    document.getElementById('sum-card-detail').textContent = `¥${fmtNum(t.cardJpy)} ＋ NT$${fmtNum(t.cardTwdRaw)}`;

    document.getElementById('expense-count-note').textContent = `共 ${state.expenses.length} 筆項目（${unknownCount} 筆金額尚未填入）`;

    renderBars('day-breakdown-bars', t.byDayTwd, DAY_ORDER);
    renderBars('category-breakdown-bars', t.byCatTwd, CATEGORIES);
  }

  function getFilteredExpenses() {
    const f = state.tableFilters;
    return state.expenses.filter((item) => {
      if (f.day !== 'ALL' && item.day !== f.day) return false;
      if (f.method !== 'ALL' && item.method !== f.method) return false;
      if (f.category !== 'ALL' && item.category !== f.category) return false;
      if (f.status === 'PAID' && !item.paid) return false;
      if (f.status === 'PENDING' && item.paid) return false;
      return true;
    });
  }

  function methodBadgeClass(method) {
    if (method === '日幣現鈔') return 'method-cash';
    if (method === 'Suica') return 'method-suica';
    return 'method-card';
  }

  function renderExpenseTable() {
    const tbody = document.getElementById('expense-table-body');
    if (!tbody) return;

    const list = getFilteredExpenses();
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 26px; color: #846b7d;">
            沒有符合篩選條件的費用紀錄，請調整篩選器或於上方新增項目。
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list
      .map((item) => {
        const amt = Number(item.amount) || 0;
        const twdVal = toTwd(item);
        const curSymbol = item.currency === 'TWD' ? 'NT$' : '¥';
        return `
          <tr class="${item.paid ? 'is-paid' : ''}" data-id="${escapeHtml(item.id)}">
            <td data-label="狀態">
              <label class="paid-toggle">
                <input type="checkbox" class="row-paid-toggle" ${item.paid ? 'checked' : ''} />
                <span class="status-pill ${item.paid ? 'status-paid' : 'status-pending'}">
                  ${item.paid ? '已發生' : '預估中'}
                </span>
              </label>
            </td>
            <td data-label="天數"><strong>${escapeHtml(item.day)}</strong></td>
            <td data-label="項目" class="td-title-cell">
              <div style="font-weight: 700; color: #4a3544;">${escapeHtml(item.title)}</div>
              ${item.note ? `<div style="font-size: 0.78rem; color: #846b7d;">${escapeHtml(item.note)}</div>` : ''}
            </td>
            <td data-label="分類">${escapeHtml(item.category)}</td>
            <td data-label="付款方式"><span class="method-badge ${methodBadgeClass(item.method)}">${escapeHtml(item.method)}</span></td>
            <td data-label="金額">
              <div class="amount-editor">
                <span>${curSymbol}</span>
                <input
                  type="number"
                  inputmode="numeric"
                  min="0"
                  step="1"
                  class="amount-input ${amt === 0 ? 'unknown-zero' : ''}"
                  value="${amt}"
                  aria-label="修改 ${escapeHtml(item.title)} 金額"
                />
              </div>
            </td>
            <td data-label="折合台幣"><strong>NT$ ${fmtNum(twdVal)}</strong></td>
            <td data-label="操作">
              <button type="button" class="btn btn-danger-soft btn-sm row-delete-btn" title="刪除此筆費用">刪除</button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('tr[data-id]').forEach((row) => {
      const id = row.getAttribute('data-id');

      row.querySelector('.row-paid-toggle').addEventListener('change', (ev) => {
        const target = state.expenses.find((e) => e.id === id);
        if (!target) return;
        target.paid = ev.target.checked;
        saveExpenses();
        refreshExpenseViews();
      });

      row.querySelector('.amount-input').addEventListener('change', (ev) => {
        const target = state.expenses.find((e) => e.id === id);
        if (!target) return;
        const nextVal = Math.max(0, Number(ev.target.value) || 0);
        target.amount = nextVal;
        if (nextVal > 0 && target.isUnknown) {
          target.isUnknown = false;
          target.paid = true;
        }
        saveExpenses();
        refreshExpenseViews();
        showToast(`已更新「${target.title}」金額`);
      });

      row.querySelector('.row-delete-btn').addEventListener('click', () => {
        const target = state.expenses.find((e) => e.id === id);
        state.expenses = state.expenses.filter((e) => e.id !== id);
        saveExpenses();
        refreshExpenseViews();
        if (target) showToast(`已刪除「${target.title}」`);
      });
    });
  }

  function refreshExpenseViews() {
    renderExpenseSummary();
    renderExpenseTable();
    if (state.activeTab !== 'summary') {
      renderCurrentDay();
    }
  }

  // === Render: Prep Checklists & Dining ===
  function renderPrepSection() {
    const passBox = document.getElementById('pass-note-box');
    if (passBox) {
      passBox.innerHTML = `<strong>💡 交通票券結論：</strong>${escapeHtml(TRIP_INFO.passNote)}`;
    }

    const bookingEl = document.getElementById('booking-checklist');
    if (bookingEl) {
      bookingEl.innerHTML = BOOKING_CHECKLIST.map((b) => {
        const checked = Boolean(state.checks[b.id]);
        return `
          <label class="check-item ${checked ? 'checked' : ''}">
            <input type="checkbox" data-check-id="${escapeHtml(b.id)}" ${checked ? 'checked' : ''} />
            <div>
              <div class="check-title">[${escapeHtml(b.type)}] ${escapeHtml(b.name)}</div>
              <div class="check-sub">${escapeHtml(b.advice)}</div>
              ${
                b.url
                  ? `<div style="margin-top: 4px;"><a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">🔗 ${escapeHtml(b.actionText)} ↗</a></div>`
                  : `<div class="check-sub" style="color:#4a3544; font-weight:700;">📌 ${escapeHtml(b.actionText)}</div>`
              }
            </div>
          </label>
        `;
      }).join('');
    }

    const packingEl = document.getElementById('packing-checklist');
    if (packingEl) {
      packingEl.innerHTML = PACKING_CHECKLIST.map((p) => {
        const checked = Boolean(state.checks[p.id]);
        return `
          <label class="check-item ${checked ? 'checked' : ''}">
            <input type="checkbox" data-check-id="${escapeHtml(p.id)}" ${checked ? 'checked' : ''} />
            <div>
              <div class="check-title">${escapeHtml(p.category)}</div>
              <div class="check-sub">${escapeHtml(p.text)}</div>
            </div>
          </label>
        `;
      }).join('');
    }

    document.querySelectorAll('[data-check-id]').forEach((cb) => {
      cb.addEventListener('change', (ev) => {
        const id = cb.getAttribute('data-check-id');
        state.checks[id] = ev.target.checked;
        saveChecks();
        renderPrepSection();
      });
    });
  }

  function renderDiningSection() {
    const diningEl = document.getElementById('dining-container');
    if (!diningEl) return;

    diningEl.innerHTML = DINING_GUIDE.map(
      (d) => `
        <article class="dining-card">
          <div class="dining-top">
            <span class="dining-day">${escapeHtml(d.dayTag)}</span>
            <span class="dining-badge">${escapeHtml(d.badge)}</span>
          </div>
          <h3>${escapeHtml(d.title)}</h3>
          <ul>
            ${d.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
          </ul>
        </article>
      `
    ).join('');
  }

  // === Event Wiring ===
  function wireControls() {
    // 頁籤列點擊切換
    document.querySelectorAll('#main-tab-bar [data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-tab'), true);
      });
    });

    // 頁首與總結底部的快速切頁按鈕
    document.querySelectorAll('[data-switch-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-switch-tab'), true);
      });
    });

    // 匯率設定
    const rateInput = document.getElementById('exchange-rate');
    rateInput.value = state.exchangeRate;
    rateInput.addEventListener('input', () => {
      const val = parseFloat(rateInput.value);
      if (Number.isFinite(val) && val > 0) {
        state.exchangeRate = val;
        saveExchangeRate();
        refreshExpenseViews();
      }
    });

    // 新增費用表單
    const form = document.getElementById('add-expense-form');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const title = document.getElementById('exp-title').value.trim();
      const amount = Math.max(0, Number(document.getElementById('exp-amount').value) || 0);
      if (!title) return;

      const newItem = {
        id: `exp-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        day: document.getElementById('exp-day').value,
        title,
        category: document.getElementById('exp-category').value,
        method: document.getElementById('exp-method').value,
        currency: document.getElementById('exp-currency').value,
        amount,
        paid: document.getElementById('exp-paid').checked,
        note: document.getElementById('exp-note').value.trim(),
        isUnknown: false,
      };

      state.expenses.unshift(newItem);
      saveExpenses();
      refreshExpenseViews();

      document.getElementById('exp-title').value = '';
      document.getElementById('exp-amount').value = '';
      document.getElementById('exp-note').value = '';
      showToast(`已新增「${newItem.title}」並累積計入總額！`);
    });

    // 篩選器
    const filterMap = [
      ['filter-day', 'day'],
      ['filter-method', 'method'],
      ['filter-category', 'category'],
      ['filter-status', 'status'],
    ];
    filterMap.forEach(([elId, key]) => {
      document.getElementById(elId).addEventListener('change', (ev) => {
        state.tableFilters[key] = ev.target.value;
        renderExpenseTable();
      });
    });

    // 匯出 CSV
    document.getElementById('btn-export-csv').addEventListener('click', () => {
      const headers = ['狀態', '天數', '項目名稱', '分類', '付款方式', '幣別', '金額', '折合台幣(TWD)', '備註'];
      const rows = state.expenses.map((e) => [
        e.paid ? '已發生' : '預估中',
        e.day,
        e.title,
        e.category,
        e.method,
        e.currency,
        e.amount,
        Math.round(toTwd(e)),
        e.note || '',
      ]);

      const csvContent =
        '\uFEFF' +
        [headers, ...rows]
          .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '日本東北7天6夜_費用明細.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('已匯出 CSV 費用明細表');
    });

    // 匯出 JSON 備份（含匯率、記帳紀錄與行前打勾進度）
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        exchangeRate: state.exchangeRate,
        expenses: state.expenses,
        checks: state.checks,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '日本東北7天6夜_記帳與進度備份.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('已匯出 JSON 備份檔，可於其他裝置匯入還原！');
    });

    // 匯入 JSON 備份
    const importInput = document.getElementById('import-json-input');
    document.getElementById('btn-import-json').addEventListener('click', () => {
      importInput.value = '';
      importInput.click();
    });

    importInput.addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          if (!parsed || !Array.isArray(parsed.expenses)) {
            showToast('備份檔格式不正確，請確認為本網頁匯出的 JSON 檔');
            return;
          }
          const defaultMap = new Map(DEFAULT_EXPENSES.map((d) => [d.id, d.stopKey]));
          state.expenses = parsed.expenses.map((item) =>
            !item.stopKey && defaultMap.has(item.id)
              ? { ...item, stopKey: defaultMap.get(item.id) }
              : item
          );
          if (Number.isFinite(Number(parsed.exchangeRate)) && Number(parsed.exchangeRate) > 0) {
            state.exchangeRate = Number(parsed.exchangeRate);
            document.getElementById('exchange-rate').value = state.exchangeRate;
            saveExchangeRate();
          }
          if (parsed.checks && typeof parsed.checks === 'object') {
            state.checks = parsed.checks;
            saveChecks();
          }
          saveExpenses();
          renderPrepSection();
          refreshExpenseViews();
          showToast(`已成功匯入 ${state.expenses.length} 筆費用與進度備份！`);
        } catch {
          showToast('讀取 JSON 備份檔失敗，請重新確認檔案內容');
        }
      };
      reader.readAsText(file, 'utf-8');
    });

    // 重設預設清單
    document.getElementById('btn-reset-defaults').addEventListener('click', () => {
      if (!confirm('確定要還原為行程表原始預設的費用清單嗎？這將會覆蓋目前的自訂修改。')) return;
      state.expenses = cloneDefaults();
      saveExpenses();
      refreshExpenseViews();
      showToast('已重設為行程原始預設費用清單');
    });

    // 清空全部
    document.getElementById('btn-clear-all').addEventListener('click', () => {
      if (!confirm('確定要清空所有費用項目（重新自行記帳）嗎？')) return;
      state.expenses = [];
      saveExpenses();
      refreshExpenseViews();
      showToast('已清空所有費用紀錄');
    });
  }

  // === Initialize ===
  document.addEventListener('DOMContentLoaded', () => {
    renderHeroAndSummaryIllustrations();
    renderExpenseSummary();
    renderExpenseTable();
    renderPrepSection();
    renderDiningSection();
    wireControls();
    switchTab(state.activeTab, false);
  });
})();
