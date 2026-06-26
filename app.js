const STORAGE_KEYS = {
  notebooks: "astrology-notebooks",
  selectedNotebook: "astrology-selected-notebook",
  selectedEntry: "astrology-selected-entry",
  notebookSearch: "astrology-notebook-search",
  entrySearch: "astrology-entry-search",
  people: "astrology-people",
  selectedPerson: "astrology-selected-person",
  selectedView: "astrology-selected-view",
  tagFilter: "astrology-entry-tag-filter"
};

const ENTRY_CATEGORIES = ["Natal", "Daily", "Transits", "Journal", "Research", "Other"];
const WORKSPACE_VIEWS = ["Dashboard", "Natal", "Solar Returns", "Progressions", "Transits", "Journal", "Research", "Files"];
const DEFAULT_ENTRY_CATEGORY = "Journal";

const state = {
  people: [],
  notebooks: [],
  selectedPersonId: null,
  selectedNotebookId: null,
  selectedEntryId: null,
  selectedView: "Journal"
};

let searchQuery = "";
let entrySearchQuery = "";
let entryCategoryFilter = "All";
let entryTagFilter = "All";
let editorMode = "edit";
let saveStatusTimer = null;

const elements = {
  personCount: document.querySelector("#personCount"),
  personList: document.querySelector("#personList"),
  newPersonButton: document.querySelector("#newPersonButton"),
  editPersonButton: document.querySelector("#editPersonButton"),
  deletePersonButton: document.querySelector("#deletePersonButton"),
  notebookSearch: document.querySelector("#notebookSearch"),
  notebookCount: document.querySelector("#notebookCount"),
  notebookList: document.querySelector("#notebookList"),
  newNotebookButton: document.querySelector("#newNotebookButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  exportMarkdownButton: document.querySelector("#exportMarkdownButton"),
  importFileInput: document.querySelector("#importFileInput"),
  entryNotebookName: document.querySelector("#entryNotebookName"),
  entryCount: document.querySelector("#entryCount"),
  entryCategoryFilter: document.querySelector("#entryCategoryFilter"),
  entryTagFilter: document.querySelector("#entryTagFilter"),
  entrySearch: document.querySelector("#entrySearch"),
  entrySearchCount: document.querySelector("#entrySearchCount"),
  entrySearchResults: document.querySelector("#entrySearchResults"),
  entryList: document.querySelector("#entryList"),
  newEntryButton: document.querySelector("#newEntryButton"),
  breadcrumb: document.querySelector("#breadcrumb"),
  selectedNotebookTitle: document.querySelector("#selectedNotebookTitle"),
  selectedEntryTitle: document.querySelector("#selectedEntryTitle"),
  saveStatus: document.querySelector(".save-status"),
  saveStatusText: document.querySelector("#saveStatusText"),
  editorCard: document.querySelector("#editorCard")
};

restoreState();

// State management
function createPersonRecord(name = "New Person") {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    birthDate: "",
    birthTime: "",
    birthLocation: "",
    notes: [],
    createdAt: now,
    updatedAt: now
  };
}

function createNotebookRecord(name, personId = state.selectedPersonId) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    personId,
    name,
    createdAt: now,
    updatedAt: now,
    entries: []
  };
}

function createEntryRecord(title, category = DEFAULT_ENTRY_CATEGORY) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    category: ENTRY_CATEGORIES.includes(category) ? category : DEFAULT_ENTRY_CATEGORY,
    tags: [],
    content: "",
    createdAt: now,
    updatedAt: now
  };
}

function getSelectedPerson() {
  return state.people.find((person) => person.id === state.selectedPersonId) ?? null;
}

function getSelectedNotebook() {
  return getPersonNotebooks().find((notebook) => notebook.id === state.selectedNotebookId) ?? null;
}

function getSelectedEntry() {
  const notebook = getSelectedNotebook();
  if (!notebook) return null;
  return notebook.entries.find((entry) => entry.id === state.selectedEntryId) ?? null;
}

function getPersonNotebooks() {
  if (!state.selectedPersonId) return [];
  return state.notebooks.filter((notebook) => notebook.personId === state.selectedPersonId);
}

function getPersonEntries(personId = state.selectedPersonId) {
  return state.notebooks
    .filter((notebook) => notebook.personId === personId)
    .flatMap((notebook) => notebook.entries.map((entry) => ({ notebook, entry })));
}

