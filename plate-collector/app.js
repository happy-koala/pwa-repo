/**
 * Kennzeichen Sammler – clientseitige App-Logik ohne Abhängigkeiten.
 */
import { REGIONS, PLATE_CODES } from './plates-data.js';

const STORAGE_KEY = 'collectedPlates';
const STORAGE_VERSION = 1;
const collection = new Map(); // code -> collectedAt (YYYY-MM-DD HH:mm:ss)

const elements = {
  collectionView: document.querySelector('#view-sammlung'),
  captureView: document.querySelector('#view-erfassen'),
  captureMount: document.querySelector('[data-capture-mount]'),
  summaryNumber: document.querySelector('.summary-number'),
  summaryNote: document.querySelector('.summary-note'),
  emptyState: document.querySelector('.empty-state')
};

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function loadCollected() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.plates && typeof parsed.plates === 'object' ? parsed.plates : {};
  } catch (error) {
    console.warn('Gesammelte Kennzeichen konnten nicht geladen werden.', error);
    return {};
  }
}

function saveCollected() {
  try {
    const plates = Object.fromEntries(
      [...collection.entries()].map(([code, collectedAt]) => [code, { code, collectedAt }])
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, plates }));
  } catch (error) {
    console.warn('Sammlung konnte nicht gespeichert werden.', error);
  }
}

function regionName(region) {
  if (typeof REGIONS === 'object' && REGIONS !== null) return REGIONS[region] || region;
  return region;
}

function updateSummary() {
  const collectedCount = collection.size;
  const total = PLATE_CODES.length;

  if (elements.summaryNumber) {
    elements.summaryNumber.textContent = String(collectedCount).padStart(2, '0');
  }

  if (elements.summaryNote) {
    elements.summaryNote.innerHTML = `<strong>${collectedCount} / ${total}</strong> gesammelt`;
  }
}

/**
 * Erzeugt das gemeinsame Markup für eine Kennzeichen-Karte
 * (Schild-Optik links, Name + Bundesland-Kürzel rechts).
 */
function buildPlateCardMarkup() {
  return `
    <span class="plate-shield" aria-hidden="true">
      <span class="plate-shield__code"></span>
    </span>
    <span class="plate-info">
      <span class="plate-info__name"></span>
      <span class="plate-info__current accent" hidden>
         | aktuell:
        <span class="plate-shield plate-shield--small" aria-hidden="true">
          <span class="plate-shield__code"></span>
        </span>
      </span>
    </span>
    <span class="plate-info__region"></span>`;
}

function fillPlateCard(node, plate) {
  node.querySelector('.plate-shield__code').textContent = plate.code;
  node.querySelector('.plate-info__name').textContent = plate.name;
  node.querySelector('.plate-info__region').textContent = plate.region;

  const currentWrap = node.querySelector('.plate-info__current');

  if (plate.isDeprecated && plate.currentCode) {
    currentWrap.hidden = false;
    currentWrap.querySelector('.plate-shield--small .plate-shield__code').textContent = plate.currentCode;
  } else {
    currentWrap.hidden = true;
  }

  const shield = node.querySelector('.plate-shield:not(.plate-shield--small)');
  shield.classList.toggle('plate-shield--deprecated', Boolean(plate.isDeprecated));
}

