const BOARD_URL = './board.json';

const LS_THEME = 'hk_theme';
const LS_PROJECT = 'hk_project';

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('data-')) n.setAttribute(k, v);
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const c of children) n.appendChild(c);
  return n;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function normalize(board) {
  const projects = new Map((board.projects ?? []).map(p => [p.id, p]));
  const columns = board.columns ?? [
    { id: 'backlog', name: 'Backlog' },
    { id: 'blocked', name: 'Blocked' },
    { id: 'in_progress', name: 'In Progress' },
    { id: 'done', name: 'Done' },
  ];

  const cards = (board.cards ?? []).map(c => {
    const proj = projects.get(c.projectId);
    return {
      ...c,
      project: proj ? proj.name : c.projectId,
      projectColor: proj?.color ?? '#64748b'
    };
  });

  return { meta: board.meta ?? {}, projects: [...projects.values()], columns, cards };
}

function getProjectFromUrl(projectIds) {
  try {
    const v = new URLSearchParams(location.search).get('project');
    if (!v || v === 'all') return null;
    return projectIds.has(v) ? v : null;
  } catch {
    return null;
  }
}

function setProjectInUrl(projectId) {
  try {
    const url = new URL(location.href);
    if (!projectId) url.searchParams.delete('project');
    else url.searchParams.set('project', projectId);
    history.replaceState({}, '', url.toString());
  } catch {}
}

function getSavedProject(projectIds) {
  try {
    const v = localStorage.getItem(LS_PROJECT);
    if (!v || v === 'all') return null;
    return projectIds.has(v) ? v : null;
  } catch {
    return null;
  }
}

function saveProject(projectId) {
  try {
    if (!projectId) localStorage.removeItem(LS_PROJECT);
    else localStorage.setItem(LS_PROJECT, projectId);
  } catch {}
}

function renderLegend(projects, selectedProjectId, onSelect) {
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  for (const p of projects) {
    const sw = el('span', { class: 'legendSwatch' });
    sw.style.background = p.color;

    const btn = el('button', {
      class: `legendItem ${selectedProjectId === p.id ? 'active' : ''}`,
      type: 'button',
      title: `Filter: ${p.name}`,
      'data-project-id': p.id
    }, [
      sw,
      el('span', { text: p.name })
    ]);

    btn.addEventListener('click', () => onSelect(p.id));
    legend.appendChild(btn);
  }
}