function getVisibleNotebooks() {
  const query = searchQuery.trim().toLowerCase();
  const notebooks = getPersonNotebooks();
  if (!query) return notebooks;
  return notebooks.filter((notebook) => notebook.name.toLowerCase().includes(query));
}

function getVisibleEntries(notebook) {
  if (!notebook) return [];
  return notebook.entries.filter((entry) => {
    const categoryMatch = entryCategoryFilter === "All" || entry.category === entryCategoryFilter;
    const tagMatch = entryTagFilter === "All" || entry.tags.includes(entryTagFilter);
    const viewMatch = ["Dashboard", "Files"].includes(state.selectedView) || entry.category === state.selectedView || state.selectedView === "Solar Returns" && entry.category === "Research" || state.selectedView === "Progressions" && entry.category === "Research";
    return categoryMatch && tagMatch && viewMatch;
  });
}

function getEntrySearchResults() {
  const query = entrySearchQuery.trim().toLowerCase();
  if (!query) return [];

  return state.notebooks.flatMap((notebook) => {
    const person = state.people.find((item) => item.id === notebook.personId);
    return notebook.entries
      .filter((entry) => entryMatchesQuery(entry, query))
      .map((entry) => ({ person, notebook, entry }));
  });
}

function entryMatchesQuery(entry, query) {
  const searchable = [entry.title, entry.content, entry.category, entry.tags.join(" ")].join(" ").toLowerCase();
  return query.split(/\s+/).every((term) => searchable.includes(term));
}

function getAllTags() {
  return [...new Set(state.notebooks.flatMap((notebook) => notebook.entries.flatMap((entry) => entry.tags)))].sort();
}

function ensureValidSelection() {
  if (!getSelectedPerson()) {
    state.selectedPersonId = state.people[0]?.id ?? null;
  }

  if (!getSelectedNotebook()) {
    state.selectedNotebookId = getPersonNotebooks()[0]?.id ?? null;
  }

  const notebook = getSelectedNotebook();
  if (!notebook) {
    state.selectedEntryId = null;
    return;
  }

  if (!notebook.entries.some((entry) => entry.id === state.selectedEntryId)) {
    state.selectedEntryId = notebook.entries[0]?.id ?? null;
  }
}

// Persistence layer
function restoreState() {
  state.people = readPeople();
  state.notebooks = readNotebooks();

  if (!state.people.length) {
    const person = createPersonRecord("Default Chart");
    state.people.push(person);
  }

  state.notebooks = state.notebooks.map((notebook) => ({
    ...notebook,
    personId: notebook.personId || state.people[0].id
  }));

  state.selectedPersonId = localStorage.getItem(STORAGE_KEYS.selectedPerson) ?? state.people[0]?.id ?? null;
  state.selectedNotebookId = localStorage.getItem(STORAGE_KEYS.selectedNotebook);
  state.selectedEntryId = localStorage.getItem(STORAGE_KEYS.selectedEntry);
  state.selectedView = localStorage.getItem(STORAGE_KEYS.selectedView) || "Journal";
  searchQuery = localStorage.getItem(STORAGE_KEYS.notebookSearch) ?? "";
  entrySearchQuery = localStorage.getItem(STORAGE_KEYS.entrySearch) ?? "";
  entryTagFilter = localStorage.getItem(STORAGE_KEYS.tagFilter) ?? "All";

  ensureValidSelection();
}

function readPeople() {
  const raw = localStorage.getItem(STORAGE_KEYS.people);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidPerson).map(normalizePerson) : [];
  } catch {
    return [];
  }
}

function readNotebooks() {
  const raw = localStorage.getItem(STORAGE_KEYS.notebooks);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidNotebook).map(normalizeNotebook) : [];
  } catch {
    return [];
  }
}

function normalizePerson(person) {
  return {
    ...person,
    birthDate: person.birthDate || "",
    birthTime: person.birthTime || "",
    birthLocation: person.birthLocation || "",
    notes: Array.isArray(person.notes) ? person.notes : []
  };
}

function normalizeNotebook(notebook) {
  return {
    ...notebook,
    personId: notebook.personId || null,
    entries: Array.isArray(notebook.entries) ? notebook.entries.filter(isValidEntry).map(normalizeEntry) : []
  };
}