function createCaptureInterface() {
  if (!elements.captureMount || elements.captureMount.querySelector('[data-app-capture]')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'panel app-capture-interface';
  wrapper.dataset.appCapture = 'true';

  wrapper.innerHTML = `
    <div class="field">
      <label for="plate-search">Kennzeichen, Stadt, Gemeinde oder Landkreis eingeben</label>
      <input id="plate-search" type="search" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="characters" aria-describedby="plate-search-help">
    </div>
    <p class="muted results-count" data-results-count role="status" aria-live="polite" hidden></p>
    <div class="plate-results" data-plate-list hidden></div>`;

  elements.captureMount.append(wrapper);

  const input = wrapper.querySelector('#plate-search');
  input.addEventListener('input', () => {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.toUpperCase();
    if (start !== null && end !== null) {
      input.setSelectionRange(start, end);
    }
    renderPlateList(input.value);
  });
}

function renderPlateList(query = '') {
  const wrapper = elements.captureMount?.querySelector('[data-app-capture]');
  const list = wrapper?.querySelector('[data-plate-list]');
  const count = wrapper?.querySelector('[data-results-count]');

  if (!list) return;

  const normalized = query.trim().toLocaleLowerCase('de-DE');

  if (!normalized) {
    list.replaceChildren();
    list.hidden = true;

    if (count) {
      count.textContent = '';
      count.hidden = true;
    }

    return;
  }

  const matches = PLATE_CODES.filter((plate) =>
    [plate.code, plate.name, regionName(plate.region)]
      .some((value) => String(value ?? '').toLocaleLowerCase('de-DE').includes(normalized))
  ).sort((a, b) => {
    const aCode = a.code.toLocaleLowerCase('de-DE');
    const bCode = b.code.toLocaleLowerCase('de-DE');

    const aExact = aCode === normalized;
    const bExact = bCode === normalized;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aCodeStart = aCode.startsWith(normalized);
    const bCodeStart = bCode.startsWith(normalized);
    if (aCodeStart && !bCodeStart) return -1;
    if (!aCodeStart && bCodeStart) return 1;

    return aCode.localeCompare(bCode, 'de');
  });

  list.replaceChildren();

  const fragment = document.createDocumentFragment();

  matches.forEach((plate) => {
    const isCollected = collection.has(plate.code);
    const button = document.createElement('button');

    button.type = 'button';
    button.className = `plate-card plate-choice${isCollected ? ' is-collected' : ''}`;
    button.setAttribute('aria-pressed', String(isCollected));
    button.innerHTML = buildPlateCardMarkup() + '<span class="plate-choice__state" aria-hidden="true"></span>';

    fillPlateCard(button, plate);
    button.querySelector('.plate-choice__state').textContent = isCollected ? '✓' : '+';

    button.addEventListener('click', () => togglePlate(plate.code));
    fragment.append(button);
  });

  list.append(fragment);
  list.hidden = false;

  if (count) {
    count.textContent = `${matches.length} von ${PLATE_CODES.length} Kennzeichen`;
    count.hidden = false;
  }
}

function togglePlate(code) {
  if (collection.has(code)) {
    collection.delete(code);
  } else {
    collection.set(code, formatTimestamp());
  }

  saveCollected();
  updateSummary();

  renderPlateList(
    elements.captureMount?.querySelector('#plate-search')?.value || ''
  );

  renderCollectionOverview();
  renderAllCollection();
}

function groupedRegions() {
  const grouped = new Map();

  PLATE_CODES.forEach((plate) => {
    const key = plate.region || 'Weitere';

    if (!grouped.has(key)) {
      grouped.set(key, { total: 0, collected: 0 });
    }

    const group = grouped.get(key);
    group.total += 1;

    if (collection.has(plate.code)) {
      group.collected += 1;
    }
  });

  return [...grouped.entries()]
    .sort((a, b) => regionName(a[0]).localeCompare(regionName(b[0]), 'de'));
}

function renderCollectionOverview() {
  if (!elements.collectionView) return;

  const panel = elements.collectionView.querySelector(
    '[data-collection-panel="sammlungen"]'
  );

  if (!panel) return;

  panel.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = 'Nach Bundesland / Region';
  panel.append(title);

  const list = document.createElement('div');
  list.className = 'collection-grid';

  groupedRegions().forEach(([key, group]) => {
    const item = document.createElement('div');
    item.className = 'card region-progress';

    item.innerHTML = '<strong></strong><span class="muted"></span>';

    item.querySelector('strong').textContent = regionName(key);
    item.querySelector('span').textContent = `${group.collected} / ${group.total}`;

    list.append(item);
  });

  panel.append(list);
}

function renderAllCollection() {
  const panel = elements.collectionView?.querySelector(
    '[data-collection-panel="alle"]'
  );

  if (!panel) return;

  panel.replaceChildren();

  if (collection.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="plate-ghost" aria-hidden="true"><span>? – </span><b>123</b></div>
      <h2>Deine Sammlung ist leer</h2>
      <button class="action-button" type="button" data-view="erfassen">
        + Kennzeichen erfassen
      </button>`;

    empty
      .querySelector('[data-view]')
      .addEventListener('click', () => showView('erfassen'));

    panel.append(empty);
    return;
  }

  const title = document.createElement('h2');
  title.textContent = `${collection.size} Kennzeichen gesammelt`;
  panel.append(title);

  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = 'Alle bisher erfassten Kennzeichen.';
  panel.append(note);

  const list = document.createElement('div');
  list.className = 'plate-results collected-list';

  PLATE_CODES
    .filter((plate) => collection.has(plate.code))
    .forEach((plate) => {
      const item = document.createElement('div');
      item.className = 'plate-card';
      item.innerHTML = buildPlateCardMarkup();
      fillPlateCard(item, plate);
      list.append(item);
    });

  panel.append(list);
}

function showCollectionView(name) {
  document.querySelectorAll('[data-collection-view]').forEach((button) => {
    const active = button.dataset.collectionView === name;

    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('[data-collection-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.collectionPanel !== name;
  });
}

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => {
    const active = view.id === `view-${name}`;

    view.hidden = !active;
    view.classList.toggle('is-visible', active);
  });

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    const active = tab.dataset.view === name;

    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  if (window.location.hash !== `#${name}`) {
    history.replaceState(null, '', `#${name}`);
  }

  if (name === 'sammlung') {
    renderAllCollection();
    renderCollectionOverview();
  }
}

/**
 * Exportiert die aktuelle Sammlung als Base64-codierten JSON-String.
 * Kann per Zwischenablage gesichert und später wieder importiert werden.
 */
function exportCollection() {
  const plates = Object.fromEntries(
    [...collection.entries()].map(([code, collectedAt]) => [code, { code, collectedAt }])
  );

  const payload = { version: STORAGE_VERSION, plates };
  const json = JSON.stringify(payload);

  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch (error) {
    console.warn('Export fehlgeschlagen.', error);
    return '';
  }
}

/**
 * Importiert eine zuvor exportierte Sammlung aus einem Base64-codierten String.
 * Bestehende Einträge werden überschrieben (Merge, kein Reset).
 * Gibt true bei Erfolg zurück, false bei ungültigem Input.
 */
function importCollection(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded.trim())));
    const parsed = JSON.parse(json);

    if (!parsed || typeof parsed.plates !== 'object') {
      throw new Error('Ungültiges Format.');
    }

    Object.values(parsed.plates).forEach((entry) => {
      const code = entry?.code;
      if (!code || !PLATE_CODES.some((plate) => plate.code === code)) return;

      const collectedAt = entry.collectedAt || formatTimestamp();
      collection.set(code, collectedAt);
    });

    saveCollected();
    updateSummary();
    renderAllCollection();
    renderCollectionOverview();

    return true;
  } catch (error) {
    console.warn('Import fehlgeschlagen.', error);
    return false;
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch((error) => {
        console.warn(
          'Service Worker konnte nicht registriert werden.',
          error
        );
      });
  });
}

function init() {
  const stored = loadCollected();

  Object.values(stored).forEach((entry) => {
    const code = entry?.code;
    if (code && PLATE_CODES.some((plate) => plate.code === code)) {
      collection.set(code, entry.collectedAt || formatTimestamp());
    }
  });

  document.querySelectorAll('[data-view]').forEach((trigger) => {
    trigger.addEventListener('click', () => showView(trigger.dataset.view));
  });

  document.querySelectorAll('[data-collection-view]').forEach((button) => {
    button.addEventListener('click', () => {
      showCollectionView(button.dataset.collectionView);
    });
  });

  createCaptureInterface();
  updateSummary();
  renderAllCollection();
  renderCollectionOverview();

  const initialView =
    window.location.hash === '#sammlung'
      ? 'sammlung'
      : 'erfassen';

  showView(initialView);
  showCollectionView('alle');
  registerServiceWorker();
}

// Für spätere Frontend-Anbindung (Buttons) global verfügbar machen
window.KennzeichenSammler = {
  exportCollection,
  importCollection
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}