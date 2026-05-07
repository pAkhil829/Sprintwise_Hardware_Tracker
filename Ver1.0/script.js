"use strict";

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // INITIALIZATION & ROBUST DATA RECOVERY
    // ==========================================
    let appData;
    try {
        appData = JSON.parse(localStorage.getItem('webosTrackerERP'));
        if (!appData || typeof appData !== 'object' || !Array.isArray(appData.sprints)) {
            appData = { sprints: [], activeSprintId: null, inventory: [] };
        }
        if (!appData.inventory) appData.inventory = [];
        appData.sprints.forEach(s => { if (!s.items) s.items = []; });
    } catch (err) {
        appData = { sprints: [], activeSprintId: null, inventory: [] };
    }

    if (appData.activeSprintId) {
        const activeSprintExists = appData.sprints.find(s => s.id === appData.activeSprintId);
        if (!activeSprintExists) {
            appData.activeSprintId = null;
            localStorage.setItem('webosTrackerERP', JSON.stringify(appData));
        }
    }

    let isEditingItem = false;
    let isEditingSprint = false; 
    let editingItemId = null;
    let itemToReturnId = null;
    
    // FIX: Auto-Sprint Termination
    function checkAutoSprintEnd() {
        if (!appData.activeSprintId) return;
        const active = appData.sprints.find(s => s.id === appData.activeSprintId);
        const today = new Date().toISOString().split('T')[0];
        
        if (active && active.endDate && today > active.endDate) {
            if (confirm(`Sprint "${active.name}" expired on ${active.endDate}. Archive it automatically?`)) {
                active.status = 'completed';
                appData.activeSprintId = null;
                localStorage.setItem('webosTrackerERP', JSON.stringify(appData));
                renderApp();
                // If you have a switchTab function for history, you can call it here.
            }
        }
    }

    // Filtering States
    let activeFilter = 'All';      // Bottom Board Type
    let topFilterStatus = 'All';   // Top Stats Toggle ('All', 'borrowed', 'returned')
    
    let pendingItemData = null; 
    let modalTargetSprintId = null; 

    const FIXED_REGIONS = ['EU', 'KR', 'US', 'AJ', 'JA', 'CN', 'JP', 'TW', 'PH', 'BR'];

    // ==========================================
    // SAFE DOM CACHING & BINDING WRAPPER
    // ==========================================
    function addEvent(id, eventType, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(eventType, callback);
    }

    const themeToggleBtn = document.getElementById('theme-toggle');
    const newSprintTrigger = document.getElementById('new-sprint-trigger');
    const addItemTrigger = document.getElementById('add-item-trigger');
    
    // Modals
    const sprintModal = document.getElementById('sprint-modal');
    const itemModal = document.getElementById('item-modal');
    const returnModal = document.getElementById('return-modal');
    const inventoryModal = document.getElementById('inventory-modal');
    const manageSnModal = document.getElementById('manage-sn-modal');
    const exportModal = document.getElementById('export-modal');
    const sharedDetailsModal = document.getElementById('shared-details-modal');
    const searchModal = document.getElementById('search-modal');
    const collisionModal = document.getElementById('sn-collision-modal');
    const missingInvModal = document.getElementById('missing-inv-modal'); 
    
    // Dynamic Containers
    const currentList = document.getElementById('current-list');
    const dynamicInventoryContainer = document.getElementById('dynamic-inventory-container');
    const historyList = document.getElementById('history-list');
    const backlogList = document.getElementById('backlog-list');
    const backlogTableContainer = document.getElementById('backlog-table-container');
    const backlogEmptyState = document.getElementById('backlog-empty-state');
    const dynamicFilterBar = document.getElementById('dynamic-filter-bar');

    // Inputs
    const qtyInput = document.getElementById('item-quantity');
    const boardInputsContainer = document.getElementById('dynamic-board-inputs');
    const globalSearchInput = document.getElementById('global-sn-search');
    const historySelect = document.getElementById('history-select');

    const itemCategorySelect = document.getElementById('item-category');
    const globalHealthGroup = document.getElementById('global-health-group');
    const boardFieldsContainer = document.getElementById('board-fields-container');
    const itemInfoLabel = document.getElementById('item-info-label');
    const regionSelect = document.getElementById('item-region');
    const regionOtherGroup = document.getElementById('region-other-group');

    // Utility: Modals Animations
    function openModal(modalEl) { if(modalEl) modalEl.classList.add('show'); }
    function closeModal(modalEl) { if(modalEl) modalEl.classList.remove('show'); }

    // ==========================================
    // THEME LOGIC
    // ==========================================
    let isDarkTheme = localStorage.getItem('webosThemeERP') === 'dark';
    const sunIcon = `<svg viewBox="0 0 24 24"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18.75a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM6.166 18.894a.75.75 0 01-1.06-1.06l1.59-1.591a.75.75 0 111.061 1.06l-1.59 1.591zM2.25 12a.75.75 0 01.75-.75H5.25a.75.75 0 010 1.5H3a.75.75 0 01-.75-.75zM5.106 6.166a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591z"></path></svg>`;
    const moonIcon = `<svg viewBox="0 0 24 24"><path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"></path></svg>`;

    function applyTheme() {
        if (isDarkTheme) {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeToggleBtn) themeToggleBtn.innerHTML = sunIcon;
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (themeToggleBtn) themeToggleBtn.innerHTML = moonIcon;
        }
    }
    
    addEvent('theme-toggle', 'click', () => {
        isDarkTheme = !isDarkTheme;
        localStorage.setItem('webosThemeERP', isDarkTheme ? 'dark' : 'light');
        applyTheme();
    });
    applyTheme();

    // ==========================================
    // UTILS & TABBING
    // ==========================================
    function getDueClass(returnDateStr) {
        if (!returnDateStr) return 'due-future';
        const today = new Date().toISOString().split('T')[0];
        if (returnDateStr > today) return 'due-future';
        if (returnDateStr === today) return 'due-today';
        return 'due-past';
    }

    function renderItemRegionDropdown() {
        if (!regionSelect) return;
        regionSelect.innerHTML = '';
        FIXED_REGIONS.forEach(reg => { regionSelect.innerHTML += `<option value="${reg}">${reg}</option>`; });
        regionSelect.innerHTML += `<option value="Other">Other</option>`;
    }

    if (regionSelect) {
        regionSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Other') regionOtherGroup.style.display = 'block';
            else { regionOtherGroup.style.display = 'none'; document.getElementById('item-region-other').value = ''; }
        });
    }

    if (itemCategorySelect) {
        itemCategorySelect.addEventListener('change', (e) => {
            if (e.target.value === 'Board') {
                boardFieldsContainer.style.display = 'block';
                globalHealthGroup.style.display = 'none'; 
                itemInfoLabel.innerText = "Hardware Details (Optional)";
            } else {
                boardFieldsContainer.style.display = 'none';
                globalHealthGroup.style.display = 'block'; 
                itemInfoLabel.innerText = "Item Name / Specs (Required)";
            }
        });
    }

    function renderBoardInputs(qty, existingBoards = []) {
        if (!boardInputsContainer) return;
        boardInputsContainer.innerHTML = '';
        for (let i = 0; i < qty; i++) {
            let b = existingBoards[i] || { sn: '', condition: 'Working' };
            if (typeof b === 'string') b = { sn: b, condition: 'Working' }; 

            boardInputsContainer.innerHTML += `
                <div class="board-input-row" style="display:flex; gap:10px; margin-bottom:8px; align-items:center;">
                    <input type="text" class="glossy-input board-num-input" placeholder="Board #${i + 1} S/N" value="${b.sn}" style="flex-grow: 1;">
                    <select class="glossy-input board-condition-select" style="width: 140px; flex-shrink: 0;">
                        <option value="Working" ${b.condition === 'Working' ? 'selected' : ''}>Working</option>
                        <option value="Not Working" ${b.condition === 'Not Working' ? 'selected' : ''}>Not Working</option>
                    </select>
                </div>
            `;
        }
    }
    
    if (qtyInput) {
        qtyInput.addEventListener('input', (e) => {
            let qty = parseInt(e.target.value) || 1;
            if (qty < 1) { qty = 1; e.target.value = 1; }
            
            const currentRows = boardInputsContainer.querySelectorAll('.board-input-row');
            let currentBoards = [];
            currentRows.forEach(row => {
                currentBoards.push({ sn: row.querySelector('.board-num-input').value, condition: row.querySelector('.board-condition-select').value });
            });
            renderBoardInputs(qty, currentBoards);
        });
    }

    function switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        const targetSection = document.getElementById(`tab-${tabId}`);
        if(targetSection) targetSection.style.display = 'block';
        
        const activeBtn = document.getElementById(`tab-btn-${tabId}`);
        if(activeBtn) activeBtn.classList.add('active');
        
        if (tabId === 'history') loadHistoryDropdown();
        if (tabId === 'backlog') renderBacklog();
    }
    addEvent('tab-btn-current', 'click', () => switchTab('current'));
    addEvent('tab-btn-inventory', 'click', () => switchTab('inventory'));
    addEvent('tab-btn-history', 'click', () => switchTab('history'));
    addEvent('tab-btn-backlog', 'click', () => switchTab('backlog'));

    // ==========================================
    // GLOBAL KEYDOWN EVENT (ESC + ENTER)
    // ==========================================
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.show').forEach(modal => closeModal(modal));
            return;
        }

        if (e.key === 'Enter') {
            if (itemModal && itemModal.classList.contains('show')) { e.preventDefault(); document.getElementById('add-item-btn').click(); }
            else if (sprintModal && sprintModal.classList.contains('show')) { e.preventDefault(); document.getElementById('save-sprint-btn').click(); }
            else if (inventoryModal && inventoryModal.classList.contains('show')) { e.preventDefault(); document.getElementById('save-inv-btn').click(); }
            else if (returnModal && returnModal.classList.contains('show')) { e.preventDefault(); document.getElementById('confirm-return-btn').click(); }
            else if (manageSnModal && manageSnModal.classList.contains('show')) {
                if (document.activeElement.id === 'new-sn-input') { e.preventDefault(); document.getElementById('add-sn-btn').click(); }
                else { e.preventDefault(); document.getElementById('close-sn-btn').click(); }
            }
            else if (exportModal && exportModal.classList.contains('show')) { e.preventDefault(); document.getElementById('confirm-export-btn').click(); }
        }
    });

    // ==========================================
    // GLOBAL S/N SEARCH
    // ==========================================
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (!query) return;
                handleSearchTrigger(query);
            }
        });
    }

    function handleSearchTrigger(sn) {
        const matchedInventories = appData.inventory.filter(i => i.serialNumbers && i.serialNumbers.includes(sn));
        
        if (matchedInventories.length > 1) {
            document.getElementById('collision-sn-display').innerText = sn;
            const optionsContainer = document.getElementById('collision-options-container');
            optionsContainer.innerHTML = '';
            matchedInventories.forEach(inv => {
                const btn = document.createElement('button');
                btn.className = 'btn-bubble btn-outline';
                btn.innerText = `Trace as: ${inv.boardName} (${inv.region})`;
                btn.onclick = () => { closeModal(collisionModal); executeSNSearch(sn, inv.boardName, inv.region); };
                optionsContainer.appendChild(btn);
            });
            openModal(collisionModal);
        } else {
            executeSNSearch(sn, null, null);
        }
    }

    function executeSNSearch(sn, specificBoardName, specificRegion) {
        const resultsEl = document.getElementById('search-results-content');
        document.getElementById('search-query-display').innerText = `S/N Trace: ${sn}`;
        resultsEl.innerHTML = '';
        let foundSomething = false;

        let invMatches = appData.inventory.filter(i => i.serialNumbers && i.serialNumbers.includes(sn));
        if (specificBoardName && specificRegion) invMatches = invMatches.filter(i => i.boardName === specificBoardName && i.region === specificRegion);

        if (invMatches.length > 0) {
            foundSomething = true;
            invMatches.forEach(inv => {
                resultsEl.innerHTML += `
                    <div style="background: rgba(14,165,233,0.1); border: 1px solid var(--accent-primary); padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                        <strong style="color: var(--accent-primary);">INVENTORY RECORD</strong><br>
                        Registered under: <strong>${inv.boardName}</strong> in Region: <strong>${inv.region}</strong>.
                    </div>
                `;
            });
        }

        if (appData.activeSprintId) {
            const activeSprint = appData.sprints.find(s => s.id === appData.activeSprintId);
            if (activeSprint) {
                let activeMatches = activeSprint.items.filter(i => {
                    if (i.boards) return i.boards.some(b => b.sn === sn);
                    return i.boardNumbers && i.boardNumbers.includes(sn);
                });
                
                if (specificBoardName) activeMatches = activeMatches.filter(i => i.type === specificBoardName && i.region === specificRegion);

                if (activeMatches.length > 0) {
                    foundSomething = true;
                    activeMatches.forEach(m => {
                        const statusText = m.status === 'borrowed' ? `<span class="badge borrowed">Currently Borrowed</span>` : `<span class="badge returned">Returned</span>`;
                        let cond = m.condition || 'Working';
                        if (m.boards) { const bMatch = m.boards.find(b => b.sn === sn); if(bMatch) cond = bMatch.condition; }
                        
                        resultsEl.innerHTML += `
                            <div style="background: rgba(245,158,11,0.1); border: 1px solid #f59e0b; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                                <strong style="color: #f59e0b;">ACTIVE SPRINT (${activeSprint.name})</strong><br>
                                Board: ${m.type} (${m.region})<br>
                                Status: ${statusText} | Condition: <span class="badge cond-${cond.replace(' ','-')}">${cond}</span><br>
                                Borrower: <strong>${m.borrowerName}</strong> (${m.teamName})<br>
                                Shared: ${m.sharedDate}
                            </div>
                        `;
                    });
                }
            }
        }

        const archivedSprints = appData.sprints.filter(s => s.id !== appData.activeSprintId);
        archivedSprints.forEach(sprint => {
            let historyMatches = sprint.items.filter(i => {
                if (i.boards) return i.boards.some(b => b.sn === sn);
                return i.boardNumbers && i.boardNumbers.includes(sn);
            });
            if (specificBoardName) historyMatches = historyMatches.filter(i => i.type === specificBoardName && i.region === specificRegion);

            if (historyMatches.length > 0) {
                foundSomething = true;
                historyMatches.forEach(m => {
                    let cond = m.condition || 'Working';
                    if (m.boards) { const bMatch = m.boards.find(b => b.sn === sn); if(bMatch) cond = bMatch.condition; }
                    resultsEl.innerHTML += `
                        <div style="background: var(--panel-border-subtle); border: 1px solid var(--panel-border); padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                            <strong style="color: var(--text-secondary);">ARCHIVED (${sprint.name})</strong><br>
                            Board: ${m.type} (${m.region})<br>
                            Borrower: <strong>${m.borrowerName}</strong> (${m.teamName})<br>
                            Status at close: ${m.status} | Final Condition: ${cond}
                        </div>
                    `;
                });
            }
        });

        if (!foundSomething) resultsEl.innerHTML = `<p style="text-align:center; color: var(--text-secondary);">No records found for S/N: ${sn}</p>`;
        openModal(searchModal);
    }

    // ==========================================
    // TOP STATS FILTERS
    // ==========================================
    addEvent('stat-card-pending', 'click', () => {
        if (topFilterStatus === 'borrowed') topFilterStatus = 'All';
        else topFilterStatus = 'borrowed';
        renderApp();
    });

    addEvent('stat-card-returned', 'click', () => {
        if (topFilterStatus === 'returned') topFilterStatus = 'All';
        else topFilterStatus = 'returned';
        renderApp();
    });

    // ==========================================
    // CORE RENDER LOGIC
    // ==========================================
    function updateDynamicFilters() {
        if (!dynamicFilterBar) return;
        const activeSprint = appData.activeSprintId ? appData.sprints.find(s => s.id === appData.activeSprintId) : null;
        let uniqueTypes = new Set();
        if (activeSprint && activeSprint.items) { activeSprint.items.forEach(i => uniqueTypes.add(i.type)); }
        
        let html = `<span style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">FILTER:</span>`;
        html += `<button class="filter-bubble ${activeFilter === 'All' ? 'active' : ''}" data-filter="All">All</button>`;
        Array.from(uniqueTypes).sort().forEach(type => {
            if(type) html += `<button class="filter-bubble ${activeFilter === type ? 'active' : ''}" data-filter="${type}">${type}</button>`;
        });
        
        dynamicFilterBar.innerHTML = html;
        document.querySelectorAll('.filter-bubble').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-bubble').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                activeFilter = e.target.dataset.filter;
                renderApp();
            });
        });
    }

    function renderApp() {
        const activeSprint = appData.activeSprintId ? appData.sprints.find(s => s.id === appData.activeSprintId) : null;
        
        const sidebarSprintInfo = document.getElementById('sidebar-sprint-info');
        const topStatsRow = document.getElementById('top-stats-row');
        const emptyState = document.getElementById('empty-state');
        const activeTable = document.getElementById('active-table-container');
        
        if (newSprintTrigger) {
            newSprintTrigger.disabled = !!appData.activeSprintId;
            newSprintTrigger.style.opacity = appData.activeSprintId ? "0.5" : "1";
            newSprintTrigger.style.cursor = appData.activeSprintId ? "not-allowed" : "pointer";
        }

        if (!activeSprint) {
            if(sidebarSprintInfo) sidebarSprintInfo.style.display = 'none';
            if(topStatsRow) topStatsRow.style.display = 'none';
            if(activeTable) activeTable.style.display = 'none';
            if(emptyState) emptyState.style.display = 'block';
            if(addItemTrigger) addItemTrigger.style.display = 'none';
        } else {
            if(sidebarSprintInfo) sidebarSprintInfo.style.display = 'flex';
            if(topStatsRow) topStatsRow.style.display = 'grid';
            if(emptyState) emptyState.style.display = 'none';
            if(activeTable) activeTable.style.display = 'block';
            if(addItemTrigger) addItemTrigger.style.display = 'flex';
            
            document.getElementById('sidebar-sprint-name').innerText = activeSprint.name;
            document.getElementById('sidebar-sprint-dates').innerText = `${activeSprint.startDate} to ${activeSprint.endDate}`;

            const items = activeSprint.items || [];
            const totalItems = items.length;
            const returnedItems = items.filter(i => i.status === 'returned').length;
            const pendingReturns = totalItems - returnedItems;
            
            // Update Top Stat Styles
            const statCardPending = document.getElementById('stat-card-pending');
            const statCardReturned = document.getElementById('stat-card-returned');
            if(statCardPending) statCardPending.classList.toggle('active-filter', topFilterStatus === 'borrowed');
            if(statCardReturned) statCardReturned.classList.toggle('active-filter', topFilterStatus === 'returned');

            document.getElementById('big-stat-total').innerText = totalItems;
            document.getElementById('stat-not-returned').innerText = pendingReturns;
            document.getElementById('stat-returned').innerText = returnedItems;

            updateDynamicFilters();
            currentList.innerHTML = '';
            
            let displayItems = items;
            
            // 1. Top Stats Filter
            if (topFilterStatus === 'borrowed') {
                displayItems = displayItems.filter(i => i.status === 'borrowed');
            } else if (topFilterStatus === 'returned') {
                displayItems = displayItems.filter(i => i.status === 'returned');
            }

            // 2. Right Board Type Filter
            if (activeFilter !== 'All') {
                displayItems = displayItems.filter(i => i.type === activeFilter);
            }
            
            // Render Table (Strict Date Sort - Newest Shared First)
            displayItems.sort((a, b) => new Date(b.sharedDate) - new Date(a.sharedDate)).forEach((item, index) => {
                const tr = document.createElement('tr');
                const dueClass = getDueClass(item.returnDate);
                
                let statusHtml = item.status === 'borrowed' 
                    ? `<span class="badge ${dueClass}">Due: ${item.returnDate}</span>`
                    : `<span class="badge returned">Returned: ${item.actualReturnDate}</span>`;

                let boardsHtml = '-';
                if (item.boards && item.boards.length > 0) {
                    boardsHtml = item.boards.map(b => `<div style="margin-bottom: 4px; display:flex; align-items:center; gap:5px;"><span class="board-badge">${b.sn || 'No S/N'}</span> <span class="badge cond-${b.condition.replace(' ','-')}" style="padding: 2px 6px; font-size:10px;">${b.condition}</span></div>`).join('');
                } else if (item.boardNumbers && item.boardNumbers.length > 0) {
                    boardsHtml = item.boardNumbers.map(sn => `<div style="margin-bottom: 4px;"><span class="board-badge">${sn}</span> <span class="badge cond-${(item.condition||'Working').replace(' ','-')}" style="padding: 2px 6px; font-size:10px;">${item.condition||'Working'}</span></div>`).join('');
                } else {
                    boardsHtml = `<span class="badge cond-${(item.condition||'Working').replace(' ','-')}">${item.condition||'Working'}</span>`;
                }

                let actionsHtml = `<div style="display:flex; gap:6px; align-items:center;">`;
                actionsHtml += `<button class="btn-icon-only action-edit" data-id="${item.id}" data-sprint="${activeSprint.id}" title="Edit Item">✏️</button>`;
                if (item.status === 'borrowed') actionsHtml += `<button class="btn-action action-return" data-id="${item.id}" data-sprint="${activeSprint.id}">Return</button>`;
                else actionsHtml += `<button class="btn-action btn-warning action-undo-return" data-id="${item.id}" data-sprint="${activeSprint.id}" title="Undo Return">Undo</button>`;
                actionsHtml += `<button class="btn-icon-only btn-icon-danger action-delete" data-id="${item.id}" data-sprint="${activeSprint.id}" title="Delete Item">🗑️</button>`;
                actionsHtml += `</div>`;

                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>
                        <strong style="color:var(--accent-primary); font-size:14px;">${item.type}</strong><br>
                        <small class="text-muted">${item.region ? item.region + ' | ' : ''}Qty: ${item.quantity || 1}</small><br>
                        <small class="text-muted">${item.itemInfo || ''}</small>
                    </td>
                    <td>${boardsHtml}</td>
                    <td>
                        <strong>${item.borrowerName}</strong><br>
                        <small class="text-muted">${item.teamName}</small>
                    </td>
                    <td><span class="badge" style="background: var(--panel-border-subtle); color: var(--text-primary); border: 1px solid var(--panel-border);">${item.sharedDate || '-'}</span></td>
                    <td>${statusHtml}</td>
                    <td><span style="font-size: 12px; color: var(--text-secondary);">${item.remarks || '-'}</span></td>
                    <td>${actionsHtml}</td>
                `;
                currentList.appendChild(tr);
            });
        }

        // Render Inventory Stock logic (7 columns)
        dynamicInventoryContainer.innerHTML = '';
        const uniqueBoards = [...new Set(appData.inventory.map(i => i.boardName))].sort();

        uniqueBoards.forEach(bName => {
            const activeRegions = appData.inventory.filter(i => i.boardName === bName && i.totalCount > 0);
            if (activeRegions.length === 0) return;

            let sumTotal = 0, sumShared = 0, sumAvail = 0;
            let tableHtml = `
            <div class="inventory-section">
                <h3 class="inventory-table-title"><span class="type-badge">${bName}</span> Stock Configuration</h3>
                <div class="table-responsive">
                    <table class="bubbly-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;">SNO</th>
                                <th>Region</th>
                                <th>Total Owned</th>
                                <th>Shared (Active)</th>
                                <th>Available Stock</th>
                                <th>S/N Details</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>`;

            let sNo = 1;
            const renderRow = (invRecord) => {
                let sharedCount = 0;
                appData.sprints.forEach(sprint => {
                    const matches = (sprint.items || []).filter(i => i.type === bName && i.region === invRecord.region && i.status === 'borrowed');
                    sharedCount += matches.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
                });
                
                const availableCount = parseInt(invRecord.totalCount) - sharedCount;
                sumTotal += parseInt(invRecord.totalCount);
                sumShared += sharedCount;
                sumAvail += availableCount;

                tableHtml += `
                    <tr>
                        <td>${sNo++}</td>
                        <td><strong>${invRecord.region}</strong></td>
                        <td><span class="badge returned action-manage-sn" data-id="${invRecord.id}" title="Click to Manage S/Ns" style="cursor:pointer; font-size:14px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">${invRecord.totalCount}</span></td>
                        <td><span class="badge borrowed action-view-shared" data-board="${bName}" data-region="${invRecord.region}" title="Click for details">${sharedCount}</span></td>
                        <td><span class="badge returned">${availableCount}</span></td>
                        <td><button class="btn-action action-manage-sn" data-id="${invRecord.id}">Manage S/Ns</button></td>
                        <td>
                            <button class="icon-btn-small action-edit-inv" data-id="${invRecord.id}" title="Edit Stock">✏️</button>
                            <button class="icon-btn-small action-del-inv" data-id="${invRecord.id}" style="color: #ef4444;" title="Delete">🗑️</button>
                        </td>
                    </tr>
                `;
            };

            FIXED_REGIONS.forEach(reg => {
                const invRecord = activeRegions.find(i => i.region === reg || i.region === `Other(${reg})`);
                if (invRecord) renderRow(invRecord);
            });

            activeRegions.filter(i => i.region.startsWith('Other(') || i.region === 'Other').forEach(invRecord => {
                if(!tableHtml.includes(`>${invRecord.region}<`)) renderRow(invRecord);
            });

            tableHtml += `
                        <tr class="total-row">
                            <td>-</td>
                            <td>GRAND TOTAL</td>
                            <td><strong style="font-size: 16px; color: var(--accent-primary);">${sumTotal}</strong></td>
                            <td><span class="badge borrowed">${sumShared}</span></td>
                            <td><span class="badge returned">${sumAvail}</span></td>
                            <td></td>
                            <td></td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
            dynamicInventoryContainer.innerHTML += tableHtml;
        });

        localStorage.setItem('webosTrackerERP', JSON.stringify(appData));
    }

    function renderBacklog() {
        backlogList.innerHTML = '';
        let hasBacklog = false;
        const archivedSprints = appData.sprints.filter(s => s.id !== appData.activeSprintId);
        let sNo = 1;

        archivedSprints.forEach(sprint => {
            const unreturnedItems = (sprint.items || [])
                .filter(i => i.status === 'borrowed')
                .sort((a, b) => new Date(b.sharedDate) - new Date(a.sharedDate));

            if (unreturnedItems.length > 0) {
                hasBacklog = true;
                unreturnedItems.forEach(item => {
                    const dueClass = getDueClass(item.returnDate);
                    
                    let actionsHtml = `<div style="display:flex; gap:6px; align-items:center;">`;
                    actionsHtml += `<button class="btn-action action-return-backlog" data-sprint="${sprint.id}" data-item="${item.id}">Mark Returned</button>`;
                    actionsHtml += `</div>`;

                    backlogList.innerHTML += `
                        <tr>
                            <td>${sNo++}</td>
                            <td><span class="badge returned" style="background: var(--panel-border-subtle); color: var(--text-primary); border: 1px solid var(--panel-border);">${sprint.name}</span></td>
                            <td>
                                <strong style="color:var(--accent-primary);">${item.type}</strong><br>
                                <small class="text-muted">Qty: ${item.quantity || 1}</small>
                            </td>
                            <td>
                                <strong>${item.borrowerName}</strong><br>
                                <small>${item.teamName}</small>
                            </td>
                            <td><span class="badge" style="background: var(--panel-border-subtle); color: var(--text-primary); border: 1px solid var(--panel-border);">${item.sharedDate || '-'}</span></td>
                            <td><span class="badge ${dueClass}">${item.returnDate}</span></td>
                            <td><span style="font-size: 12px; color: var(--text-secondary);">${item.remarks || '-'}</span></td>
                            <td>${actionsHtml}</td>
                        </tr>
                    `;
                });
            }
        });
        backlogEmptyState.style.display = hasBacklog ? 'none' : 'block';
        backlogTableContainer.style.display = hasBacklog ? 'block' : 'none';
    }

    function loadHistoryDropdown() {
        if(!historySelect) return;
        historySelect.innerHTML = '<option value="">-- Select Past Archive --</option>';
        appData.sprints.filter(s => s.id !== appData.activeSprintId).forEach(s => {
            historySelect.innerHTML += `<option value="${s.id}">${s.name} (${s.startDate} to ${s.endDate})</option>`;
        });
    }

    if (historySelect) {
        historySelect.addEventListener('change', (e) => {
            const id = parseInt(e.target.value);
            const container = document.getElementById('history-table-container');
            const addArchiveBtn = document.getElementById('add-archive-item-btn');
            
            if(!id) {
                if(container) container.style.display = 'none';
                if(addArchiveBtn) addArchiveBtn.style.display = 'none';
                return;
            }
            
            if(container) container.style.display = 'block';
            if(addArchiveBtn) addArchiveBtn.style.display = 'inline-block';
            
            const sprint = appData.sprints.find(s => s.id === id);
            historyList.innerHTML = '';

            if(sprint && sprint.items) {
                const sortedHistory = [...sprint.items].sort((a, b) => new Date(b.sharedDate) - new Date(a.sharedDate));

                sortedHistory.forEach((item, index) => {
                    const status = item.status === 'borrowed' ? `⚠️ Due: ${item.returnDate}` : `✅ Returned: ${item.actualReturnDate}`;
                    
                    let boardsHtml = '-';
                    if (item.boards && item.boards.length > 0) {
                        boardsHtml = item.boards.map(b => `<div style="margin-bottom: 4px; display:flex; align-items:center; gap:5px;"><span class="board-badge">${b.sn || 'No S/N'}</span> <span class="badge cond-${b.condition.replace(' ','-')}" style="padding: 2px 6px; font-size:10px;">${b.condition}</span></div>`).join('');
                    } else if (item.boardNumbers && item.boardNumbers.length > 0) {
                        boardsHtml = item.boardNumbers.map(sn => `<div style="margin-bottom: 4px;"><span class="board-badge">${sn}</span> <span class="badge cond-${(item.condition||'Working').replace(' ','-')}" style="padding: 2px 6px; font-size:10px;">${item.condition||'Working'}</span></div>`).join('');
                    } else {
                        boardsHtml = `<span class="badge cond-${(item.condition||'Working').replace(' ','-')}">${item.condition||'Working'}</span>`;
                    }

                    let actionsHtml = `<div style="display:flex; gap:6px; align-items:center;">`;
                    actionsHtml += `<button class="btn-icon-only action-edit" data-id="${item.id}" data-sprint="${sprint.id}" title="Edit Item">✏️</button>`;
                    actionsHtml += `<button class="btn-icon-only btn-icon-danger action-delete" data-id="${item.id}" data-sprint="${sprint.id}" title="Delete Item">🗑️</button>`;
                    actionsHtml += `</div>`;

                    historyList.innerHTML += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>
                                <strong style="color:var(--accent-primary); font-size:14px;">${item.type}</strong><br>
                                <small class="text-muted">${item.region ? item.region + ' | ' : ''}Qty: ${item.quantity || 1}</small><br>
                                <small class="text-muted">${item.itemInfo || ''}</small>
                            </td>
                            <td>${boardsHtml}</td>
                            <td>
                                <strong>${item.borrowerName}</strong><br>
                                <small class="text-muted">${item.teamName}</small>
                            </td>
                            <td><span class="badge" style="background: var(--panel-border-subtle); color: var(--text-primary); border: 1px solid var(--panel-border);">${item.sharedDate || '-'}</span></td>
                            <td>${status}</td>
                            <td><span style="font-size: 12px; color: var(--text-secondary);">${item.remarks || '-'}</span></td>
                            <td>${actionsHtml}</td>
                        </tr>
                    `;
                });
            }
        });
    }

    // ==========================================
    // ACTION DELEGATOR (SAFE ERROR HANDLING)
    // ==========================================
    document.addEventListener('click', (e) => {
        try {
            const editBtn = e.target.closest('.action-edit');
            const returnBtn = e.target.closest('.action-return');
            const undoReturnBtn = e.target.closest('.action-undo-return');
            const deleteBtn = e.target.closest('.action-delete');
            const editInvBtn = e.target.closest('.action-edit-inv');
            const delInvBtn = e.target.closest('.action-del-inv');
            const manageSnBtn = e.target.closest('.action-manage-sn');
            const viewSharedBtn = e.target.closest('.action-view-shared');
            const returnBacklogBtn = e.target.closest('.action-return-backlog');

            if (editBtn) openItemModal(true, parseInt(editBtn.dataset.id), parseInt(editBtn.dataset.sprint));
            if (returnBtn) openReturnModal(parseInt(returnBtn.dataset.sprint), parseInt(returnBtn.dataset.id));
            if (returnBacklogBtn) openReturnModal(parseInt(returnBacklogBtn.dataset.sprint), parseInt(returnBacklogBtn.dataset.item));

            if (undoReturnBtn) {
                const sprint = appData.sprints.find(s => s.id === parseInt(undoReturnBtn.dataset.sprint));
                if (sprint) {
                    const item = sprint.items.find(i => i.id === parseInt(undoReturnBtn.dataset.id));
                    if (item) { item.status = 'borrowed'; item.actualReturnDate = null; renderApp(); }
                }
            }

            if (deleteBtn) {
                if (confirm("Permanently delete this resource log?")) {
                    const sprint = appData.sprints.find(s => s.id === parseInt(deleteBtn.dataset.sprint));
                    if (sprint) { sprint.items = sprint.items.filter(i => i.id !== parseInt(deleteBtn.dataset.id)); renderApp(); }
                }
            }

            if (editInvBtn) {
                const invRecord = appData.inventory.find(i => i.id === parseFloat(editInvBtn.dataset.id));
                if (invRecord) {
                    document.getElementById('inv-board-name').value = invRecord.boardName;
                    renderInventoryInputs();
                    const safeRegId = `inv-reg-${invRecord.region.replace(/[\(\)]/g, '')}`;
                    if (document.getElementById(safeRegId)) document.getElementById(safeRegId).value = invRecord.totalCount;
                    document.getElementById('inventory-modal-title').innerText = "Edit Stock";
                    document.getElementById('save-inv-btn').dataset.editId = invRecord.id;
                    openModal(inventoryModal);
                }
            }

            if (delInvBtn) {
                if (confirm("Delete this inventory stock record permanently?")) {
                    appData.inventory = appData.inventory.filter(i => i.id !== parseFloat(delInvBtn.dataset.id));
                    renderApp();
                }
            }

            if (manageSnBtn) openManageSnModal(parseFloat(manageSnBtn.dataset.id)); 
            
            if (viewSharedBtn) {
                const bName = viewSharedBtn.dataset.board;
                const reg = viewSharedBtn.dataset.region;
                document.getElementById('shared-details-title').innerText = `${bName} (${reg}) - Active Borrows`;
                const listEl = document.getElementById('shared-details-list');
                listEl.innerHTML = '';
                let matchedAll = [];
                
                appData.sprints.forEach(sprint => {
                    const m = (sprint.items || []).filter(i => i.type === bName && i.region === reg && i.status === 'borrowed');
                    matchedAll = matchedAll.concat(m);
                });

                if (matchedAll.length === 0) listEl.innerHTML = `<tr><td colspan="5" style="text-align:center;">No active boards shared.</td></tr>`;
                else {
                    matchedAll.forEach((m, idx) => {
                        const dueClass = getDueClass(m.returnDate);
                        listEl.innerHTML += `<tr><td>${idx + 1}</td><td><strong>${m.borrowerName}</strong></td><td>${m.teamName}</td><td>${m.quantity || 1}</td><td><span class="badge ${dueClass}">${m.returnDate}</span></td></tr>`;
                    });
                }
                openModal(sharedDetailsModal);
            }

            if(e.target.closest('.action-remove-sn')) {
                const btn = e.target.closest('.action-remove-sn');
                const invRecord = appData.inventory.find(i => i.id === parseFloat(btn.dataset.invId));
                if(invRecord) { invRecord.serialNumbers = invRecord.serialNumbers.filter(sn => sn !== btn.dataset.sn); renderApp(); openManageSnModal(invRecord.id); }
            }
        } catch (err) {
            console.error("Action error prevented crash:", err);
        }
    });

    // ==========================================
    // EXPLICIT MODAL CLOSE BINDINGS
    // ==========================================
    const closeBindings = [
        { btn: 'cancel-item-btn', modal: itemModal },
        { btn: 'cancel-sprint-btn', modal: sprintModal },
        { btn: 'cancel-inv-btn', modal: inventoryModal },
        { btn: 'cancel-return-btn', modal: returnModal },
        { btn: 'close-sn-btn', modal: manageSnModal },
        { btn: 'cancel-export-btn', modal: exportModal },
        { btn: 'close-search-btn', modal: searchModal },
        { btn: 'close-shared-btn', modal: sharedDetailsModal },
        { btn: 'close-collision-btn', modal: collisionModal },
        { btn: 'missing-inv-no', modal: missingInvModal }
    ];
    closeBindings.forEach(binding => { addEvent(binding.btn, 'click', () => closeModal(binding.modal)); });

    // ==========================================
    // SPRINT CONFIG LOGIC
    // ==========================================
    function openSprintModal(isEdit = false) {
        isEditingSprint = isEdit;
        document.getElementById('sprint-modal-title').innerText = isEdit ? "Edit Sprint Dates" : "New Sprint";
        if (isEdit && appData.activeSprintId) {
            const active = appData.sprints.find(s => s.id === appData.activeSprintId);
            document.getElementById('sprint-name').value = active.name;
            document.getElementById('sprint-start').value = active.startDate;
            document.getElementById('sprint-end').value = active.endDate;
        } else {
            document.getElementById('sprint-name').value = '';
            document.getElementById('sprint-start').value = new Date().toISOString().split('T')[0];
            document.getElementById('sprint-end').value = '';
        }
        openModal(sprintModal);
    }

    addEvent('new-sprint-trigger', 'click', () => { if (!appData.activeSprintId) openSprintModal(false); });
    addEvent('edit-sprint-trigger', 'click', () => openSprintModal(true));
    
    addEvent('end-sprint-trigger', 'click', () => {
        if(!appData.activeSprintId) return;
        if(confirm("Archive this sprint? Unreturned items will move to Backlog.")) {
            appData.sprints.find(s => s.id === appData.activeSprintId).status = 'completed';
            appData.activeSprintId = null;
            renderApp();
            loadHistoryDropdown(); 
            switchTab('history'); 
        }
    });

    addEvent('save-sprint-btn', 'click', () => {
        const name = document.getElementById('sprint-name').value.trim();
        const start = document.getElementById('sprint-start').value;
        const end = document.getElementById('sprint-end').value;
        if(!name || !start || !end) return alert("Complete all sprint details.");

        let overlapName = null;
        const isOverlap = appData.sprints.some(s => {
            if (isEditingSprint && s.id === appData.activeSprintId) return false; 
            if (start <= s.endDate && end >= s.startDate) { overlapName = s.name; return true; }
            return false;
        });

        if (isOverlap) return alert(`Error: These dates overlap with "${overlapName}". Please select a valid date range.`);

        if (isEditingSprint && appData.activeSprintId) {
            const active = appData.sprints.find(s => s.id === appData.activeSprintId);
            active.name = name; active.startDate = start; active.endDate = end;
        } else {
            const newSprint = { id: Date.now(), name, startDate: start, endDate: end, status: 'active', items: [] };
            appData.sprints.push(newSprint);
            appData.activeSprintId = newSprint.id;
        }
        closeModal(sprintModal);
        renderApp();
    });

    // ==========================================
    // LOG & EDIT RESOURCE
    // ==========================================
    addEvent('add-item-trigger', 'click', () => openItemModal(false));
    addEvent('add-archive-item-btn', 'click', () => {
        const selectedArchiveId = parseInt(historySelect.value);
        if (!selectedArchiveId) return alert("Select an archive first.");
        openItemModal(false, null, selectedArchiveId);
    });

    function openItemModal(isEdit = false, itemId = null, forcedSprintId = null) {
        isEditingItem = isEdit;
        editingItemId = itemId;
        renderItemRegionDropdown();
        
        modalTargetSprintId = forcedSprintId || appData.activeSprintId;
        if (!modalTargetSprintId) {
            return alert("No active or selected sprint available.");
        }

        const targetSprint = appData.sprints.find(s => s.id === modalTargetSprintId);
        
        document.getElementById('item-modal-title').innerText = isEdit ? "Edit Resource" : "Log Resource";
        document.getElementById('item-modal-subtitle').innerText = `Target: ${targetSprint.name}`;
        document.getElementById('add-item-btn').innerText = isEdit ? "Save Changes" : "Log Resource";

        if (isEdit && targetSprint) {
            const itemToEdit = targetSprint.items.find(i => i.id === itemId);
            if (itemToEdit) {
                if (['Board', 'K25Lpn', 'K25Lpnlm'].includes(itemToEdit.type) || itemToEdit.region) {
                    itemCategorySelect.value = "Board";
                    boardFieldsContainer.style.display = 'block';
                    globalHealthGroup.style.display = 'none';
                    document.getElementById('item-type').value = itemToEdit.type;
                    
                    if (itemToEdit.region && itemToEdit.region.startsWith('Other(')) {
                        regionSelect.value = 'Other';
                        regionOtherGroup.style.display = 'block';
                        document.getElementById('item-region-other').value = itemToEdit.region.replace('Other(', '').replace(')', '');
                    } else {
                        regionSelect.value = itemToEdit.region || 'EU';
                        regionOtherGroup.style.display = 'none';
                        document.getElementById('item-region-other').value = '';
                    }
                } else {
                    itemCategorySelect.value = itemToEdit.type || "Device"; 
                    boardFieldsContainer.style.display = 'none';
                    globalHealthGroup.style.display = 'block';
                }

                document.getElementById('item-health').value = itemToEdit.condition || 'Working';
                document.getElementById('item-quantity').value = itemToEdit.quantity || 1;
                document.getElementById('item-info').value = itemToEdit.itemInfo || '';
                
                document.getElementById('borrower-name').value = itemToEdit.borrowerName || '';
                document.getElementById('team-name').value = itemToEdit.teamName || '';
                
                document.getElementById('shared-date').value = itemToEdit.sharedDate;
                document.getElementById('return-date').value = itemToEdit.returnDate;
                document.getElementById('item-remarks').value = itemToEdit.remarks || '';
                
                let existingBoardsToRender = [];
                if (itemToEdit.boards && itemToEdit.boards.length > 0) existingBoardsToRender = itemToEdit.boards;
                else if (itemToEdit.boardNumbers) existingBoardsToRender = itemToEdit.boardNumbers.map(sn => ({ sn, condition: itemToEdit.condition || 'Working' }));
                
                renderBoardInputs(itemToEdit.quantity || 1, existingBoardsToRender);
            }
        } else {
            itemCategorySelect.value = "Board";
            boardFieldsContainer.style.display = 'block';
            globalHealthGroup.style.display = 'none';
            document.getElementById('item-health').value = 'Working';
            document.getElementById('item-type').value = '';
            document.getElementById('item-region').value = 'EU';
            regionOtherGroup.style.display = 'none';

            document.getElementById('item-quantity').value = 1;
            document.getElementById('item-info').value = '';
            document.getElementById('borrower-name').value = '';
            document.getElementById('team-name').value = '';
            document.getElementById('item-remarks').value = '';
            document.getElementById('shared-date').value = new Date().toISOString().split('T')[0];
            let tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
            document.getElementById('return-date').value = tmrw.toISOString().split('T')[0];
            renderBoardInputs(1);
        }
        openModal(itemModal);
    }

    addEvent('add-item-btn', 'click', () => {
        const category = itemCategorySelect.value;
        const globalCond = document.getElementById('item-health').value;
        const qty = parseInt(document.getElementById('item-quantity').value) || 1;
        const info = document.getElementById('item-info').value.trim();
        const borrowerName = document.getElementById('borrower-name').value.trim();
        const teamName = document.getElementById('team-name').value.trim();
        const remarks = document.getElementById('item-remarks').value.trim();
        
        let type, region, boards = [], condition = globalCond;

        if (category === 'Board') {
            type = document.getElementById('item-type').value.trim();
            region = document.getElementById('item-region').value;
            if (region === 'Other') {
                const otherVal = document.getElementById('item-region-other').value.trim();
                if (!otherVal) return alert("Please specify the custom region.");
                region = `Other(${otherVal})`;
            }
            
            const boardRows = document.querySelectorAll('.board-input-row');
            boardRows.forEach(row => {
                const sn = row.querySelector('.board-num-input').value.trim();
                const bCond = row.querySelector('.board-condition-select').value;
                if(sn || bCond) boards.push({ sn, condition: bCond });
            });
            if(!type) return alert("Board Name is required.");
        } else {
            type = category; region = null; boards = [];
            if(!info) return alert("Item Name / Specs is required for this category.");
        }
        
        if(!borrowerName || !teamName) return alert("Borrower and Team are required.");

        pendingItemData = { type, region, qty, info, borrowerName, teamName, boards, condition, remarks };

        if (category === 'Board' && !isEditingItem) {
            const existsInInv = appData.inventory.find(i => i.boardName === type && i.region === region && i.totalCount > 0);
            if (!existsInInv) {
                document.getElementById('missing-inv-msg').innerHTML = `You do not have any <strong>${type}</strong> boards registered in <strong>${region}</strong>.`;
                closeModal(itemModal);
                openModal(missingInvModal);
                return; 
            }
        }
        finalizeItemSave();
    });

    addEvent('missing-inv-yes', 'click', () => {
        const typedSns = pendingItemData.boards.map(b => b.sn.trim()).filter(sn => sn !== '');
        appData.inventory.push({ 
            id: Date.now() + Math.random(), 
            boardName: pendingItemData.type, 
            region: pendingItemData.region, 
            totalCount: pendingItemData.qty, 
            serialNumbers: typedSns 
        });
        finalizeItemSave();
    });

    addEvent('missing-inv-no', 'click', () => {
        finalizeItemSave();
    });

    function finalizeItemSave() {
        const targetSprint = appData.sprints.find(s => s.id === modalTargetSprintId);
        if(targetSprint) {
            
            if (pendingItemData.type && pendingItemData.region) {
                const invRecord = appData.inventory.find(i => i.boardName === pendingItemData.type && i.region === pendingItemData.region);
                if (invRecord) {
                    if (!invRecord.serialNumbers) invRecord.serialNumbers = [];
                    pendingItemData.boards.forEach(b => {
                        const sn = b.sn.trim();
                        if (sn && !invRecord.serialNumbers.includes(sn)) {
                            invRecord.serialNumbers.push(sn);
                        }
                    });
                    if (invRecord.serialNumbers.length > invRecord.totalCount) {
                        invRecord.totalCount = invRecord.serialNumbers.length;
                    }
                }
            }

            if (isEditingItem && editingItemId) {
                const item = targetSprint.items.find(i => i.id === editingItemId);
                if (item) {
                    item.type = pendingItemData.type; 
                    item.region = pendingItemData.region; 
                    item.quantity = pendingItemData.qty; 
                    item.itemInfo = pendingItemData.info;
                    item.boards = pendingItemData.boards;
                    item.boardNumbers = pendingItemData.boards.map(b => b.sn); 
                    item.borrowerName = pendingItemData.borrowerName; 
                    item.teamName = pendingItemData.teamName;
                    item.sharedDate = document.getElementById('shared-date').value;
                    item.returnDate = document.getElementById('return-date').value;
                    item.condition = pendingItemData.condition;
                    item.remarks = pendingItemData.remarks;
                }
            } else {
                targetSprint.items.push({
                    id: Date.now(), type: pendingItemData.type, region: pendingItemData.region, quantity: pendingItemData.qty, 
                    itemInfo: pendingItemData.info, boards: pendingItemData.boards, boardNumbers: pendingItemData.boards.map(b=>b.sn),
                    borrowerName: pendingItemData.borrowerName, teamName: pendingItemData.teamName,
                    sharedDate: document.getElementById('shared-date').value, returnDate: document.getElementById('return-date').value,
                    status: 'borrowed', condition: pendingItemData.condition, remarks: pendingItemData.remarks, actualReturnDate: null
                });
            }
        }
        closeModal(itemModal);
        closeModal(missingInvModal);
        pendingItemData = null;
        renderApp();
    }

    // ==========================================
    // RETURN RESOURCE
    // ==========================================
    function openReturnModal(sprintId, itemId) {
        itemToReturnId = itemId;
        returnModal.dataset.sprintId = sprintId;
        document.getElementById('actual-return-date').value = new Date().toISOString().split('T')[0];
        
        const sprint = appData.sprints.find(s => s.id === sprintId);
        const item = sprint ? sprint.items.find(i => i.id === itemId) : null;
        
        const returnBoardsContainer = document.getElementById('return-boards-container');
        returnBoardsContainer.innerHTML = '';
        
        if (item && item.boards && item.boards.length > 0) {
            returnBoardsContainer.innerHTML = '<label>Update Condition for Each Board</label>';
            item.boards.forEach((b, idx) => {
                returnBoardsContainer.innerHTML += `
                    <div class="return-board-row" data-idx="${idx}" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:10px; background:rgba(0,0,0,0.02); border-radius:10px;">
                        <span style="font-weight:600; font-size:13px;">S/N: ${b.sn || 'N/A'}</span>
                        <select class="glossy-input ret-cond-select" style="width:130px; padding:8px;">
                            <option value="Working" ${b.condition === 'Working' ? 'selected' : ''}>Working</option>
                            <option value="Not Working" ${b.condition === 'Not Working' ? 'selected' : ''}>Not Working</option>
                        </select>
                    </div>
                `;
            });
        } else {
            returnBoardsContainer.innerHTML = `
                <label>Resource Condition upon Return</label>
                <select id="return-health-status" class="glossy-input">
                    <option value="Working">Working</option>
                    <option value="Not Working">Not Working</option>
                </select>
            `;
        }
        openModal(returnModal);
    }

    addEvent('confirm-return-btn', 'click', () => {
        const sprintId = parseInt(returnModal.dataset.sprintId);
        const targetSprint = appData.sprints.find(s => s.id === sprintId);

        if(targetSprint && itemToReturnId) {
            const item = targetSprint.items.find(i => i.id === itemToReturnId);
            if(item) {
                item.status = 'returned';
                item.actualReturnDate = document.getElementById('actual-return-date').value;
                
                if (item.boards && item.boards.length > 0) {
                    const rows = document.querySelectorAll('.return-board-row');
                    rows.forEach(row => {
                        const idx = parseInt(row.dataset.idx);
                        item.boards[idx].condition = row.querySelector('.ret-cond-select').value;
                    });
                } else {
                    const healthStatusSelect = document.getElementById('return-health-status');
                    if (healthStatusSelect) item.condition = healthStatusSelect.value;
                }
            }
        }
        closeModal(returnModal);
        renderApp();
    });

    // ==========================================
    // INVENTORY STOCK MANAGEMENT
    // ==========================================
    function renderInventoryInputs() {
        const container = document.getElementById('region-inputs-container');
        container.innerHTML = '';
        FIXED_REGIONS.forEach(reg => {
            container.innerHTML += `
                <div class="region-item">
                    <label>${reg}</label>
                    <input type="number" id="inv-reg-${reg.replace(/[\(\)]/g, '')}" class="glossy-input" min="0" value="0">
                </div>
            `;
        });
        container.innerHTML += `
                <div class="region-item" style="grid-column: span 3; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--panel-border-subtle);">
                    <label>Other Custom Region (e.g., IN)</label>
                    <div style="display:flex; gap: 10px;">
                        <input type="text" id="inv-region-other-name" class="glossy-input" placeholder="Region name">
                        <input type="number" id="inv-reg-other" class="glossy-input" min="0" value="0" style="max-width: 100px;">
                    </div>
                </div>
            `;
    }

    addEvent('add-inventory-trigger', 'click', () => {
        document.getElementById('inv-board-name').value = '';
        renderInventoryInputs();
        document.getElementById('save-inv-btn').dataset.editId = ""; 
        openModal(inventoryModal);
    });

    const invBoardNameInput = document.getElementById('inv-board-name');
    if (invBoardNameInput) {
        invBoardNameInput.addEventListener('input', (e) => {
            const bName = e.target.value.trim();
            FIXED_REGIONS.forEach(reg => {
                const safeRegId = `inv-reg-${reg.replace(/[\(\)]/g, '')}`;
                const input = document.getElementById(safeRegId);
                if (input) {
                    const existing = appData.inventory.find(i => i.boardName === bName && i.region === reg);
                    input.value = existing ? existing.totalCount : 0;
                }
            });
        });
    }

    addEvent('save-inv-btn', 'click', () => {
        const bName = document.getElementById('inv-board-name').value.trim();
        if(!bName) return alert("Board Name is required.");

        const editId = document.getElementById('save-inv-btn').dataset.editId;
        
        FIXED_REGIONS.forEach(reg => {
            const safeRegId = `inv-reg-${reg.replace(/[\(\)]/g, '')}`;
            const count = parseInt(document.getElementById(safeRegId).value) || 0;
            
            if (editId) {
                const inv = appData.inventory.find(i => i.id === parseFloat(editId) && i.region === reg);
                if (inv) inv.totalCount = count;
                else if (count > 0) appData.inventory.push({ id: Date.now() + Math.random(), boardName: bName, region: reg, totalCount: count, serialNumbers: [] });
            } else {
                const existingIndex = appData.inventory.findIndex(i => i.boardName === bName && i.region === reg);
                if (existingIndex > -1) appData.inventory[existingIndex].totalCount = count;
                else if (count > 0) appData.inventory.push({ id: Date.now() + Math.random(), boardName: bName, region: reg, totalCount: count, serialNumbers: [] });
            }
        });

        const otherName = document.getElementById('inv-region-other-name');
        const otherCountInput = document.getElementById('inv-reg-other');
        if (otherName && otherCountInput) {
            const oName = otherName.value.trim();
            const oCount = parseInt(otherCountInput.value) || 0;
            if (oName && oCount > 0) {
                const fName = `Other(${oName})`;
                if (editId) {
                    const inv = appData.inventory.find(i => i.id === parseFloat(editId) && i.region === fName);
                    if (inv) inv.totalCount = oCount;
                    else appData.inventory.push({ id: Date.now() + Math.random(), boardName: bName, region: fName, totalCount: oCount, serialNumbers: [] });
                } else {
                    const existingIndex = appData.inventory.findIndex(i => i.boardName === bName && i.region === fName);
                    if (existingIndex > -1) appData.inventory[existingIndex].totalCount = oCount;
                    else appData.inventory.push({ id: Date.now() + Math.random(), boardName: bName, region: fName, totalCount: oCount, serialNumbers: [] });
                }
            }
        }
        
        closeModal(inventoryModal);
        renderApp();
    });

    // ==========================================
    // MANAGE S/N IN INVENTORY
    // ==========================================
    let currentManageInvId = null;

    function openManageSnModal(invId) {
        currentManageInvId = invId;
        const invRecord = appData.inventory.find(i => i.id === invId);
        if (!invRecord) return;
        if (!invRecord.serialNumbers) invRecord.serialNumbers = [];

        document.getElementById('manage-sn-title').innerText = `Manage S/Ns: ${invRecord.boardName} (${invRecord.region})`;
        document.getElementById('manage-sn-subtitle').innerText = `Total Owned: ${invRecord.totalCount} | S/Ns Logged: ${invRecord.serialNumbers.length}`;
        document.getElementById('new-sn-input').value = '';
        
        const listEl = document.getElementById('sn-list-container');
        listEl.innerHTML = '';

        if (invRecord.serialNumbers.length === 0) listEl.innerHTML = `<tr><td colspan="3" style="text-align:center;">No S/Ns added yet.</td></tr>`;
        else {
            invRecord.serialNumbers.forEach(sn => {
                let statusHtml = `<span class="badge returned">Available</span>`;
                
                let foundMatch = null;
                appData.sprints.forEach(s => {
                    const found = (s.items || []).find(i => {
                        if (i.boards) return i.boards.some(b => b.sn === sn) && i.status === 'borrowed';
                        return i.boardNumbers && i.boardNumbers.includes(sn) && i.status === 'borrowed';
                    });
                    if (found) foundMatch = found;
                });

                if (foundMatch) statusHtml = `<span class="badge borrowed">Shared to ${foundMatch.borrowerName}</span>`;

                listEl.innerHTML += `<tr><td><strong>${sn}</strong></td><td>${statusHtml}</td><td><button class="btn-icon-only btn-icon-danger action-remove-sn" data-inv-id="${invId}" data-sn="${sn}">🗑️</button></td></tr>`;
            });
        }
        openModal(manageSnModal);
    }

    addEvent('add-sn-btn', 'click', () => {
        const inputEl = document.getElementById('new-sn-input');
        const sn = inputEl.value.trim();
        if (!sn) return;

        const invRecord = appData.inventory.find(i => i.id === currentManageInvId);
        if (invRecord) {
            if (!invRecord.serialNumbers) invRecord.serialNumbers = [];
            if (!invRecord.serialNumbers.includes(sn)) {
                if (invRecord.serialNumbers.length >= invRecord.totalCount) alert("Warning: You are adding more S/Ns than the Total Owned count.");
                invRecord.serialNumbers.push(sn);
                localStorage.setItem('webosTrackerERP', JSON.stringify(appData));
                renderApp();
                openManageSnModal(currentManageInvId);
            } else alert("This S/N already exists in this stock.");
        }
    });

    // ==========================================
    // EXPORT
    // ==========================================
    addEvent('export-btn', 'click', () => {
        if(!appData.sprints || appData.sprints.length === 0) return alert("No data available to export.");
        const exportSelect = document.getElementById('export-sprint-select');
        exportSelect.innerHTML = '<option value="all">All Sprints</option>';
        appData.sprints.forEach(s => {
            const label = s.id === appData.activeSprintId ? `${s.name} (Active)` : s.name;
            exportSelect.innerHTML += `<option value="${s.id}">${label}</option>`;
        });
        openModal(exportModal);
    });

    addEvent('confirm-export-btn', 'click', () => {
        const exportSelect = document.getElementById('export-sprint-select');
        const selectedSprintId = exportSelect.value;
        const selectedColumns = Array.from(document.querySelectorAll('.col-checkbox:checked')).map(cb => cb.value);
        if(selectedColumns.length === 0) return alert("Please select at least one column to export.");

        let itemsToExport = [];
        if (selectedSprintId === 'all') {
            appData.sprints.forEach(sprint => {
                if(sprint.items) { sprint.items.forEach((item, idx) => { itemsToExport.push({...item, sprintName: sprint.name, displayIndex: idx + 1}); }); }
            });
        } else {
            const sprint = appData.sprints.find(s => s.id === parseInt(selectedSprintId));
            if (sprint && sprint.items) itemsToExport = sprint.items.map((i, idx) => ({...i, sprintName: sprint.name, displayIndex: idx + 1}));
        }

        if(itemsToExport.length === 0) return alert("No items found to export in selected sprint.");

        const colMap = {
            sno: "SNO", sprintName: "Sprint Name", category: "Category/Board", region: "Region",
            quantity: "Quantity", boardNumbers: "Board S/N & Status", itemDetails: "Item Details", 
            borrower: "Borrower", team: "Team", sharedDate: "Shared Date", expectedReturn: "Expected Return", 
            actualReturn: "Actual Return", condition: "Condition", status: "Status", remarks: "Remarks"
        };

        let csv = selectedColumns.map(col => `"${colMap[col]}"`).join(",") + "\n";
        
        itemsToExport.forEach((row) => {
            let rowData = [];
            selectedColumns.forEach(col => {
                let val = '';
                switch(col) {
                    case 'sno': val = row.displayIndex; break;
                    case 'sprintName': val = row.sprintName; break;
                    case 'category': val = row.type || ''; break;
                    case 'region': val = row.region || ''; break;
                    case 'quantity': val = row.quantity || 1; break;
                    case 'boardNumbers': 
                        let boardSns = [];
                        if (row.boards) boardSns = row.boards.map(b => `${b.sn} (${b.condition})`);
                        else if (row.boardNumbers) boardSns = row.boardNumbers;
                        val = boardSns.join(' | '); 
                        break;
                    case 'itemDetails': val = row.itemInfo || ''; break;
                    case 'borrower': val = row.borrowerName || ''; break;
                    case 'team': val = row.teamName || ''; break;
                    case 'sharedDate': val = row.sharedDate || ''; break;
                    case 'expectedReturn': val = row.returnDate || ''; break;
                    case 'actualReturn': val = row.actualReturnDate || 'Pending'; break;
                    case 'condition': val = row.condition || 'Working'; break;
                    case 'status': val = row.status || ''; break;
                    case 'remarks': val = row.remarks || ''; break;
                }
                rowData.push(`"${String(val).replace(/"/g, '""')}"`);
            });
            csv += rowData.join(",") + "\n";
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Sprint_Export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        closeModal(exportModal);
    });

    addEvent('export-inv-btn', 'click', () => {
        if(!appData.inventory || appData.inventory.length === 0) return alert("Inventory is empty.");
        let csv = "Board Name,Region,Total Owned,Shared,Available,Registered Serial Numbers\n";
        
        appData.inventory.forEach(inv => {
            if (parseInt(inv.totalCount) === 0) return; 
            let sharedCount = 0;
            appData.sprints.forEach(sprint => {
                const matchedItems = (sprint.items || []).filter(i => i.type === inv.boardName && i.region === inv.region && i.status === 'borrowed');
                sharedCount += matchedItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
            });

            const availableCount = parseInt(inv.totalCount) - sharedCount;
            const sns = inv.serialNumbers ? inv.serialNumbers.join('; ') : '';
            csv += `"${inv.boardName}","${inv.region}",${inv.totalCount},${sharedCount},${availableCount},"${sns}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Master_Stock_Export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    });

    // Boot Up Actions
    renderItemRegionDropdown();
    loadHistoryDropdown();
    checkAutoSprintEnd();
    renderApp();
});