function normalizeEntry(entry) {
  return {
    ...entry,
    category: ENTRY_CATEGORIES.includes(entry.category) ? entry.category : DEFAULT_ENTRY_CATEGORY,
    tags: Array.isArray(entry.tags) ? [...new Set(entry.tags.map(cleanTag).filter(Boolean))] : []
  };
}

function isValidPerson(person) {
  return Boolean(person && typeof person.id === "string" && typeof person.name === "string");
}

function isValidNotebook(notebook) {
  return Boolean(notebook && typeof notebook.id === "string" && typeof notebook.name === "string" && typeof notebook.createdAt === "string" && typeof notebook.updatedAt === "string");
}

function isValidEntry(entry) {
  return Boolean(entry && typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.content === "string" && typeof entry.createdAt === "string" && typeof entry.updatedAt === "string");
}

function saveState() {
  setSaveStatus("saving");
  localStorage.setItem(STORAGE_KEYS.people, JSON.stringify(state.people));
  localStorage.setItem(STORAGE_KEYS.notebooks, JSON.stringify(state.notebooks));
  localStorage.setItem(STORAGE_KEYS.notebookSearch, searchQuery);
  localStorage.setItem(STORAGE_KEYS.entrySearch, entrySearchQuery);
  localStorage.setItem(STORAGE_KEYS.selectedView, state.selectedView);
  localStorage.setItem(STORAGE_KEYS.tagFilter, entryTagFilter);

  writeOptionalKey(STORAGE_KEYS.selectedPerson, state.selectedPersonId);
  writeOptionalKey(STORAGE_KEYS.selectedNotebook, state.selectedNotebookId);
  writeOptionalKey(STORAGE_KEYS.selectedEntry, state.selectedEntryId);

  window.clearTimeout(saveStatusTimer);
  saveStatusTimer = window.setTimeout(() => {
    setSaveStatus(state.notebooks.length ? "saved" : "empty");
    saveStatusTimer = null;
  }, 250);
}

function writeOptionalKey(key, value) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

function setSaveStatus(status) {
  elements.saveStatus.dataset.status = status;
  elements.saveStatusText.textContent = { saved: "Saved", saving: "Saving...", empty: "No notebooks" }[status];
}

// Rendering
function render() {
  ensureValidSelection();
  renderSearchInputs();
  renderPeople();
  renderNotebooks();
  renderEntries();
  renderTagFilter();
  renderEntrySearchResults();
  renderWorkspaceNav();
  renderEditor();
  if (!saveStatusTimer) setSaveStatus(state.notebooks.length ? "saved" : "empty");
}

function renderSearchInputs() {
  elements.notebookSearch.value = searchQuery;
  elements.entrySearch.value = entrySearchQuery;
}

function renderPeople() {
  elements.personCount.textContent = String(state.people.length);
  elements.personList.innerHTML = state.people.map((person) => `
    <button class="person-item ${person.id === state.selectedPersonId ? "active" : ""}" type="button" data-person-id="${person.id}">
      <span class="person-summary">
        <span class="person-name">${escapeHtml(person.name)}</span>
        <span class="person-meta">${escapeHtml(person.birthDate || "No birth date")}</span>
      </span>
    </button>
  `).join("");

  elements.personList.querySelectorAll("[data-person-id]").forEach((button) => {
    button.addEventListener("click", () => selectPerson(button.dataset.personId));
  });
}

function renderNotebooks() {
  const visibleNotebooks = getVisibleNotebooks();
  elements.notebookCount.textContent = String(getPersonNotebooks().length);
  elements.notebookList.innerHTML = visibleNotebooks.length
    ? visibleNotebooks.map(renderNotebookItem).join("")
    : `<p class="empty-list-state">${getPersonNotebooks().length ? "No notebooks match this search." : "No notebooks yet."}</p>`;
  bindNotebookEvents();
}

function renderNotebookItem(notebook) {
  const updatedAt = formatTime(notebook.updatedAt);
  const entryCount = notebook.entries.length;
  return `
    <div class="notebook-item ${notebook.id === state.selectedNotebookId ? "active" : ""}" data-id="${notebook.id}">
      <button class="notebook-summary" type="button" data-action="select" data-id="${notebook.id}">
        <span class="notebook-name">${escapeHtml(notebook.name)}</span>
        <span class="notebook-meta">${entryCount} ${entryCount === 1 ? "entry" : "entries"} · Updated ${updatedAt}</span>
      </button>
      <span class="notebook-actions">
        <button class="icon-button" type="button" data-action="rename" data-id="${notebook.id}">Rename</button>
        <button class="icon-button delete-button" type="button" data-action="delete" data-id="${notebook.id}">Delete</button>
      </span>
    </div>
  `;
}

