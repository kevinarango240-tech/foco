(function () {
    'use strict';

    const STORAGE_KEY = 'foco:v1';
    const POMO_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
    const PHASE_LABELS = { idle: 'Listo', focus: 'Foco', short: 'Descanso', long: 'Pausa larga' };
    const RING_CIRCUMFERENCE = 2 * Math.PI * 54;

    const ICONS = {
        trash: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        left:  '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        right: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    /* ===== Store ===== */
    function emptyState() {
        return {
            theme: null,
            days: {},
            timer: { phase: 'idle', remainingSec: POMO_DURATIONS.focus, running: false, startedAt: null }
        };
    }

    let state = load();

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return emptyState();
            const parsed = JSON.parse(raw);
            const base = emptyState();
            return { ...base, ...parsed, timer: { ...base.timer, ...(parsed.timer || {}) } };
        } catch {
            return emptyState();
        }
    }

    let saveTimer = null;
    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
        }, 150);
    }

    function todayIso() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function getDay(dateIso) {
        if (!state.days[dateIso]) {
            state.days[dateIso] = { blocks: [], pomodoro: { cycle: 0, focusSecondsTotal: 0 } };
        }
        return state.days[dateIso];
    }

    function uid() { return Math.random().toString(36).slice(2, 10); }

    /* ===== Date routing ===== */
    let currentDate = todayIso();

    function shiftDate(days) {
        const [y, m, d] = currentDate.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + days);
        currentDate = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        render();
    }

    function isoShift(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function formatDateLabel(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        let prefix = '';
        if (iso === todayIso()) prefix = 'Hoy · ';
        else if (iso === isoShift(-1)) prefix = 'Ayer · ';
        else if (iso === isoShift(1)) prefix = 'Mañana · ';
        const formatter = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
        return prefix + formatter.format(dt);
    }

    /* ===== Rendering ===== */
    const timelineEl = document.getElementById('timeline');
    const emptyEl = document.getElementById('emptyState');
    const dateLabelEl = document.getElementById('dateLabel');
    const datePickerEl = document.getElementById('datePicker');

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function renderNode(block) {
        const isBreak = block.type === 'break';
        const classes = ['node'];
        if (isBreak) classes.push('break');
        if (!isBreak && block.done) classes.push('done');

        const body = isBreak
            ? `<div class="node-break-body">
                   <span class="node-title">${escapeHtml(block.title || 'Descanso')}</span>
                   <div class="node-duration">
                       <input type="number" class="node-duration-input" data-field="duration" value="${block.durationMin || 15}" min="1" max="240" aria-label="Duración en minutos">
                       <span class="node-duration-unit">min</span>
                   </div>
               </div>`
            : `<h3 class="node-title" data-field="title" tabindex="0">${escapeHtml(block.title)}</h3>`;

        return `
            <li class="${classes.join(' ')}" data-block="${block.id}" ${isBreak ? '' : 'data-action="toggle-done"'}>
                ${body}
                <div class="node-controls" data-no-toggle>
                    <button type="button" class="icon-btn" data-action="move-left" aria-label="Mover a la izquierda">${ICONS.left}</button>
                    <button type="button" class="icon-btn" data-action="move-right" aria-label="Mover a la derecha">${ICONS.right}</button>
                    <button type="button" class="icon-btn" data-action="del-block" aria-label="Eliminar nodo">${ICONS.trash}</button>
                </div>
            </li>
        `;
    }

    function render() {
        const day = getDay(currentDate);

        dateLabelEl.textContent = formatDateLabel(currentDate);
        datePickerEl.value = currentDate;

        timelineEl.innerHTML = day.blocks.map(renderNode).join('');
        emptyEl.hidden = day.blocks.length > 0;

        renderStats();
    }

    function renderStats() {
        const day = getDay(currentDate);
        const workBlocks = day.blocks.filter(b => b.type === 'work');
        const done = workBlocks.filter(b => b.done).length;
        const total = workBlocks.length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        const focusMin = Math.round((day.pomodoro.focusSecondsTotal || 0) / 60);

        document.getElementById('statFocus').textContent = focusMin >= 60
            ? `${Math.floor(focusMin / 60)}h ${focusMin % 60}m`
            : `${focusMin}m`;
        document.getElementById('statDone').textContent = done;
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statCycles').textContent = day.pomodoro.cycle || 0;
        document.getElementById('statPct').textContent = pct + '%';
        document.getElementById('statBar').style.width = pct + '%';
    }

    /* ===== CRUD ===== */
    function addBlock({ type, title, durationMin }) {
        const day = getDay(currentDate);
        day.blocks.push({
            id: uid(),
            title: title || (type === 'break' ? 'Descanso' : 'Nueva tarea'),
            type,
            done: false,
            durationMin: type === 'break' ? (durationMin || 15) : undefined
        });
        save();
        render();
    }

    function findBlock(id) {
        return getDay(currentDate).blocks.find(b => b.id === id);
    }

    function deleteBlock(id) {
        const day = getDay(currentDate);
        day.blocks = day.blocks.filter(b => b.id !== id);
        save();
        render();
    }

    function moveBlock(id, dir) {
        const day = getDay(currentDate);
        const i = day.blocks.findIndex(b => b.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= day.blocks.length) return;
        [day.blocks[i], day.blocks[j]] = [day.blocks[j], day.blocks[i]];
        save();
        render();
    }

    function renameBlock(id, title) {
        const b = findBlock(id);
        if (!b) return;
        const clean = title.trim();
        if (!clean) { render(); return; }
        b.title = clean;
        save();
    }

    function toggleDone(id) {
        const b = findBlock(id);
        if (!b || b.type !== 'work') return;
        b.done = !b.done;
        save();
        render();
    }

    function setBreakDuration(id, minutes) {
        const b = findBlock(id);
        if (!b || b.type !== 'break') return;
        b.durationMin = Math.max(1, Math.min(240, parseInt(minutes, 10) || 15));
        save();
    }

    /* ===== Dialog ===== */
    const dialog = document.getElementById('nodeDialog');
    const dialogForm = document.getElementById('nodeForm');

    function openDialog() {
        dialogForm.reset();
        dialogForm.dataset.type = 'work';
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        const titleInput = dialogForm.querySelector('input[name="title"]');
        setTimeout(() => titleInput && titleInput.focus(), 50);
    }

    function closeDialog() {
        if (dialog.open) dialog.close();
    }

    dialogForm.addEventListener('change', e => {
        if (e.target.name === 'type') dialogForm.dataset.type = e.target.value;
    });

    dialogForm.addEventListener('submit', e => {
        const fd = new FormData(dialogForm);
        const type = fd.get('type');
        const title = String(fd.get('title') || '').trim();
        const durationMin = parseInt(fd.get('duration'), 10) || 15;
        if (!title) { e.preventDefault(); return; }
        addBlock({ type, title, durationMin });
    });

    /* ===== Event delegation ===== */
    document.body.addEventListener('click', e => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        if (actionEl.matches('.node[data-action="toggle-done"]')) {
            if (e.target.closest('[data-no-toggle]')) return;
            if (e.target.closest('[data-field]') && e.target.closest('[data-field]').isContentEditable) return;
            toggleDone(actionEl.dataset.block);
            return;
        }

        const action = actionEl.dataset.action;
        const blockEl = actionEl.closest('[data-block]');
        const blockId = blockEl && blockEl.dataset.block;

        switch (action) {
            case 'prev-day': shiftDate(-1); break;
            case 'next-day': shiftDate(1); break;
            case 'today':
                currentDate = todayIso();
                render();
                break;
            case 'pick-date':
                if (datePickerEl.showPicker) datePickerEl.showPicker();
                else datePickerEl.focus();
                break;
            case 'toggle-theme': toggleTheme(); break;
            case 'new-node':
            case 'new-node-empty':
                openDialog();
                break;
            case 'dialog-cancel': closeDialog(); break;
            case 'del-block':       if (blockId) deleteBlock(blockId); break;
            case 'move-left':       if (blockId) moveBlock(blockId, -1); break;
            case 'move-right':      if (blockId) moveBlock(blockId, 1); break;
            case 'pomo-start':  pomoStart(); break;
            case 'pomo-pause':  pomoPause(); break;
            case 'pomo-reset':  pomoReset(); break;
            case 'toggle-dock': toggleDock(); break;
        }
    });

    datePickerEl.addEventListener('change', e => {
        if (e.target.value) {
            currentDate = e.target.value;
            render();
        }
    });

    timelineEl.addEventListener('change', e => {
        if (e.target.classList.contains('node-duration-input')) {
            const blockEl = e.target.closest('[data-block]');
            if (blockEl) setBreakDuration(blockEl.dataset.block, e.target.value);
        }
    });

    timelineEl.addEventListener('dblclick', e => {
        const field = e.target.closest('[data-field="title"]');
        if (!field) return;
        e.stopPropagation();
        field.setAttribute('contenteditable', 'true');
        field.focus();
        const sel = document.getSelection();
        if (sel) sel.selectAllChildren(field);
    });

    timelineEl.addEventListener('keydown', e => {
        const field = e.target.closest('[data-field="title"]');
        if (field && field.isContentEditable) {
            if (e.key === 'Enter') { e.preventDefault(); field.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); field.dataset.cancel = '1'; field.blur(); }
        }
    });

    timelineEl.addEventListener('focusout', e => {
        const field = e.target.closest('[data-field="title"]');
        if (!field || !field.isContentEditable) return;
        const blockEl = field.closest('[data-block]');
        const cancel = field.dataset.cancel === '1';
        field.removeAttribute('contenteditable');
        delete field.dataset.cancel;
        if (cancel) { render(); return; }
        if (blockEl) renameBlock(blockEl.dataset.block, field.textContent);
    }, true);

    /* ===== Theme ===== */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        state.theme = theme;
        save();
    }
    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme');
        applyTheme(cur === 'dark' ? 'light' : 'dark');
    }

    /* ===== Pomodoro ===== */
    const pomoEl = document.getElementById('pomodoro');
    const pomoTimeEl = document.getElementById('pomoTime');
    const pomoPhaseEl = document.getElementById('pomoPhase');
    const pomoCycleEl = document.getElementById('pomoCycle');
    const pomoStartBtn = document.getElementById('pomoStart');
    const pomoPauseBtn = document.getElementById('pomoPause');
    const ringEl = document.getElementById('ringProgress');

    let tickHandle = null;

    function phaseDuration(phase) {
        return POMO_DURATIONS[phase] || POMO_DURATIONS.focus;
    }

    function fmtTime(sec) {
        sec = Math.max(0, Math.round(sec));
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function syncRemainingFromStart() {
        const t = state.timer;
        if (!t.running || !t.startedAt) return;
        const elapsed = Math.floor((Date.now() - t.startedAt) / 1000);
        t.remainingSec = Math.max(0, phaseDuration(t.phase) - elapsed);
    }

    function pomoStart() {
        const t = state.timer;
        if (t.phase === 'idle') {
            t.phase = 'focus';
            t.remainingSec = POMO_DURATIONS.focus;
        }
        if (t.remainingSec <= 0) t.remainingSec = phaseDuration(t.phase);
        t.running = true;
        t.startedAt = Date.now() - (phaseDuration(t.phase) - t.remainingSec) * 1000;
        save();
        startTick();
        renderPomo();
    }

    function pomoPause() {
        const t = state.timer;
        syncRemainingFromStart();
        t.running = false;
        t.startedAt = null;
        save();
        stopTick();
        renderPomo();
    }

    function pomoReset() {
        state.timer = { phase: 'idle', remainingSec: POMO_DURATIONS.focus, running: false, startedAt: null };
        save();
        stopTick();
        renderPomo();
    }

    function startTick() {
        stopTick();
        tickHandle = setInterval(tick, 250);
    }
    function stopTick() {
        if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    }

    function tick() {
        const t = state.timer;
        if (!t.running) { stopTick(); return; }
        syncRemainingFromStart();
        if (t.remainingSec <= 0) finishPhase();
        renderPomo();
    }

    function finishPhase() {
        const t = state.timer;
        const day = getDay(todayIso());

        if (t.phase === 'focus') {
            day.pomodoro.focusSecondsTotal = (day.pomodoro.focusSecondsTotal || 0) + POMO_DURATIONS.focus;
            day.pomodoro.cycle = (day.pomodoro.cycle || 0) + 1;
            t.phase = (day.pomodoro.cycle % 4 === 0) ? 'long' : 'short';
        } else {
            t.phase = 'idle';
        }
        t.remainingSec = phaseDuration(t.phase);
        t.running = false;
        t.startedAt = null;
        save();
        stopTick();
        beep();
        renderStats();
    }

    function renderPomo() {
        const t = state.timer;
        const timeStr = fmtTime(t.remainingSec);
        pomoTimeEl.textContent = timeStr;
        pomoPhaseEl.textContent = PHASE_LABELS[t.phase] || 'Listo';
        pomoCycleEl.textContent = getDay(todayIso()).pomodoro.cycle || 0;
        pomoEl.setAttribute('data-phase', t.phase);
        const pomoToggleBtn = pomoEl.querySelector('.pomodoro-toggle');
        if (pomoToggleBtn) pomoToggleBtn.setAttribute('data-time', timeStr);

        const total = phaseDuration(t.phase === 'idle' ? 'focus' : t.phase);
        const ratio = t.remainingSec / total;
        ringEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));

        pomoStartBtn.hidden = t.running;
        pomoPauseBtn.hidden = !t.running;
        pomoStartBtn.textContent = (t.phase === 'idle') ? 'Start' : 'Reanudar';

        if (t.running && t.phase === 'focus') document.title = `${timeStr} · Foco`;
        else if (t.running) document.title = `${timeStr} · ${PHASE_LABELS[t.phase]}`;
        else document.title = 'Foco';
    }

    function beep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.55);
            setTimeout(() => ctx.close(), 700);
        } catch {}
    }

    function toggleDock() {
        pomoEl.classList.toggle('collapsed');
    }

    /* ===== Bootstrap ===== */
    function init() {
        const initialTheme = state.theme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        applyTheme(initialTheme);

        const t = state.timer;
        if (t.running && t.startedAt) {
            syncRemainingFromStart();
            if (t.remainingSec <= 0) finishPhase();
            else startTick();
        }

        render();
        renderPomo();
    }

    init();
})();