function render(board, { selectedProjectId = null } = {}) {
  const title = document.getElementById('boardTitle');
  const updatedAt = document.getElementById('updatedAt');
  const container = document.getElementById('board');

  title.textContent = board.meta.title ?? "Static Kanban Board";
  updatedAt.textContent = `Updated: ${fmtTime(board.meta.updatedAt)}`;

  container.innerHTML = '';

  const visibleCards = selectedProjectId
    ? board.cards.filter(c => c.projectId === selectedProjectId)
    : board.cards;

  const byCol = new Map(board.columns.map(c => [c.id, []]));
  for (const card of visibleCards) {
    if (!byCol.has(card.columnId)) byCol.set(card.columnId, []);
    byCol.get(card.columnId).push(card);
  }

  const priOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  for (const arr of byCol.values()) {
    arr.sort((a,b) => {
      const pa = priOrder[a.priority ?? 'P2'] ?? 99;
      const pb = priOrder[b.priority ?? 'P2'] ?? 99;
      if (pa !== pb) return pa - pb;
      const ta = new Date(a.updatedAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? 0).getTime();
      return tb - ta;
    });
  }

  const tpl = document.getElementById('cardTpl');

  for (const col of board.columns) {
    const cards = byCol.get(col.id) ?? [];

    const colEl = el('section', { class: 'column', 'data-col': col.id });
    const header = el('div', { class: 'colHeader' }, [
      el('h2', { text: col.name }),
      el('div', { class: 'colCount', text: String(cards.length) })
    ]);
    const body = el('div', { class: 'colBody' });

    for (const c of cards) {
      const node = tpl.content.firstElementChild.cloneNode(true);

      const badge = node.querySelector('[data-role=projectBadge]');
      badge.innerHTML = '';
      const dot = el('span', { class: 'badgeDot' });
      dot.style.background = c.projectColor;
      badge.appendChild(dot);
      badge.appendChild(el('span', { text: c.project }));

      node.querySelector('[data-role=priority]').textContent = c.priority ?? 'P2';

      node.querySelector('[data-role=title]').textContent = c.title ?? '(untitled)';
      const desc = node.querySelector('[data-role=description]');
      desc.textContent = c.description ?? '';
      if (!c.description) desc.style.display = 'none';

      const tags = node.querySelector('[data-role=tags]');
      tags.innerHTML = '';
      for (const t of (c.tags ?? [])) tags.appendChild(el('span', { class: 'tag', text: t }));
      if (!(c.tags?.length)) tags.style.display = 'none';

      const links = node.querySelector('[data-role=links]');
      links.innerHTML = '';
      for (const l of (c.links ?? [])) {
        links.appendChild(el('a', { href: l.url, target: '_blank', rel: 'noreferrer', text: l.label }));
      }
      if (!(c.links?.length)) links.style.display = 'none';

      const owner = node.querySelector('[data-role=owner]');
      owner.textContent = c.owner ? `Owner: ${c.owner}` : 'Owner: —';
      const upd = node.querySelector('[data-role=updated]');
      upd.textContent = `Updated: ${fmtTime(c.updatedAt)}`;
      upd.setAttribute('datetime', c.updatedAt ?? '');

      node.style.boxShadow = '0 0 0 1px rgba(255,255,255,.06) inset';
      node.style.borderLeft = `4px solid ${c.projectColor}`;

      body.appendChild(node);
    }

    colEl.appendChild(header);
    colEl.appendChild(body);
    container.appendChild(colEl);
  }
}

async function loadBoard() {
  const res = await fetch(BOARD_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${BOARD_URL}: ${res.status}`);
  return res.json();
}

function setTheme(theme) {
  const t = (theme === 'light') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(LS_THEME, t); } catch {}
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = (t === 'light') ? 'Dark' : 'Light';
}

function initTheme() {
  let t = 'dark';
  try {
    t = localStorage.getItem(LS_THEME) || 'dark';
  } catch {}
  // If user never set it, follow OS preference.
  if (!t || (t !== 'light' && t !== 'dark')) {
    t = window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark';
  }
  setTheme(t);
}

async function boot() {
  initTheme();

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(cur === 'light' ? 'dark' : 'light');
    });
  }

  const reloadBtn = document.getElementById('reloadBtn');
  reloadBtn.addEventListener('click', () => location.reload());

  try {
    const raw = await loadBoard();
    const board = normalize(raw);

    const projectIds = new Set(board.projects.map(p => p.id));
    let selectedProjectId = getProjectFromUrl(projectIds) ?? getSavedProject(projectIds);

    const projectResetBtn = document.getElementById('projectResetBtn');
    const apply = (newProjectId) => {
      selectedProjectId = newProjectId;
      saveProject(selectedProjectId);
      setProjectInUrl(selectedProjectId);
      renderLegend(board.projects, selectedProjectId, apply);
      render(board, { selectedProjectId });
      if (projectResetBtn) projectResetBtn.disabled = !selectedProjectId;
    };

    if (projectResetBtn) projectResetBtn.addEventListener('click', () => apply(null));

    apply(selectedProjectId ?? null);

    window.addEventListener('popstate', () => {
      const fromUrl = getProjectFromUrl(projectIds);
      if (fromUrl !== selectedProjectId) apply(fromUrl);
    });
  } catch (err) {
    console.error(err);
    const container = document.getElementById('board');
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'error' }, [
      el('div', { text: 'Could not load board.json' }),
      el('div', { class: 'small', text: String(err?.message ?? err) }),
      el('div', { class: 'small', text: 'If you are opening the HTML file directly, use a local web server (or deploy to static hosting). Some browsers block fetch() from file://.' })
    ]));
  }
}

boot();