function renderEntries() {
  const notebook = getSelectedNotebook();
  const visibleEntries = getVisibleEntries(notebook);
  elements.newEntryButton.disabled = !notebook;
  elements.entryCategoryFilter.disabled = !notebook;
  elements.entryNotebookName.textContent = notebook?.name ?? "No notebook";
  elements.entryCount.textContent = notebook ? `${visibleEntries.length}/${notebook.entries.length}` : "0";
  if (!notebook) {
    elements.entryList.innerHTML = `<p class="empty-list-state">Create a notebook before adding entries.</p>`;
    return;
  }
  elements.entryList.innerHTML = visibleEntries.length
    ? visibleEntries.map(renderEntryItem).join("")
    : `<p class="empty-list-state">${notebook.entries.length ? "No entries in this view." : "No entries yet."}</p>`;
  bindEntryEvents();
}

function renderEntryItem(entry) {
  return `
    <div class="entry-item ${entry.id === state.selectedEntryId ? "active" : ""}" data-id="${entry.id}">
      <button class="entry-summary" type="button" data-entry-action="select" data-id="${entry.id}">
        <span class="entry-name">${escapeHtml(entry.title)}</span>
        <span class="entry-meta"><span class="entry-category">${escapeHtml(entry.category)}</span> · ${entry.tags.length} tags · Updated ${formatTime(entry.updatedAt)}</span>
      </button>
      <span class="entry-actions">
        <button class="icon-button" type="button" data-entry-action="rename" data-id="${entry.id}">Rename</button>
        <button class="icon-button delete-button" type="button" data-entry-action="delete" data-id="${entry.id}">Delete</button>
      </span>
    </div>
  `;
}

function renderTagFilter() {
  const tags = getAllTags();
  elements.entryTagFilter.innerHTML = `<option value="All">All tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}"${tag === entryTagFilter ? " selected" : ""}>${escapeHtml(tag)}</option>`).join("")}`;
}

function renderEntrySearchResults() {
  const results = getEntrySearchResults();
  elements.entrySearchCount.textContent = entrySearchQuery.trim() ? String(results.length) : "0";
  elements.entrySearchResults.innerHTML = entrySearchQuery.trim()
    ? renderEntrySearchResultList(results)
    : `<p class="empty-list-state">Search entry title, content, category, or tag.</p>`;
  bindEntrySearchEvents();
}

function renderEntrySearchResultList(results) {
  if (!results.length) return `<p class="empty-list-state">No matching entries.</p>`;
  return results.map(({ person, notebook, entry }) => `
    <button class="entry-search-result" type="button" data-notebook-id="${notebook.id}" data-entry-id="${entry.id}">
      <span class="entry-search-summary">
        <span class="entry-result-name">${escapeHtml(person?.name ?? "Unknown")} / ${escapeHtml(notebook.name)} → ${escapeHtml(entry.title)}</span>
        <span class="entry-result-meta">${escapeHtml(entry.category)} · Updated ${formatTime(entry.updatedAt)}</span>
      </span>
    </button>
  `).join("");
}

function renderWorkspaceNav() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.selectedView);
  });
}

function renderEditor() {
  if (state.selectedView === "Dashboard") return renderDashboard();
  if (state.selectedView === "Files") return renderFilesView();

  const notebook = getSelectedNotebook();
  const entry = getSelectedEntry();
  const visibleEntries = getVisibleEntries(notebook);
  const entryIsVisible = Boolean(entry && visibleEntries.some((item) => item.id === entry.id));

  if (!notebook) return renderEmptyEditor("No notebook yet", "Create a notebook from the sidebar to begin.");
  if (!entry || !entryIsVisible) return renderEmptyEditor(notebook.entries.length ? "No visible entry" : "No entries yet", "Create or select an entry to start writing.");

  elements.breadcrumb.textContent = `${getSelectedPerson()?.name ?? "Person"} / ${notebook.name}`;
  elements.selectedEntryTitle.textContent = entry.title;
  elements.selectedNotebookTitle.textContent = `${notebook.name} · ${entry.category}`;
  elements.editorCard.innerHTML = `
    <div class="entry-metadata">
      <label class="metadata-field">
        <span class="metadata-label">Category</span>
        <select id="entryCategorySelect">${ENTRY_CATEGORIES.map((category) => `<option value="${escapeHtml(category)}"${category === entry.category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select>
      </label>
      <label class="metadata-field">
        <span class="metadata-label">Add tag</span>
        <input id="tagInput" type="text" placeholder="Mercury, Career...">
      </label>
      <div class="metadata-field"><span class="metadata-label">Created</span><span class="metadata-value">${formatDate(entry.createdAt)}</span></div>
      <div class="metadata-field"><span class="metadata-label">Last updated</span><span class="metadata-value">${formatDate(entry.updatedAt)}</span></div>
    </div>
    <div class="editor-tools">
      <button type="button" data-editor-mode="edit" class="${editorMode === "edit" ? "active" : ""}">Edit</button>
      <button type="button" data-editor-mode="preview" class="${editorMode === "preview" ? "active" : ""}">Preview</button>
      <button type="button" data-editor-mode="split" class="${editorMode === "split" ? "active" : ""}">Split</button>
      <div class="tag-list">${entry.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)} <button class="tag-remove" type="button" data-remove-tag="${escapeHtml(tag)}">x</button></span>`).join("")}</div>
    </div>
    ${renderEditorMode(entry)}
  `;
  bindEditorEvents();
}

function renderEditorMode(entry) {
  const textarea = `<textarea id="entryEditor" aria-label="Entry editor" placeholder="Write notes...">${escapeHtml(entry.content)}</textarea>`;
  const preview = `<div class="markdown-preview">${renderMarkdown(entry.content)}</div>`;
  if (editorMode === "preview") return preview;
  if (editorMode === "split") return `<div class="editor-split">${textarea}${preview}</div>`;
  return textarea;
}

function renderDashboard() {
  const person = getSelectedPerson();
  const entries = getPersonEntries();
  const recent = [...entries].sort((a, b) => b.entry.updatedAt.localeCompare(a.entry.updatedAt)).slice(0, 6);
  const categories = countBy(entries.map(({ entry }) => entry.category));
  const tags = countBy(entries.flatMap(({ entry }) => entry.tags));
  elements.breadcrumb.textContent = "Dashboard";
  elements.selectedEntryTitle.textContent = person?.name ?? "Astrology Dashboard";
  elements.selectedNotebookTitle.textContent = "Workspace overview";
  elements.editorCard.innerHTML = `
    <div class="dashboard-view">
      <div class="dashboard-grid">
        <div class="dashboard-card"><span>People</span><strong>${state.people.length}</strong><p>Total charts</p></div>
        <div class="dashboard-card"><span>Notebooks</span><strong>${getPersonNotebooks().length}</strong><p>For selected person</p></div>
        <div class="dashboard-card"><span>Entries</span><strong>${entries.length}</strong><p>Total notes</p></div>
        <div class="dashboard-card"><span>Tags</span><strong>${Object.keys(tags).length}</strong><p>Unique tags</p></div>
      </div>
      <section class="reader-section"><h3>Profile</h3><p>${escapeHtml(person?.name ?? "No person")} · ${escapeHtml(person?.birthDate || "No birth date")} · ${escapeHtml(person?.birthTime || "No birth time")} · ${escapeHtml(person?.birthLocation || "No location")}</p></section>
      <section class="reader-section"><h3>Categories</h3><p>${formatCounts(categories)}</p></section>
      <section class="reader-section"><h3>Most Used Tags</h3><p>${formatCounts(tags)}</p></section>
      <section class="reader-section"><h3>Recently Updated Entries</h3><p>${recent.map(({ notebook, entry }) => `${escapeHtml(notebook.name)} → ${escapeHtml(entry.title)} (${formatDate(entry.updatedAt)})`).join("<br>") || "No activity yet."}</p></section>
    </div>
  `;
}

function renderFilesView() {
  renderEmptyEditor("Files", "File attachments are planned for a future phase. This view is reserved in the workspace navigation.");
}

function renderEmptyEditor(title, message) {
  elements.breadcrumb.textContent = state.selectedView;
  elements.selectedEntryTitle.textContent = title;
  elements.selectedNotebookTitle.textContent = getSelectedNotebook()?.name ?? "No notebook selected";
  elements.editorCard.innerHTML = `<div class="empty-editor-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`;
}

// Event handlers
function bindNotebookEvents() {
  elements.notebookList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "select") selectNotebook(button.dataset.id);
      if (button.dataset.action === "rename") renameNotebook(button.dataset.id);
      if (button.dataset.action === "delete") deleteNotebook(button.dataset.id);
    });
  });
}

function bindEntryEvents() {
  elements.entryList.querySelectorAll("[data-entry-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.entryAction === "select") selectEntry(button.dataset.id);
      if (button.dataset.entryAction === "rename") renameEntry(button.dataset.id);
      if (button.dataset.entryAction === "delete") deleteEntry(button.dataset.id);
    });
  });
}

function bindEntrySearchEvents() {
  elements.entrySearchResults.querySelectorAll("[data-notebook-id][data-entry-id]").forEach((button) => {
    button.addEventListener("click", () => jumpToEntry(button.dataset.notebookId, button.dataset.entryId));
  });
}

function bindEditorEvents() {
  document.querySelector("#entryEditor")?.addEventListener("input", (event) => updateSelectedEntryContent(event.target.value));
  document.querySelector("#entryCategorySelect")?.addEventListener("change", (event) => updateSelectedEntryCategory(event.target.value));
  document.querySelector("#tagInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag(event.target.value);
      event.target.value = "";
    }
  });
  document.querySelectorAll("[data-remove-tag]").forEach((button) => button.addEventListener("click", () => removeTag(button.dataset.removeTag)));
  document.querySelectorAll("[data-editor-mode]").forEach((button) => button.addEventListener("click", () => {
    editorMode = button.dataset.editorMode;
    render();
  }));
}

function createPerson() {
  const name = prompt("Person name", "New Person");
  if (!name?.trim()) return;
  const person = createPersonRecord(name.trim());
  state.people.push(person);
  state.selectedPersonId = person.id;
  state.selectedNotebookId = null;
  state.selectedEntryId = null;
  saveState();
  render();
}

function editPerson() {
  const person = getSelectedPerson();
  if (!person) return;
  const name = prompt("Name", person.name);
  if (!name?.trim()) return;
  person.name = name.trim();
  person.birthDate = prompt("Birth date", person.birthDate) ?? person.birthDate;
  person.birthTime = prompt("Birth time", person.birthTime) ?? person.birthTime;
  person.birthLocation = prompt("Birth location", person.birthLocation) ?? person.birthLocation;
  person.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function deletePerson() {
  const person = getSelectedPerson();
  if (!person) return;
  state.people = state.people.filter((item) => item.id !== person.id);
  state.notebooks = state.notebooks.filter((notebook) => notebook.personId !== person.id);
  if (state.people.length === 0) {
    state.people.push(createPersonRecord("Default Chart"));
  }
  state.selectedPersonId = state.people[0]?.id ?? null;
  state.selectedNotebookId = getPersonNotebooks()[0]?.id ?? null;
  state.selectedEntryId = getSelectedNotebook()?.entries[0]?.id ?? null;
  saveState();
  render();
}

function selectPerson(personId) {
  state.selectedPersonId = personId;
  state.selectedNotebookId = getPersonNotebooks()[0]?.id ?? null;
  state.selectedEntryId = getSelectedNotebook()?.entries[0]?.id ?? null;
  saveState();
  render();
}

function createNotebook() {
  if (!state.selectedPersonId) {
    const person = createPersonRecord("Default Chart");
    state.people.push(person);
    state.selectedPersonId = person.id;
  }
  const notebook = createNotebookRecord(`Untitled Notebook ${getPersonNotebooks().length + 1}`);
  state.notebooks.push(notebook);
  state.selectedNotebookId = notebook.id;
  state.selectedEntryId = null;
  saveState();
  render();
}

function selectNotebook(notebookId) {
  const notebook = state.notebooks.find((item) => item.id === notebookId);
  if (!notebook) return;
  state.selectedNotebookId = notebookId;
  state.selectedPersonId = notebook.personId;
  state.selectedEntryId = notebook.entries[0]?.id ?? null;
  saveState();
  render();
}

function renameNotebook(notebookId) {
  const notebook = state.notebooks.find((item) => item.id === notebookId);
  if (!notebook) return;
  const nextName = prompt("Rename notebook", notebook.name);
  if (!nextName?.trim()) return;
  notebook.name = nextName.trim();
  notebook.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function deleteNotebook(notebookId) {
  state.notebooks = state.notebooks.filter((notebook) => notebook.id !== notebookId);
  if (state.selectedNotebookId === notebookId) {
    state.selectedNotebookId = getPersonNotebooks()[0]?.id ?? null;
    state.selectedEntryId = getSelectedNotebook()?.entries[0]?.id ?? null;
  }
  saveState();
  render();
}

function createEntry() {
  const notebook = getSelectedNotebook();
  if (!notebook) return;
  const category = ENTRY_CATEGORIES.includes(state.selectedView) ? state.selectedView : DEFAULT_ENTRY_CATEGORY;
  const entry = createEntryRecord(`Untitled Entry ${notebook.entries.length + 1}`, category);
  notebook.entries.push(entry);
  notebook.updatedAt = entry.updatedAt;
  state.selectedEntryId = entry.id;
  saveState();
  render();
}

function selectEntry(entryId) {
  state.selectedEntryId = entryId;
  saveState();
  render();
}

function jumpToEntry(notebookId, entryId) {
  const notebook = state.notebooks.find((item) => item.id === notebookId);
  if (!notebook) return;
  state.selectedPersonId = notebook.personId;
  state.selectedNotebookId = notebookId;
  state.selectedEntryId = entryId;
  state.selectedView = "Journal";
  entryCategoryFilter = "All";
  saveState();
  render();
}

function renameEntry(entryId) {
  const notebook = getSelectedNotebook();
  const entry = notebook?.entries.find((item) => item.id === entryId);
  if (!entry) return;
  const nextTitle = prompt("Rename entry", entry.title);
  if (!nextTitle?.trim()) return;
  touchEntry(notebook, entry);
  entry.title = nextTitle.trim();
  saveState();
  render();
}

function deleteEntry(entryId) {
  const notebook = getSelectedNotebook();
  if (!notebook) return;
  notebook.entries = notebook.entries.filter((entry) => entry.id !== entryId);
  notebook.updatedAt = new Date().toISOString();
  if (state.selectedEntryId === entryId) state.selectedEntryId = notebook.entries[0]?.id ?? null;
  saveState();
  render();
}

function updateSelectedEntryContent(content) {
  const notebook = getSelectedNotebook();
  const entry = getSelectedEntry();
  if (!notebook || !entry) return;
  entry.content = content;
  touchEntry(notebook, entry);
  saveState();
}

function updateSelectedEntryCategory(category) {
  const notebook = getSelectedNotebook();
  const entry = getSelectedEntry();
  if (!notebook || !entry || !ENTRY_CATEGORIES.includes(category)) return;
  entry.category = category;
  touchEntry(notebook, entry);
  saveState();
  render();
}

function addTag(value) {
  const tag = cleanTag(value);
  const notebook = getSelectedNotebook();
  const entry = getSelectedEntry();
  if (!tag || !notebook || !entry || entry.tags.includes(tag)) return;
  entry.tags.push(tag);
  touchEntry(notebook, entry);
  saveState();
  render();
}

function removeTag(tag) {
  const notebook = getSelectedNotebook();
  const entry = getSelectedEntry();
  if (!notebook || !entry) return;
  entry.tags = entry.tags.filter((item) => item !== tag);
  if (entryTagFilter === tag) entryTagFilter = "All";
  touchEntry(notebook, entry);
  saveState();
  render();
}

function touchEntry(notebook, entry) {
  const now = new Date().toISOString();
  entry.updatedAt = now;
  notebook.updatedAt = now;
}

function exportJson() {
  downloadFile(`AstrologyNotebook_Backup_${todayStamp()}.json`, JSON.stringify({ people: state.people, notebooks: state.notebooks }, null, 2), "application/json");
}

function exportMarkdown() {
  const content = state.people.map((person) => {
    const notebooks = state.notebooks.filter((notebook) => notebook.personId === person.id);
    return [`# ${person.name}`, `Birth: ${person.birthDate} ${person.birthTime} ${person.birthLocation}`]
      .concat(notebooks.flatMap((notebook) => [`\n## ${notebook.name}`].concat(notebook.entries.map((entry) => `\n### ${entry.title}\nCategory: ${entry.category}\nTags: ${entry.tags.join(", ")}\n\n${entry.content}`))))
      .join("\n");
  }).join("\n\n");
  downloadFile(`AstrologyNotebook_Backup_${todayStamp()}.md`, content, "text/markdown");
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (file.name.endsWith(".json")) importJson(String(reader.result));
    else importMarkdown(String(reader.result), file.name);
    saveState();
    render();
  };
  reader.readAsText(file);
}

function importJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    alert("That JSON file could not be imported.");
    return;
  }
  state.people = Array.isArray(parsed.people) ? parsed.people.filter(isValidPerson).map(normalizePerson) : state.people;
  state.notebooks = Array.isArray(parsed.notebooks) ? parsed.notebooks.filter(isValidNotebook).map(normalizeNotebook) : state.notebooks;
  ensureValidSelection();
}

function importMarkdown(raw, filename) {
  const notebook = getSelectedNotebook() || createNotebookRecord(filename.replace(/\.(md|markdown)$/i, ""));
  if (!state.notebooks.includes(notebook)) state.notebooks.push(notebook);
  const entry = createEntryRecord(filename.replace(/\.(md|markdown)$/i, ""), "Research");
  entry.content = raw;
  notebook.entries.push(entry);
  state.selectedNotebookId = notebook.id;
  state.selectedEntryId = entry.id;
}

function renderMarkdown(markdown) {
  const lines = escapeHtml(markdown).split("\n");
  let html = "";
  let inList = false;
  let inCode = false;
  let code = [];
  for (const line of lines) {
    if (/^```/.test(line)) {
      html += closeList();
      if (inCode) {
        html += `<pre><code>${code.join("\n")}</code></pre>`;
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
    } else if (inCode) code.push(line);
    else if (/^### /.test(line)) html += closeList() + `<h3>${line.slice(4)}</h3>`;
    else if (/^## /.test(line)) html += closeList() + `<h2>${line.slice(3)}</h2>`;
    else if (/^# /.test(line)) html += closeList() + `<h1>${line.slice(2)}</h1>`;
    else if (/^> /.test(line)) html += closeList() + `<blockquote>${line.slice(2)}</blockquote>`;
    else if (/^- \[[ x]\] /.test(line)) html += openList() + `<li>${line.replace(/^- \[[ x]\] /, "")}</li>`;
    else if (/^- /.test(line)) html += openList() + `<li>${line.slice(2)}</li>`;
    else if (/\|/.test(line) && line.trim().startsWith("|")) html += closeList() + renderTableLine(line);
    else if (line.trim()) html += closeList() + `<p>${line}</p>`;
    else html += closeList();
  }
  html += closeList();
  if (inCode) html += `<pre><code>${code.join("\n")}</code></pre>`;
  return html
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  function openList() {
    if (inList) return "";
    inList = true;
    return "<ul>";
  }
  function closeList() {
    if (!inList) return "";
    inList = false;
    return "</ul>";
  }
}

function renderTableLine(line) {
  const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
  if (cells.every((cell) => /^-+$/.test(cell))) return "";
  return `<table><tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr></table>`;
}

function countBy(items) {
  return items.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}

function formatCounts(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, count]) => `${escapeHtml(key)}: ${count}`).join("<br>") || "None yet.";
}

function cleanTag(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(value) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

elements.newPersonButton.addEventListener("click", createPerson);
elements.editPersonButton.addEventListener("click", editPerson);
elements.deletePersonButton.addEventListener("click", deletePerson);
elements.newNotebookButton.addEventListener("click", createNotebook);
elements.newEntryButton.addEventListener("click", createEntry);
elements.exportJsonButton.addEventListener("click", exportJson);
elements.exportMarkdownButton.addEventListener("click", exportMarkdown);
elements.importFileInput.addEventListener("change", () => importFile(elements.importFileInput.files[0]));
elements.notebookSearch.addEventListener("input", () => { searchQuery = elements.notebookSearch.value; saveState(); render(); });
elements.entrySearch.addEventListener("input", () => { entrySearchQuery = elements.entrySearch.value; saveState(); render(); });
elements.entryCategoryFilter.addEventListener("change", () => { entryCategoryFilter = elements.entryCategoryFilter.value; render(); });
elements.entryTagFilter.addEventListener("change", () => { entryTagFilter = elements.entryTagFilter.value; saveState(); render(); });
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.selectedView = button.dataset.view; saveState(); render(); }));

render();
