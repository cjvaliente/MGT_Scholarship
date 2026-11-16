/* =====================================================================
   iSKOLEKTIB - script.js
   A frontend prototype. All data lives in the browser's localStorage.
   Nothing is ever sent to a server, a university, or a scholarship provider.

   HOW THIS FILE IS ORGANIZED
     1. Settings and lists (courses, statuses, ...)
     2. Sample scholarship data
     3. Helper functions (dates, text, saving/loading)
     4. Scholarship matching logic        (Feature 1)
     5. Marketplace rendering             (Feature 2)
     6. Applications                      (Feature 3)
     7. Tracking & disbursement           (Feature 4)
     8. Dashboard
     8B. Sign-in, roles and admin scholarship management
     9. Navigation, modal, messages
     5B. File storage (IndexedDB) and upload helpers
     8C. Admin: PDF extraction and student application review
    10. Click / change listeners and start-up
   ===================================================================== */


/* =====================================================================
   1. SETTINGS AND LISTS
   Edit these lists to change what appears in the dropdown menus.
   ===================================================================== */

// Names of the keys used inside localStorage
const KEYS = {
  scholarships: 'iskolektib_scholarships',
  profile: 'iskolektib_profile',
  applications: 'iskolektib_applications',
  session: 'iskolektib_session'
};

const COURSES = [
  'BS Agribusiness Economics', 'BA Anthropology', 'BS Applied Mathematics', 'BS Architecture', 
  'BS Biology', 'BA Communication and Media Arts', 'BS Computer Science', 'BS Data Science', 
  'BS Food Technology', 'AA Sport Science', 'BS Sport Science'   
];

const INTERESTS = [
  'College of Science & Mathematics', 'College of Humanities and Social Sciences', 'Department of Human Kinetics',
  'School of Management'
];

const YEARS = [1, 2, 3, 4, 5];

const AID_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'scholarship', label: 'Currently receiving another scholarship' },
  { value: 'assistance', label: 'Currently receiving financial assistance' }
];

const TYPES = ['Government', 'Private', 'University', 'Alumni'];

const APP_STATUSES = [
  'Draft', 'Submitted', 'Under Review', 'Verified', 'Incomplete', 'Approved', 'Rejected'
];

const DISB_STATUSES = ['Not Yet Approved', 'Pending', 'Processing', 'Released', 'Delayed'];

// Students can only edit an application while it is a Draft.
// Once submitted it is LOCKED, whatever status the admin sets later.
const EDITABLE_STATUSES = ['Draft'];

const TIMELINE_STEPS = [
  'Application Submitted', 'Under Review', 'Approved', 'Disbursement Processing', 'Funds Released'
];


/* =====================================================================
   3. HELPER FUNCTIONS
   ===================================================================== */

// ----- The "state" of the app (loaded from localStorage in loadAllData) -----
let scholarships = [];
let applications = [];
let profile = null;
let session = null;               // who is signed in: { role: 'student' or 'admin', name: '...' }
let editingScholarshipId = null;  // admin: id of the scholarship being edited (null = adding a new one)
let editingAppId = null;      // id of the application being edited (null = creating a new one)
let formDocs = [];            // documents in the open application form: { name, fileId, fileName, fileType, fileSize }
let matchingShown = false;    // true after the user clicked "Find Matching Scholarships"
let toastTimer = null;

// ----- Short names for common things -----
function $(id) { return document.getElementById(id); }
function val(id) { return $(id).value; }

// Makes text safe to put inside HTML (protects against typed-in HTML tags)
function esc(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// "Under Review" -> "under-review" (used for CSS class names)
function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function peso(amount) { return 'PHP ' + Number(amount).toLocaleString('en-US'); }

function yearLabel(n) { return ['', '1st', '2nd', '3rd', '4th', '5th'][n] + ' year'; }

function aidLabel(value) {
  const found = AID_OPTIONS.find(function (o) { return o.value === value; });
  return found ? found.label : value;
}

// ----- Dates (stored as "YYYY-MM-DD" text) -----
function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayISO() { return toISO(new Date()); }
function dateInDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); }
function parseISO(s) { const p = s.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }

// Days from today until the date (negative = already passed)
function daysUntil(s) { return Math.round((parseISO(s) - parseISO(todayISO())) / 86400000); }

function formatDate(s) {
  if (!s) return 'Not set';
  return parseISO(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isClosed(s) { return daysUntil(s.deadline) < 0; }

function deadlineBadge(deadline) {
  const d = daysUntil(deadline);
  if (d < 0) return '<span class="badge badge-red">Closed</span>';
  if (d === 0) return '<span class="badge badge-amber">Due today</span>';
  if (d <= 7) return '<span class="badge badge-amber">' + d + ' day' + (d === 1 ? '' : 's') + ' left</span>';
  return '<span class="badge badge-blue">' + d + ' days left</span>';
}

function statusBadge(status) { return '<span class="badge status-' + slug(status) + '">' + esc(status) + '</span>'; }
function disbBadge(status) { return '<span class="badge disb-' + slug(status) + '">' + esc(status) + '</span>'; }

// ----- Finding things in the arrays -----
function findScholarship(id) { return scholarships.find(function (s) { return s.id === id; }); }
function findApp(id) { return applications.find(function (a) { return a.id === id; }); }
function newAppId() { return applications.reduce(function (max, a) { return Math.max(max, a.id); }, 0) + 1; }

// ----- localStorage -----
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;   // if the saved text is damaged, start fresh instead of crashing
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    showToast('Could not save to this browser (storage may be blocked or full).', 'error');
    return false;
  }
}

function saveScholarships() { saveJSON(KEYS.scholarships, scholarships); }
function saveApplications() { saveJSON(KEYS.applications, applications); }
function saveProfile() { saveJSON(KEYS.profile, profile); }

// Runs once at start-up. Only loads sample scholarships if nothing is saved yet,
// so refreshing the page never overwrites the user's saved data.
function loadAllData() {
  const savedScholarships = loadJSON(KEYS.scholarships, null);
  if (Array.isArray(savedScholarships)) {
    scholarships = savedScholarships;
  } else {
    scholarships = getSampleScholarships();
    saveScholarships();
  }
  const savedApps = loadJSON(KEYS.applications, []);
  applications = Array.isArray(savedApps) ? savedApps : [];
  profile = loadJSON(KEYS.profile, null);
  const savedSession = loadJSON(KEYS.session, null);
  session = savedSession && (savedSession.role === 'student' || savedSession.role === 'admin') ? savedSession : null;
}

// Fills a <select> dropdown. "items" can be plain text or {value, label} objects.
function fillSelect(id, items, placeholder) {
  let html = placeholder !== undefined ? '<option value="">' + esc(placeholder) + '</option>' : '';
  items.forEach(function (item) {
    const value = typeof item === 'object' ? item.value : item;
    const label = typeof item === 'object' ? item.label : item;
    html += '<option value="' + esc(value) + '">' + esc(label) + '</option>';
  });
  $(id).innerHTML = html;
}


/* =====================================================================
   4. FEATURE 1 - SCHOLARSHIP MATCHING
   Compares a student profile against one scholarship.
   Each requirement is checked with a simple if-statement. The result lists
   the requirements the student meets and the ones they do not meet.
   ===================================================================== */

function checkEligibility(s, p) {
  const criteria = [];   // each item: { ok: true/false, good: 'text', bad: 'text' }

  // Course / degree program
  if (!s.courses.includes('Any')) {
    criteria.push({
      ok: s.courses.includes(p.course),
      good: 'Your program (' + p.course + ') is on the eligible list.',
      bad: 'Open only to: ' + s.courses.join(', ') + '. Your program is ' + p.course + '.'
    });
  }

  // Year level (only checked when the scholarship does not accept every year)
  if (s.yearLevels.length < YEARS.length) {
    criteria.push({
      ok: s.yearLevels.includes(p.yearLevel),
      good: 'Your year level (' + yearLabel(p.yearLevel) + ') is eligible.',
      bad: 'Open only to: ' + s.yearLevels.map(yearLabel).join(', ') + '. You are in your ' + yearLabel(p.yearLevel) + '.'
    });
  }

  // GWA: in the UP grading system a LOWER number is BETTER (1.00 is the best).
  // So a required GWA of 1.75 or better means: student GWA <= 1.75.
  if (s.maxGWA !== null) {
    criteria.push({
      ok: p.gwa <= s.maxGWA,
      good: 'Your GWA of ' + p.gwa.toFixed(2) + ' meets the required ' + s.maxGWA.toFixed(2) + ' or better.',
      bad: 'Your GWA of ' + p.gwa.toFixed(2) + ' is not good enough. Required: ' + s.maxGWA.toFixed(2) + ' or better.'
    });
  }

  // Monthly family income limit
  if (s.maxIncome !== null) {
    criteria.push({
      ok: p.income <= s.maxIncome,
      good: 'Your monthly family income (' + peso(p.income) + ') is within the limit of ' + peso(s.maxIncome) + '.',
      bad: 'Your monthly family income (' + peso(p.income) + ') is above the limit of ' + peso(s.maxIncome) + '.'
    });
  }

  // Field of study / academic interest
  if (!s.fields.includes('Any')) {
    criteria.push({
      ok: s.fields.includes(p.interest),
      good: 'Your interest (' + p.interest + ') fits the scholarship focus.',
      bad: 'Focus areas: ' + s.fields.join(', ') + '. Your interest is ' + p.interest + '.'
    });
  }

  // Scholarship / financial assistance status
  if (!s.allowsExistingAid) {
    criteria.push({
      ok: p.aid === 'none',
      good: 'You are not receiving another scholarship or assistance, as required.',
      bad: 'Not open to students who are already receiving another scholarship or financial assistance.'
    });
  }

  const metList = criteria.filter(function (c) { return c.ok; });
  const unmetList = criteria.filter(function (c) { return !c.ok; });
  const total = criteria.length;
  const score = total === 0 ? 100 : Math.round((metList.length / total) * 100);

  // Full match = nothing unmet. Partial match = at least half of the requirements met.
  let level = 'none';
  if (unmetList.length === 0) level = 'full';
  else if (score >= 50) level = 'partial';

  const met = metList.map(function (c) { return c.good; });
  if (total === 0) met.push('Open to all students. There are no specific requirements to compare.');

  return { met: met, unmet: unmetList.map(function (c) { return c.bad; }), score: score, level: level };
}

// Returns every scholarship that fully or partially matches, best matches first
function computeMatches(p) {
  const matches = [];
  scholarships.forEach(function (s) {
    const result = checkEligibility(s, p);
    if (result.level !== 'none') matches.push({ scholarship: s, result: result });
  });
  matches.sort(function (a, b) {
    return (b.result.score - a.result.score) || a.scholarship.deadline.localeCompare(b.scholarship.deadline);
  });
  return matches;
}

// Reads the profile form and checks it. Returns { ok, errors, profile }
function readProfileForm() {
  const errors = [];
  const name = val('p-name').trim();
  const course = val('p-course');
  const year = Number(val('p-year'));
  const gwaText = val('p-gwa').trim();
  const incomeText = val('p-income').trim();
  const aid = val('p-aid');
  const interest = val('p-interest');
  const gwa = Number(gwaText);
  const income = Number(incomeText);

  if (!name) errors.push('Student name is required.');
  if (!course) errors.push('Please select your course or degree program.');
  if (!year) errors.push('Please select your year level.');
  if (gwaText === '' || isNaN(gwa) || gwa < 1 || gwa > 5) errors.push('GWA must be a number from 1.00 to 5.00.');
  if (incomeText === '' || isNaN(income) || income < 0) errors.push('Monthly family income must be a number (0 or higher).');
  if (!aid) errors.push('Please select your scholarship / financial assistance status.');
  if (!interest) errors.push('Please select your field of study or academic interest.');

  return {
    ok: errors.length === 0,
    errors: errors,
    profile: { name: name, course: course, yearLevel: year, gwa: gwa, income: income, aid: aid, interest: interest }
  };
}

function fillProfileForm() {
  const p = profile || {};
  $('p-name').value = p.name || (session && session.role === 'student' ? session.name : '') || '';
  $('p-course').value = p.course || '';
  $('p-year').value = p.yearLevel ? String(p.yearLevel) : '';
  $('p-gwa').value = p.gwa !== undefined ? p.gwa : '';
  $('p-income').value = p.income !== undefined ? p.income : '';
  $('p-aid').value = p.aid || 'none';
  $('p-interest').value = p.interest || '';
}

function showProfileErrors(errors) {
  const box = $('profile-errors');
  if (errors.length === 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = '<strong>Please fix the following:</strong><ul>' +
    errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
  box.classList.remove('hidden');
}

// "Save Profile" button
function handleSaveProfile() {
  const result = readProfileForm();
  showProfileErrors(result.errors);
  if (!result.ok) { showToast('Profile not saved. Please check the form.', 'error'); return false; }
  profile = result.profile;
  saveProfile();
  renderAll();
  if (matchingShown) renderMatchingResults();   // keep results in sync with the new profile
  showToast('Profile saved.');
  return true;
}

// "Find Matching Scholarships" button
function handleFindMatches() {
  const result = readProfileForm();
  showProfileErrors(result.errors);
  if (!result.ok) { showToast('Please complete your profile first.', 'error'); return; }
  profile = result.profile;
  saveProfile();
  matchingShown = true;
  renderAll();
  renderMatchingResults();
  showToast('Profile saved and matches found.');
  $('matching-results').scrollIntoView({ behavior: 'smooth' });
}

function renderMatchingResults() {
  const box = $('matching-results');
  if (!profile) { box.innerHTML = ''; return; }

  const matches = computeMatches(profile);
  const full = matches.filter(function (m) { return m.result.level === 'full'; }).length;
  const partial = matches.length - full;
  const notMatching = scholarships.length - matches.length;

  let html = '<h3 class="section-title">Matching Results for ' + esc(profile.name) + '</h3>';
  html += '<p class="results-summary">' + full + ' full match' + (full === 1 ? '' : 'es') + ', ' +
    partial + ' partial match' + (partial === 1 ? '' : 'es') + '. ' + notMatching + ' scholarship' +
    (notMatching === 1 ? '' : 's') + ' did not match enough requirements.</p>';

  if (matches.length === 0) {
    html += '<div class="card"><p>No scholarships matched your profile. Try the Marketplace to browse all listings.</p></div>';
  } else {
    html += '<div class="card-grid">';
    matches.forEach(function (m) {
      const s = m.scholarship;
      const levelBadge = m.result.level === 'full'
        ? '<span class="badge badge-green">Full match</span>'
        : '<span class="badge badge-amber">Partial match</span>';
      const closed = isClosed(s);

      html += '<div class="card">';
      html += '<div class="badges">' + levelBadge + '<span class="badge badge-gray">' + m.result.score + '% of requirements met</span>' +
        '<span class="badge badge-sample">Sample data</span></div>';
      html += '<h4 class="sch-title">' + esc(s.name) + '</h4>';
      html += '<div class="sch-provider">' + esc(s.provider) + '</div>';
      html += '<p>Deadline: <strong>' + formatDate(s.deadline) + '</strong> ' + deadlineBadge(s.deadline) + '</p>';
      html += '<div class="reason-box">';
      html += '<h4>Why it matches</h4><ul class="ok">' +
        m.result.met.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      if (m.result.unmet.length > 0) {
        html += '<h4>Unmet requirements</h4><ul class="bad">' +
          m.result.unmet.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div>';
      html += '<div class="card-actions">' +
        '<button class="btn btn-secondary btn-small" data-action="view" data-id="' + s.id + '">View Details</button>' +
        applyButton(s) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  box.innerHTML = html;
}


/* =====================================================================
   5. FEATURE 2 - SCHOLARSHIP MARKETPLACE
   ===================================================================== */

function applyButton(s) {
  if (isAdmin()) return '<button class="btn btn-secondary btn-small" data-action="admin-edit" data-id="' + s.id + '">Edit listing</button>';
  if (isClosed(s)) return '<button class="btn btn-gold btn-small" disabled>Closed</button>';
  return '<button class="btn btn-gold btn-small" data-action="apply" data-id="' + s.id + '">Apply Now</button>';
}

function yearsText(list) {
  return list.length === YEARS.length ? 'All year levels' : list.map(yearLabel).join(', ');
}

// Applies the search box, the three filters, and the sort order
function getFilteredScholarships() {
  const search = val('m-search').trim().toLowerCase();
  const course = val('f-course');
  const year = Number(val('f-year'));
  const type = val('f-type');
  const sort = val('m-sort');

  let list = scholarships.filter(function (s) {
    if (search && !(s.name.toLowerCase().includes(search) || s.provider.toLowerCase().includes(search))) return false;
    if (course && !(s.courses.includes('Any') || s.courses.includes(course))) return false;
    if (year && !s.yearLevels.includes(year)) return false;
    if (type && s.type !== type) return false;
    return true;
  });

  list.sort(function (a, b) {
    return sort === 'desc' ? b.deadline.localeCompare(a.deadline) : a.deadline.localeCompare(b.deadline);
  });
  return list;
}

function renderMarketplace() {
  const list = getFilteredScholarships();
  $('market-count').textContent = 'Showing ' + list.length + ' of ' + scholarships.length + ' scholarships (sample demonstration data).';

  if (list.length === 0) {
    $('market-list').innerHTML = '<div class="card"><p>No scholarships match your search or filters.</p></div>';
    return;
  }

  $('market-list').innerHTML = list.map(function (s) {
    return '<div class="card">' +
      '<div class="badges"><span class="badge badge-gray">' + esc(s.type) + '</div>' +
      '<h4 class="sch-title">' + esc(s.name) + '</h4>' +
      '<div class="sch-provider">' + esc(s.provider) + '</div>' +
      '<p class="sch-desc">' + esc(s.description) + '</p>' +
      '<ul class="info-list">' +
        '<li><strong>Programs:</strong> ' + esc(s.courses.includes('Any') ? 'Any program' : s.courses.join(', ')) + '</li>' +
        '<li><strong>Year levels:</strong> ' + esc(yearsText(s.yearLevels)) + '</li>' +
        '<li><strong>Minimum GWA:</strong> ' + (s.maxGWA !== null ? s.maxGWA.toFixed(2) + ' or better' : 'No requirement') + '</li>' +
        '<li><strong>Family income:</strong> ' + (s.maxIncome !== null ? 'Up to ' + peso(s.maxIncome) + ' per month' : 'No requirement') + '</li>' +
        '<li><strong>Benefits:</strong> ' + esc(s.benefits) + '</li>' +
        '<li><strong>Deadline:</strong> ' + formatDate(s.deadline) + ' ' + deadlineBadge(s.deadline) + '</li>' +
      '</ul>' +
      '<div class="card-actions">' +
        '<button class="btn btn-secondary btn-small" data-action="view" data-id="' + s.id + '">View Details</button>' +
        applyButton(s) +
      '</div></div>';
  }).join('');
}

function clearFilters() {
  $('m-search').value = '';
  $('f-course').value = '';
  $('f-year').value = '';
  $('f-type').value = '';
  $('m-sort').value = 'asc';
  renderMarketplace();
}

// Opens the pop-up with the full details of one scholarship
function openDetails(id) {
  const s = findScholarship(id);
  if (!s) return;

  let html = '<div class="badges"><span class="badge badge-gray">' + esc(s.type) + '</span>' +
    (s.isSample ? '<span class="badge badge-sample">Sample demonstration data - not an official listing</span>' : '') + '</div>';
  html += '<h3 id="modal-title">' + esc(s.name) + '</h3>';
  html += '<div class="sch-provider">' + esc(s.provider) + '</div>';
  html += '<p>' + esc(s.description) + '</p>';
  if (s.qualifications && s.qualifications.length) {
    html += '<div class="detail-section"><h4>Qualifications</h4><ul>' +
      s.qualifications.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul></div>';
  }

  html += '<div class="detail-section"><h4>Deadline</h4><p>' + formatDate(s.deadline) + ' ' + deadlineBadge(s.deadline) + '</p></div>';

  html += '<div class="detail-section"><h4>Eligibility</h4><ul class="info-list">' +
    '<li><strong>Programs:</strong> ' + esc(s.courses.includes('Any') ? 'Any program' : s.courses.join(', ')) + '</li>' +
    '<li><strong>Year levels:</strong> ' + esc(yearsText(s.yearLevels)) + '</li>' +
    '<li><strong>Field of study:</strong> ' + esc(s.fields.includes('Any') ? 'Any' : s.fields.join(', ')) + '</li>' +
    '<li><strong>Minimum GWA:</strong> ' + (s.maxGWA !== null ? s.maxGWA.toFixed(2) + ' or better' : 'No requirement') + '</li>' +
    '<li><strong>Monthly family income:</strong> ' + (s.maxIncome !== null ? 'Up to ' + peso(s.maxIncome) : 'No requirement') + '</li>' +
    '<li><strong>Other scholarships / assistance:</strong> ' + (s.allowsExistingAid ? 'Allowed' : 'Not allowed') + '</li>' +
    '</ul></div>';

  html += '<div class="detail-section"><h4>Benefits</h4><p>' + esc(s.benefits) + '</p></div>';
  html += '<div class="detail-section"><h4>Required documents</h4><ul>' +
    s.documents.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul></div>';
  html += '<div class="detail-section"><h4>How to apply</h4><p>' + esc(s.instructions) + '</p></div>';

  // If the logged-in student has a saved profile, show how they compare
  if (profile && !isAdmin()) {
    const r = checkEligibility(s, profile);
    const label = r.level === 'full' ? 'Full match' : (r.level === 'partial' ? 'Partial match' : 'Low match');
    html += '<div class="detail-section"><h4>Your eligibility check (' + label + ')</h4><div class="reason-box">' +
      '<ul class="ok">' + r.met.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      (r.unmet.length ? '<ul class="bad">' + r.unmet.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      '</div></div>';
  } else if (!isAdmin()) {
    html += '<div class="detail-section"><p class="muted">Save your profile in Scholarship Matching to see how you compare with these requirements.</p></div>';
  }

  html += '<div class="card-actions">' + applyButton(s);
  if (s.link && /^https?:\/\//i.test(s.link)) {
    html += '<a class="btn btn-secondary btn-small" href="' + esc(s.link) + '" target="_blank" rel="noopener">Open external page (sample link)</a>';
  }
  html += '<button class="btn btn-ghost btn-small" data-action="close-modal">Close</button></div>';

  $('modal-body').innerHTML = html;
  $('modal').classList.remove('hidden');
}

function closeModal() {
  document.querySelectorAll('#modal-body .preview-area').forEach(clearPreview);
  $('modal').classList.add('hidden');
}


/* =====================================================================
   5B. FILE STORAGE (IndexedDB) AND UPLOAD HELPERS
   Uploaded PDFs and images are kept in IndexedDB (not localStorage, because
   files are too large for it). localStorage only keeps the file's id and name.
   Everything stays inside this browser. Nothing is uploaded to a server.
   ===================================================================== */

const DB_NAME = 'iskolektib_files';
const DB_STORE = 'files';
const MAX_FILE_MB = 5;
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB is not available')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(DB_STORE, { keyPath: 'id' }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  return dbPromise;
}

// Runs one IndexedDB operation. "action" receives the object store and returns a request.
function dbRun(mode, action) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(DB_STORE, mode);
      const req = action(tx.objectStore(DB_STORE));
      tx.oncomplete = function () { resolve(req ? req.result : undefined); };
      tx.onerror = tx.onabort = function () { reject(tx.error); };
    });
  });
}

function saveFile(file) {
  const id = 'f' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  return dbRun('readwrite', function (s) {
    return s.put({ id: id, name: file.name, type: file.type, size: file.size, blob: file });
  }).then(function () { return id; });
}
function getFile(id) { return dbRun('readonly', function (s) { return s.get(id); }); }
function deleteFile(id) {
  if (!id) return Promise.resolve();
  return dbRun('readwrite', function (s) { return s.delete(id); }).catch(function () {});
}
function clearFiles() { return dbRun('readwrite', function (s) { return s.clear(); }).catch(function () {}); }

function sizeText(bytes) {
  return bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';
}

// Returns '' if the file is allowed, otherwise a friendly error message
function checkUpload(file, pdfOnly) {
  const name = file.name.toLowerCase();
  const okExt = pdfOnly ? /\.pdf$/.test(name) : /\.(pdf|jpg|jpeg|png)$/.test(name);
  const okMime = !file.type || (pdfOnly ? file.type === 'application/pdf' : ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type));
  if (!okExt || !okMime) return pdfOnly ? 'Please choose a PDF file (.pdf).' : 'Only PDF, JPG, JPEG or PNG files are allowed.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_MB * 1048576) return 'That file is ' + sizeText(file.size) + '. The maximum is ' + MAX_FILE_MB + ' MB per file.';
  return '';
}

// Table of documents with status badges and Preview / Download buttons.
// editable = true adds a file chooser to each row (used only in the draft form).
function docRowsHTML(docs, editable) {
  return '<div class="doc-block">' + docs.map(function (d, i) {
    const up = !!d.fileId;
    return '<div class="doc-row"><div class="doc-info"><strong>' + esc(d.name) + '</strong>' +
      '<div class="muted small">' + (up ? esc(d.fileName) + ' (' + sizeText(d.fileSize) + ')' : 'No file uploaded') + '</div></div>' +
      '<span class="badge ' + (up ? 'badge-green' : 'badge-amber') + '">' + (up ? 'Uploaded' : 'Not Yet Uploaded') + '</span>' +
      '<div class="doc-actions">' +
      (editable ? '<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" data-action="doc-file" data-index="' + i + '" aria-label="Upload ' + esc(d.name) + '">' : '') +
      (up ? '<button type="button" class="btn btn-secondary btn-small" data-action="file-preview" data-file="' + esc(d.fileId) + '">Preview</button>' +
            '<button type="button" class="btn btn-secondary btn-small" data-action="file-download" data-file="' + esc(d.fileId) + '">Download</button>' : '') +
      '</div></div>';
  }).join('') + '<div class="preview-area"></div></div>';
}

function clearPreview(area) {
  if (area && area.dataset.url) { URL.revokeObjectURL(area.dataset.url); area.dataset.url = ''; }
  if (area) area.innerHTML = '';
}

// Shows a PDF (in a frame) or an image right under the document list
async function previewFile(fileId, area) {
  if (!area) return;
  clearPreview(area);
  try {
    const rec = await getFile(fileId);
    if (!rec) { area.innerHTML = '<div class="alert alert-error">This file was not found in the browser storage.</div>'; return; }
    const isPdf = /\.pdf$/i.test(rec.name);
    const url = URL.createObjectURL(new Blob([rec.blob], { type: isPdf ? 'application/pdf' : rec.type }));
    area.dataset.url = url;
    area.innerHTML = '<div class="preview-head"><strong>' + esc(rec.name) + '</strong>' +
      '<button type="button" class="btn btn-ghost btn-small" data-action="preview-close">Close preview</button></div>' +
      (isPdf ? '<iframe class="preview-frame" src="' + url + '" title="PDF preview"></iframe>'
             : '<img class="preview-img" src="' + url + '" alt="' + esc(rec.name) + '">');
  } catch (e) {
    area.innerHTML = '<div class="alert alert-error">Could not open the file.</div>';
  }
}

async function downloadFile(fileId) {
  try {
    const rec = await getFile(fileId);
    if (!rec) { showToast('File not found in this browser.', 'error'); return; }
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement('a');
    a.href = url; a.download = rec.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  } catch (e) { showToast('Could not download the file.', 'error'); }
}

// Student form: a file was chosen for requirement number "index"
async function handleDocFile(input) {
  const i = Number(input.dataset.index);
  const file = input.files[0];
  const current = editingAppId ? findApp(editingAppId) : null;
  if (current && current.status !== 'Draft') { showToast('This application is locked. Documents cannot be changed.', 'error'); return; }
  if (!file || !formDocs[i]) return;
  const problem = checkUpload(file, false);
  if (problem) { showToast(problem, 'error'); input.value = ''; return; }
  try {
    const id = await saveFile(file);
    formDocs[i].fileId = id;
    formDocs[i].fileName = file.name;
    formDocs[i].fileType = file.type;
    formDocs[i].fileSize = file.size;
    renderFormDocsList();
    showToast('"' + file.name + '" attached to ' + formDocs[i].name + '.');
  } catch (e) {
    showToast('Could not store the file in this browser.', 'error');
    input.value = '';
  }
}


/* =====================================================================
   6. FEATURE 3 - APPLICATION MANAGEMENT
   Each application is an object like:
   { id, scholarshipId, status, dateSubmitted, name, email, contact, course,
     yearLevel, gwa, income, statement,
     documents: [ { name, done, fileId, fileName, fileType, fileSize } ],
     adminNote (shown when the admin marks it Incomplete),
     disbursement: { status, date, amount } }
   ===================================================================== */

function showAppForm(show) {
  $('app-list-view').classList.toggle('hidden', show);
  $('app-form-view').classList.toggle('hidden', !show);
}

function showFormErrors(errors) {
  const box = $('app-errors');
  if (errors.length === 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = '<strong>Please fix the following:</strong><ul>' +
    errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
  box.classList.remove('hidden');
}

// Students can only open the form for new applications and drafts, so the buttons are always Submit + Save Draft
function setFormButtons() {
  $('af-submit').classList.remove('hidden');
  $('af-draft').classList.remove('hidden');
}

// Shows one upload row per required document and a short info box for the chosen scholarship
function renderFormDocsList() {
  $('af-docs').innerHTML = docRowsHTML(formDocs, true);
}

function renderFormDocs(app) {
  const s = findScholarship(Number(val('af-scholarship')));
  if (!s) {
    formDocs = [];
    $('af-docs').innerHTML = '<p class="muted">Choose a scholarship to see its required documents.</p>';
    $('af-scholarship-info').innerHTML = '';
    return;
  }
  formDocs = (app ? app.documents : s.documents.map(function (name) { return { name: name }; })).map(function (d) {
    return { name: d.name, fileId: d.fileId || '', fileName: d.fileName || '', fileType: d.fileType || '', fileSize: d.fileSize || 0 };
  });
  renderFormDocsList();

  $('af-scholarship-info').innerHTML = '<div class="alert alert-info"><strong>' + esc(s.provider) + '</strong> &middot; Deadline: ' +
    formatDate(s.deadline) + ' ' + deadlineBadge(s.deadline) + '<br>Benefits: ' + esc(s.benefits) +
    '<br>How to apply: ' + esc(s.instructions) + '</div>';
}

function openNewAppForm(prefilledId) {
  editingAppId = null;
  const openOnes = scholarships.filter(function (s) { return !isClosed(s); });
  fillSelect('af-scholarship', openOnes.map(function (s) { return { value: s.id, label: s.name }; }), 'Select a scholarship');
  $('af-scholarship').disabled = false;
  if (prefilledId) $('af-scholarship').value = String(prefilledId);

  // Pre-fill personal details from the saved profile so the student does not retype them
  const p = profile || {};
  $('af-name').value = p.name || '';
  $('af-email').value = '';
  $('af-contact').value = '';
  $('af-course').value = p.course || '';
  $('af-year').value = p.yearLevel ? String(p.yearLevel) : '';
  $('af-gwa').value = p.gwa !== undefined ? p.gwa : '';
  $('af-income').value = p.income !== undefined ? p.income : '';
  $('af-statement').value = '';

  $('app-form-title').textContent = 'New Scholarship Application';
  setFormButtons();
  showFormErrors([]);
  renderFormDocs(null);
  showAppForm(true);
}

function openEditForm(app) {
  editingAppId = app.id;
  const s = findScholarship(app.scholarshipId);
  fillSelect('af-scholarship', [{ value: app.scholarshipId, label: s ? s.name : 'Unknown scholarship' }]);
  $('af-scholarship').value = String(app.scholarshipId);
  $('af-scholarship').disabled = true;   // the scholarship of an existing application cannot be changed

  $('af-name').value = app.name || '';
  $('af-email').value = app.email || '';
  $('af-contact').value = app.contact || '';
  $('af-course').value = app.course || '';
  $('af-year').value = app.yearLevel ? String(app.yearLevel) : '';
  $('af-gwa').value = app.gwa !== '' && app.gwa !== undefined ? app.gwa : '';
  $('af-income').value = app.income !== '' && app.income !== undefined ? app.income : '';
  $('af-statement').value = app.statement || '';

  $('app-form-title').textContent = 'Edit Draft Application';
  setFormButtons();
  showFormErrors([]);
  renderFormDocs(app);
  showAppForm(true);
}

// Called by "Apply Now" buttons anywhere in the app
function startApplication(id) {
  if (isAdmin()) return;   // only students apply
  const s = findScholarship(id);
  if (!s) return;
  if (isClosed(s)) { showToast('The deadline for this scholarship has passed.', 'error'); return; }

  showPage('applications');
  const existing = applications.find(function (a) { return a.scholarshipId === id; });
  if (!existing) {
    openNewAppForm(id);
  } else if (EDITABLE_STATUSES.includes(existing.status)) {
    openEditForm(existing);
    showToast('You already have a draft for this scholarship. Opening it.', 'info');
  } else {
    showToast('You already submitted an application for this scholarship (status: ' + existing.status + '). It is locked.', 'info');
  }
}

// Reads all fields of the application form into one object
function readAppForm() {
  return {
    scholarshipId: Number(val('af-scholarship')),
    name: val('af-name').trim(),
    email: val('af-email').trim(),
    contact: val('af-contact').trim(),
    course: val('af-course'),
    yearLevel: Number(val('af-year')),
    gwaText: val('af-gwa').trim(),
    incomeText: val('af-income').trim(),
    statement: val('af-statement').trim()
  };
}

// Returns a list of error messages (empty list = form is valid)
function validateAppForm(f, strict) {
  const errors = [];
  if (!f.scholarshipId) errors.push('Please choose a scholarship.');
  if (strict) {
    const gwa = Number(f.gwaText);
    const income = Number(f.incomeText);
    if (!f.name) errors.push('Full name is required.');
    if (!f.email) errors.push('Email address is required.');
    else if (!/^\S+@\S+\.\S+$/.test(f.email)) errors.push('Please enter a valid email address.');
    if (!f.course) errors.push('Course / degree program is required.');
    if (!f.yearLevel) errors.push('Year level is required.');
    if (f.gwaText === '' || isNaN(gwa) || gwa < 1 || gwa > 5) errors.push('GWA must be a number from 1.00 to 5.00.');
    if (f.incomeText === '' || isNaN(income) || income < 0) errors.push('Monthly family income must be a number (0 or higher).');
    if (!f.statement) errors.push('Please explain why you are applying.');
  }
  return errors;
}

// Reads the document checkboxes from the form


// mode is 'draft' (save draft), 'submit' (submit), or 'update' (save changes to an existing application)
// mode is 'draft' (save draft) or 'submit' (final submission, which locks the application)
function saveApplication(mode) {
  const f = readAppForm();
  const errors = validateAppForm(f, mode === 'submit');
  const scholarship = findScholarship(f.scholarshipId);
  const existingApp = editingAppId ? findApp(editingAppId) : null;

  if (existingApp && existingApp.status !== 'Draft') {
    showToast('This application is locked and can no longer be edited.', 'error');
    return;
  }
  if (scholarship && mode === 'submit' && isClosed(scholarship)) {
    errors.push('The deadline for this scholarship has passed, so it cannot be submitted.');
  }
  if (f.scholarshipId && applications.some(function (a) { return a.scholarshipId === f.scholarshipId && a.id !== editingAppId; })) {
    errors.push('You already have an application for this scholarship. Edit it from the My Applications list instead.');
  }
  if (mode === 'submit') {
    formDocs.forEach(function (d) { if (!d.fileId) errors.push('Missing required document: ' + d.name + '. Please upload it.'); });
  }
  if (errors.length > 0) {
    showFormErrors(errors);
    showToast('Application not saved. Please fix the errors.', 'error');
    return;
  }
  if (mode === 'submit' && !confirm('Are you sure you want to submit this application?\n\nOnce submitted, your information and documents will be LOCKED. You will not be able to edit them, replace files, delete files, or upload more requirements.')) return;

  let app = existingApp;
  if (!app) {
    app = {
      id: newAppId(),
      scholarshipId: f.scholarshipId,
      status: 'Draft',
      dateSubmitted: '',
      disbursement: { status: 'Not Yet Approved', date: '', amount: scholarship.benefitAmount }
    };
    applications.push(app);
  }

  app.name = f.name;
  app.email = f.email;
  app.contact = f.contact;
  app.course = f.course;
  app.yearLevel = f.yearLevel;
  app.gwa = f.gwaText === '' ? '' : Number(f.gwaText);
  app.income = f.incomeText === '' ? '' : Number(f.incomeText);
  app.statement = f.statement;
  app.documents = formDocs.map(function (d) {
    return { name: d.name, done: !!d.fileId, fileId: d.fileId, fileName: d.fileName, fileType: d.fileType, fileSize: d.fileSize };
  });

  if (mode === 'submit') {
    app.status = 'Submitted';
    app.dateSubmitted = todayISO();
  }

  saveApplications();
  renderAll();
  showAppForm(false);
  editingAppId = null;

  if (mode === 'submit') showToast(LOCK_MESSAGE, 'success');
  else showToast('Draft saved. You can still edit it before submitting.');
}

// Called when the status dropdown on an application card changes (demonstration control)
// Used by the admin (Student Applications). The note is only kept for "Incomplete".
function changeStatus(id, newStatus, note) {
  const app = findApp(id);
  if (!app || !isAdmin()) return;
  if (app.status === newStatus && (app.adminNote || '') === (note || '')) return;

  app.status = newStatus;
  app.adminNote = note || '';

  // Disbursement only applies to approved applications
  if (newStatus === 'Approved') {
    if (app.disbursement.status === 'Not Yet Approved') app.disbursement.status = 'Pending';
  } else {
    app.disbursement.status = 'Not Yet Approved';
  }

  saveApplications();
  renderAll();
  showToast('Status changed to "' + newStatus + '". The student can see it in My Applications.');
}



function deleteApplication(id) {
  const app = findApp(id);
  if (!app) return;
  if (app.status !== 'Draft') { showToast('Submitted applications are locked and cannot be deleted.', 'error'); return; }
  const s = findScholarship(app.scholarshipId);
  if (!confirm('Delete your draft for "' + (s ? s.name : 'this scholarship') + '" and its uploaded files? This cannot be undone.')) return;
  app.documents.forEach(function (d) { deleteFile(d.fileId); });
  applications = applications.filter(function (a) { return a.id !== id; });
  saveApplications();
  renderAll();
  showToast('Draft deleted.');
}

const LOCK_MESSAGE = 'Your application has been successfully submitted. Your submitted information and documents are now locked and can no longer be edited.';

function renderApplications() {
  const box = $('app-list');
  if (applications.length === 0) {
    box.innerHTML = '<div class="card"><p>You have no applications yet.</p>' +
      '<p class="muted">Use "New Application" above, or click "Apply Now" on any scholarship in the Marketplace.</p></div>';
    return;
  }

  // Newest first
  const sorted = applications.slice().sort(function (a, b) { return b.id - a.id; });

  box.innerHTML = sorted.map(function (app) {
    const s = findScholarship(app.scholarshipId) || { name: 'Removed scholarship', provider: '-', deadline: '' };
    const uploaded = app.documents.filter(function (d) { return d.fileId; }).length;
    const isDraft = app.status === 'Draft';

    let html = '<div class="card app-card">';
    html += '<div class="app-head"><div><h4 class="sch-title">' + esc(s.name) + '</h4>' +
      '<div class="sch-provider">' + esc(s.provider) + '</div></div>' + statusBadge(app.status) + '</div>';

    html += '<div class="app-meta">' +
      '<div><span>Applicant</span>' + esc(app.name || '(no name yet)') + '</div>' +
      '<div><span>Date submitted</span>' + (app.dateSubmitted ? formatDate(app.dateSubmitted) : 'Not submitted yet') + '</div>' +
      '<div><span>Application deadline</span>' + (s.deadline ? formatDate(s.deadline) + ' ' + deadlineBadge(s.deadline) : '-') + '</div>' +
      '</div>';

    html += '<div class="checklist"><h4>Documents (' + uploaded + ' of ' + app.documents.length + ' uploaded)</h4>' + docRowsHTML(app.documents, false) + '</div>';

    if (isDraft) {
      html += '<div class="alert alert-warn">Draft: not submitted yet. You can still edit it and upload documents.</div>';
    } else {
      html += '<div class="alert alert-ok lock-note">&#128274; ' + esc(LOCK_MESSAGE) + '</div>';
    }
    if (app.status === 'Incomplete') {
      html += '<div class="alert alert-warn"><strong>Reviewer note:</strong> ' + esc(app.adminNote || 'Some requirements are missing or incorrect. Please contact the scholarship office.') +
        '<br><small>In this prototype, locked applications cannot be edited. Please contact the scholarship office.</small></div>';
    }

    html += '<div class="card-actions">' +
      (isDraft
        ? '<button class="btn btn-secondary btn-small" data-action="edit-app" data-id="' + app.id + '">Edit / Submit</button>' +
          '<button class="btn btn-danger btn-small" data-action="delete-app" data-id="' + app.id + '">Delete draft</button>'
        : '<button class="btn btn-secondary btn-small" disabled title="Submitted applications are locked">Locked</button>') +
      '</div></div>';
    return html;
  }).join('');
}


/* =====================================================================
   7. FEATURE 4 - TRACKING & DISBURSEMENT
   Everything here is entered manually. The app cannot check real fund releases.
   ===================================================================== */

// Works out the state of each of the 5 timeline steps: done / current / delayed / todo
function getTimeline(app) {
  const states = ['todo', 'todo', 'todo', 'todo', 'todo'];
  const d = app.disbursement.status;
  states[0] = 'done';   // only submitted applications appear in tracking

  if (['Submitted', 'Under Review', 'Verified', 'Incomplete'].includes(app.status)) {
    states[1] = 'current';
  } else if (app.status === 'Approved') {
    states[1] = 'done';
    states[2] = 'done';
    if (d === 'Processing') states[3] = 'current';
    else if (d === 'Delayed') states[3] = 'delayed';
    else if (d === 'Released') { states[3] = 'done'; states[4] = 'done'; }
  }
  return states;
}

function renderTracking() {
  const box = $('tracking-list');
  // Drafts have not been submitted and rejected applications get no funds
  const tracked = applications.filter(function (a) { return a.status !== 'Draft' && a.status !== 'Rejected'; });
  const hiddenCount = applications.length - tracked.length;

  if (tracked.length === 0) {
    box.innerHTML = '<div class="card"><p>No submitted applications to track yet.</p>' +
      '<p class="muted">Submit an application in My Applications. It will appear here' +
      (hiddenCount > 0 ? ' (' + hiddenCount + ' draft or rejected application' + (hiddenCount === 1 ? ' is' : 's are') + ' not shown).' : '.') + '</p></div>';
    return;
  }

  let html = '';
  tracked.forEach(function (app) {
    const s = findScholarship(app.scholarshipId) || { name: 'Removed scholarship', provider: '-', compliance: [], renewal: '-' };
    const dis = app.disbursement;
    const locked = app.status !== 'Approved';
    const delayed = dis.status === 'Delayed' && !locked;
    const timeline = getTimeline(app);

    html += '<div class="card track-card' + (delayed ? ' delayed' : '') + '" data-app-id="' + app.id + '">';
    html += '<div class="app-head"><div><h4 class="sch-title">' + esc(s.name) + '</h4><div class="sch-provider">' + esc(s.provider) + '</div></div>' +
      '<div class="badges">' + statusBadge(app.status) + disbBadge(dis.status) + '</div></div>';

    if (delayed) {
      html += '<div class="delay-banner">&#9888; DELAYED: this disbursement is marked as delayed. Follow up with the scholarship office.</div>';
    }
    if (!locked && dis.date && dis.status !== 'Released' && daysUntil(dis.date) < 0) {
      html += '<div class="alert alert-warn">The scheduled disbursement date has passed but the funds are not marked as Released.</div>';
    }
    if (app.status === 'Incomplete') {
      html += '<div class="alert alert-warn">The reviewer marked your application Incomplete. See the note in My Applications.</div>';
    }

    // Timeline
    html += '<ol class="timeline">' + TIMELINE_STEPS.map(function (label, i) {
      const st = timeline[i];
      const mark = st === 'done' ? '&#10003;' : (st === 'delayed' ? '!' : (i + 1));
      return '<li class="tl-step ' + st + '"><span class="tl-dot">' + mark + '</span><span class="tl-label">' + esc(label) + '</span></li>';
    }).join('') + '</ol>';

    // Details and editable demonstration fields
    html += '<div class="track-grid">' +
      '<div class="field"><label>Approval status</label><div>' + (app.status === 'Approved' ? '<strong>Approved</strong>' : 'Not yet approved') + '</div></div>' +
      '<div class="field"><label>Disbursement status</label><select class="t-status"' + (locked ? ' disabled' : '') + '>' +
        DISB_STATUSES.map(function (ds) { return '<option value="' + esc(ds) + '"' + (ds === dis.status ? ' selected' : '') + '>' + esc(ds) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Expected / scheduled disbursement date</label><input type="date" class="t-date" value="' + esc(dis.date) + '"' + (locked ? ' disabled' : '') + '></div>' +
      '<div class="field"><label>Amount of assistance (PHP)</label><input type="number" class="t-amount" min="0" step="100" value="' + esc(dis.amount) + '"' + (locked ? ' disabled' : '') + '></div>' +
      '</div>';

    if (locked) {
      html += '<p class="muted">Disbursement fields unlock once the application is Approved. (They unlock when the admin sets the application to Approved.)</p>';
    } else {
      html += '<div class="card-actions"><button class="btn btn-primary btn-small" data-action="save-tracking" data-id="' + app.id + '">Save Tracking Update</button></div>';
    }

    // Compliance and renewal requirements
    html += '<div class="two-lists"><div><h4>Compliance requirements</h4><ul>' +
      (s.compliance && s.compliance.length ? s.compliance.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') : '<li>None listed</li>') +
      '</ul></div><div><h4>Renewal requirements</h4><p>' + esc(s.renewal) + '</p></div></div>';

    html += '</div>';
  });

  if (hiddenCount > 0) {
    html += '<p class="muted">' + hiddenCount + ' draft or rejected application' + (hiddenCount === 1 ? ' is' : 's are') + ' not shown here.</p>';
  }
  box.innerHTML = html;
}

// Saves the disbursement fields of one tracking card
function saveTracking(id, card) {
  const app = findApp(id);
  if (!app || !card) return;
  if (app.status !== 'Approved') { showToast('Only approved applications can have disbursement updates.', 'error'); return; }

  const amountText = card.querySelector('.t-amount').value.trim();
  const amount = Number(amountText);
  if (amountText === '' || isNaN(amount) || amount < 0) {
    showToast('Please enter a valid amount (0 or higher).', 'error');
    return;
  }

  app.disbursement = {
    status: card.querySelector('.t-status').value,
    date: card.querySelector('.t-date').value,
    amount: amount
  };
  saveApplications();
  renderAll();
  showToast('Tracking information updated.');
}


/* =====================================================================
   8. DASHBOARD
   ===================================================================== */

function statCard(label, value, sub, colorClass) {
  return '<div class="stat ' + (colorClass || '') + '"><div class="stat-value">' + value + '</div>' +
    '<div class="stat-label">' + label + '</div><div class="stat-sub">' + sub + '</div></div>';
}

function renderDashboard() {
  const openOnes = scholarships.filter(function (s) { return !isClosed(s); });

  // Matching count (uses the saved profile)
  let matchValue = '-';
  let matchSub = 'Save your profile first';
  let matches = [];
  if (profile) {
    matches = computeMatches(profile);
    const full = matches.filter(function (m) { return m.result.level === 'full'; }).length;
    matchValue = matches.length;
    matchSub = full + ' full, ' + (matches.length - full) + ' partial';
  }

  const underReview = applications.filter(function (a) { return a.status === 'Under Review'; }).length;
  const approved = applications.filter(function (a) { return a.status === 'Approved'; }).length;
  const pendingOrDelayed = applications.filter(function (a) {
    return a.status === 'Approved' && (a.disbursement.status === 'Pending' || a.disbursement.status === 'Delayed');
  });
  const delayedCount = pendingOrDelayed.filter(function (a) { return a.disbursement.status === 'Delayed'; }).length;

  $('stats-grid').innerHTML =
    statCard('Available scholarships', scholarships.length, openOnes.length + ' still open', '') +
    statCard('Matching your profile', matchValue, matchSub, 'gold') +
    statCard('Total applications', applications.length, applications.filter(function (a) { return a.status === 'Draft'; }).length + ' draft(s)', '') +
    statCard('Under review', underReview, 'applications', '') +
    statCard('Approved', approved, 'applications', 'green') +
    statCard('Pending or delayed disbursements', pendingOrDelayed.length, delayedCount + ' delayed', delayedCount > 0 ? 'red' : '');

  $('welcome-title').textContent = profile ? 'Welcome, ' + profile.name + '!' : 'Welcome, Iskx!';

  // Upcoming deadlines: next 5 open scholarships
  const upcoming = openOnes.slice().sort(function (a, b) { return a.deadline.localeCompare(b.deadline); }).slice(0, 5);
  $('dash-deadlines').innerHTML = upcoming.length === 0 ? '<p class="muted">No open scholarships.</p>' :
    upcoming.map(function (s) {
      return '<div class="list-item"><div><div class="title">' + esc(s.name) + '</div><div class="meta">' + formatDate(s.deadline) + '</div></div>' +
        '<div>' + deadlineBadge(s.deadline) + ' <button class="btn btn-secondary btn-small" data-action="view" data-id="' + s.id + '">View</button></div></div>';
    }).join('');

  // Recently submitted applications (drafts are not submitted yet)
  const recent = applications.filter(function (a) { return a.status !== 'Draft' && a.dateSubmitted; })
    .sort(function (a, b) { return b.dateSubmitted.localeCompare(a.dateSubmitted) || b.id - a.id; }).slice(0, 5);
  $('dash-recent').innerHTML = recent.length === 0 ? '<p class="muted">No submitted applications yet.</p>' :
    recent.map(function (a) {
      const s = findScholarship(a.scholarshipId);
      return '<div class="list-item"><div><div class="title">' + esc(s ? s.name : 'Removed scholarship') + '</div>' +
        '<div class="meta">Submitted ' + formatDate(a.dateSubmitted) + '</div></div>' + statusBadge(a.status) + '</div>';
    }).join('');

  // Recommendations: top 3 matching scholarships that are still open
  if (!profile) {
    $('dash-recs').innerHTML = '<p class="muted">Save your student profile to see personalized recommendations.</p>' +
      '<button class="btn btn-gold btn-small" data-action="goto" data-page="matching">Create my profile</button>';
  } else {
    const recs = matches.filter(function (m) { return !isClosed(m.scholarship); }).slice(0, 3);
    $('dash-recs').innerHTML = recs.length === 0 ? '<p class="muted">No open scholarships match your profile right now.</p>' :
      recs.map(function (m) {
        return '<div class="list-item"><div><div class="title">' + esc(m.scholarship.name) + '</div>' +
          '<div class="meta">' + esc(m.scholarship.provider) + ' &middot; deadline ' + formatDate(m.scholarship.deadline) + '</div></div>' +
          '<div>' + (m.result.level === 'full' ? '<span class="badge badge-green">Full match</span>' : '<span class="badge badge-amber">Partial match</span>') +
          ' <button class="btn btn-secondary btn-small" data-action="view" data-id="' + m.scholarship.id + '">Details</button></div></div>';
      }).join('');
  }
}

// Re-draws every section. Called after any change so all numbers stay up to date.
function renderAll() {
  renderRoleInfo();
  renderDashboard();
  renderMarketplace();
  renderApplications();
  renderTracking();
  renderManage();
  renderAdminApps();
}


/* =====================================================================
   8B. SIGN-IN, ROLES AND ADMIN SCHOLARSHIP MANAGEMENT
   There are two roles:
     - "student": uses Dashboard, Matching, Marketplace, My Applications, Tracking
     - "admin":   scholarship office staff. Adds, edits and deletes scholarship
                  listings (Manage Scholarships) and can browse the Marketplace.
   Listings added by admin staff are saved in the same localStorage data that
   students read, so they show up in the Marketplace and Matching right away.

   IMPORTANT: this is a DEMONSTRATION sign-in. Everything runs in the browser,
   so anyone can bypass it. A real system needs a server to check logins.
   ===================================================================== */

// DEMO ONLY: anyone who views the page source can read this passcode.
const ADMIN_PASSCODE = 'admin123';

// Which pages each role may open
const ROLE_PAGES = {
  student: ['dashboard', 'matching', 'marketplace', 'applications', 'tracking'],
  admin: ['manage', 'adminapps', 'marketplace']
};

let selectedRole = 'student';   // the role chosen on the sign-in screen

function isAdmin() { return !!session && session.role === 'admin'; }
function defaultPage() { return isAdmin() ? 'manage' : 'dashboard'; }
function pageAllowed(name) { return !!session && ROLE_PAGES[session.role].includes(name); }

// ----- Sign-in screen -----
function pickRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-card').forEach(function (b) {
    b.classList.toggle('selected', b.dataset.role === role);
  });
  $('login-admin-fields').classList.toggle('hidden', role !== 'admin');
  $('login-name-label').textContent = role === 'admin' ? 'Staff name *' : 'Your name (optional)';
  showLoginError('');
}

function showLoginError(message) {
  const box = $('login-error');
  if (!message) { box.classList.add('hidden'); box.textContent = ''; return; }
  box.textContent = message;
  box.classList.remove('hidden');
}

function handleSignIn() {
  const name = val('login-name').trim();
  if (selectedRole === 'admin') {
    if (!name) { showLoginError('Please enter your staff name.'); return; }
    if (val('login-pass') !== ADMIN_PASSCODE) { showLoginError('Incorrect staff passcode.'); return; }
  }
  session = { role: selectedRole, name: name };
  saveJSON(KEYS.session, session);
  fillProfileForm();   // a student's sign-in name pre-fills the profile form
  $('login-name').value = '';
  $('login-pass').value = '';
  showLoginError('');
  showSessionScreen();
  showToast('Signed in as ' + (isAdmin() ? 'Admin Staff' : 'Student') + (name ? ' (' + name + ')' : '') + '.');
}

function signOut() {
  session = null;
  saveJSON(KEYS.session, null);
  closeModal();
  closeMenu();
  editingAppId = null;
  editingScholarshipId = null;
  pickRole('student');
  showSessionScreen();
  showToast('You have signed out.', 'info');
}

// Shows the sign-in screen when nobody is signed in, otherwise the app
function showSessionScreen() {
  if (!session) {
    document.body.classList.add('logged-out');
    return;
  }
  document.body.classList.remove('logged-out');
  applyRole();
  showPage(defaultPage());
}

// Shows only the navigation buttons that the signed-in role may use
function applyRole() {
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    const roles = (b.dataset.roles || '').split(' ');
    b.classList.toggle('hidden', !roles.includes(session.role));
  });
}

// Role label in the sidebar and the name chip in the top bar
function renderRoleInfo() {
  if (!session) return;
  $('role-info').innerHTML = '<span class="badge">' + (isAdmin() ? 'Admin Staff' : 'Student') + '</span>' +
    (session.name ? '<div class="role-name">' + esc(session.name) + '</div>' : '');
  if (isAdmin()) $('student-chip').textContent = 'Admin: ' + (session.name || 'staff');
  else $('student-chip').textContent = profile ? profile.name : (session.name || 'No profile yet');
}

// ----- Admin: scholarship form helpers -----
function linesOf(text) {
  return text.split(/\r?\n/).map(function (t) { return t.trim(); }).filter(function (t) { return t !== ''; });
}

function checkGroupHTML(name, items) {
  return items.map(function (it) {
    return '<label class="check"><input type="checkbox" name="' + name + '" value="' + esc(it.value) + '"> ' + esc(it.label) + '</label>';
  }).join('');
}

function checkedValues(name) {
  return Array.from(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function (b) { return b.value; });
}

function setChecked(name, values) {
  const wanted = values.map(String);
  document.querySelectorAll('input[name="' + name + '"]').forEach(function (b) { b.checked = wanted.includes(b.value); });
}

// Builds the checkbox lists and the type dropdown of the admin form (runs once at start-up)
function buildScholarshipFormChoices() {
  fillSelect('sch-type', TYPES, 'Select a type');
  $('sch-courses').innerHTML = checkGroupHTML('sch-course',
    [{ value: 'Any', label: 'Any program' }].concat(COURSES.filter(function (c) { return c !== 'Other'; }).map(function (c) { return { value: c, label: c }; })));
  $('sch-years').innerHTML = checkGroupHTML('sch-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }));
  $('sch-fields').innerHTML = checkGroupHTML('sch-field',
    [{ value: 'Any', label: 'Any' }].concat(INTERESTS.filter(function (i) { return i !== 'Undecided / Other'; }).map(function (i) { return { value: i, label: i }; })));
}

function showScholarshipForm(show) {
  $('sch-list-view').classList.toggle('hidden', show);
  $('sch-form-view').classList.toggle('hidden', !show);
}

function showSchErrors(errors) {
  const box = $('sch-errors');
  if (errors.length === 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = '<strong>Please fix the following:</strong><ul>' +
    errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
  box.classList.remove('hidden');
}

// Opens the form empty (add) or filled with an existing listing (edit)
function openScholarshipForm(id) {
  if (!isAdmin()) return;
  const s = id ? findScholarship(id) : null;
  editingScholarshipId = s ? s.id : null;
  $('sch-form-title').textContent = s ? 'Edit Scholarship' : 'Add Scholarship';
  $('sch-save-btn').textContent = s ? 'Save Scholarship' : 'Publish Scholarship';
  $('sch-review-note').classList.add('hidden');
  discardPendingAnn();
  pendingAnn = s && s.announcementFileId ? { fileId: s.announcementFileId, name: s.announcementName || 'announcement.pdf', size: s.announcementSize || 0, isNew: false } : null;
  renderAnnBox();

  const d = s || {
    name: '', provider: '', type: '', description: '', qualifications: [], courses: [], yearLevels: [], fields: [],
    maxGWA: null, maxIncome: null, allowsExistingAid: true, benefits: '', benefitAmount: '',
    documents: [], deadline: '', instructions: '', link: '', compliance: [], renewal: ''
  };
  $('sch-name').value = d.name;
  $('sch-provider').value = d.provider;
  $('sch-type').value = d.type;
  $('sch-deadline').value = d.deadline;
  $('sch-desc').value = d.description;
  $('sch-qualifications').value = (d.qualifications || []).join('\n');
  setChecked('sch-course', d.courses);
  setChecked('sch-year', d.yearLevels);
  setChecked('sch-field', d.fields);
  $('sch-gwa').value = d.maxGWA === null ? '' : d.maxGWA;
  $('sch-income').value = d.maxIncome === null ? '' : d.maxIncome;
  $('sch-aid').checked = d.allowsExistingAid;
  $('sch-benefits').value = d.benefits;
  $('sch-amount').value = d.benefitAmount;
  $('sch-docs').value = d.documents.join('\n');
  $('sch-instructions').value = d.instructions;
  $('sch-link').value = d.link || '';
  $('sch-compliance').value = d.compliance.join('\n');
  $('sch-renewal').value = d.renewal;

  showSchErrors([]);
  showScholarshipForm(true);
}

function readScholarshipForm() {
  let courses = checkedValues('sch-course');
  if (courses.includes('Any')) courses = ['Any'];
  let fields = checkedValues('sch-field');
  if (fields.includes('Any')) fields = ['Any'];
  return {
    name: val('sch-name').trim(),
    provider: val('sch-provider').trim(),
    type: val('sch-type'),
    deadline: val('sch-deadline'),
    description: val('sch-desc').trim(),
    qualifications: linesOf(val('sch-qualifications')),
    courses: courses,
    yearLevels: checkedValues('sch-year').map(Number).sort(function (a, b) { return a - b; }),
    fields: fields,
    gwaText: val('sch-gwa').trim(),
    incomeText: val('sch-income').trim(),
    allowsExistingAid: $('sch-aid').checked,
    benefits: val('sch-benefits').trim(),
    amountText: val('sch-amount').trim(),
    documents: linesOf(val('sch-docs')),
    instructions: val('sch-instructions').trim(),
    link: val('sch-link').trim(),
    compliance: linesOf(val('sch-compliance')),
    renewal: val('sch-renewal').trim()
  };
}

// Returns a list of error messages (empty list = valid)
function validateScholarship(f) {
  const errors = [];
  if (!f.name) errors.push('Scholarship name is required.');
  if (!f.provider) errors.push('Provider is required.');
  if (!f.type) errors.push('Please select a scholarship type.');
  if (!f.description) errors.push('Description is required.');
  if (f.courses.length === 0) errors.push('Select at least one eligible program (or "Any program").');
  if (f.yearLevels.length === 0) errors.push('Select at least one eligible year level.');
  if (f.fields.length === 0) errors.push('Select at least one field of study (or "Any field").');

  if (f.gwaText !== '') {
    const g = Number(f.gwaText);
    if (isNaN(g) || g < 1 || g > 5) errors.push('Required GWA must be between 1.00 and 5.00 (or leave it blank).');
  }
  if (f.incomeText !== '') {
    const inc = Number(f.incomeText);
    if (isNaN(inc) || inc < 0) errors.push('Maximum family income must be 0 or higher (or leave it blank).');
  }
  if (!f.benefits) errors.push('Benefits text is required.');
  const amount = Number(f.amountText);
  if (f.amountText === '' || isNaN(amount) || amount < 0) errors.push('Amount per release must be a number (0 or higher).');
  if (f.documents.length === 0) errors.push('List at least one required document (one per line).');
  if (!f.instructions) errors.push('Application instructions are required.');

  if (!f.deadline) errors.push('Application deadline is required.');
  else if (editingScholarshipId === null && daysUntil(f.deadline) < 0) errors.push('The deadline of a new scholarship cannot be in the past.');

  // Only web links are allowed (this also blocks "javascript:" links)
  if (f.link && !/^https?:\/\/\S+$/i.test(f.link)) errors.push('The external link must start with http:// or https://');

  const duplicate = scholarships.some(function (s) {
    return s.id !== editingScholarshipId && s.name.toLowerCase() === f.name.toLowerCase() && s.provider.toLowerCase() === f.provider.toLowerCase();
  });
  if (f.name && f.provider && duplicate) errors.push('A scholarship with this name and provider already exists.');
  return errors;
}

function newScholarshipId() {
  return scholarships.reduce(function (max, s) { return Math.max(max, s.id); }, 0) + 1;
}

function saveScholarship() {
  if (!isAdmin()) return;
  const f = readScholarshipForm();
  const errors = validateScholarship(f);
  if (errors.length > 0) {
    showSchErrors(errors);
    showToast('Scholarship not saved. Please fix the errors.', 'error');
    return;
  }

  const data = {
    name: f.name,
    provider: f.provider,
    type: f.type,
    description: f.description,
    qualifications: f.qualifications,
    courses: f.courses,
    yearLevels: f.yearLevels,
    maxGWA: f.gwaText === '' ? null : Number(f.gwaText),
    maxIncome: f.incomeText === '' ? null : Number(f.incomeText),
    fields: f.fields,
    allowsExistingAid: f.allowsExistingAid,
    benefits: f.benefits,
    benefitAmount: Number(f.amountText),
    documents: f.documents,
    deadline: f.deadline,
    instructions: f.instructions,
    link: f.link,
    compliance: f.compliance,
    renewal: f.renewal || 'Not specified.'
  };
  if (pendingAnn) {
    data.announcementFileId = pendingAnn.fileId;
    data.announcementName = pendingAnn.name;
    data.announcementSize = pendingAnn.size;
  }

  const existing = editingScholarshipId ? findScholarship(editingScholarshipId) : null;
  if (existing) {
    Object.assign(existing, data);
  } else {
    scholarships.push(Object.assign({ id: newScholarshipId(), isSample: false }, data));
  }

  saveScholarships();
  pendingAnn = null;   // the PDF now belongs to the saved scholarship
  editingScholarshipId = null;
  renderAll();
  showScholarshipForm(false);
  showToast(existing ? 'Scholarship updated.' : 'Scholarship published. Students can now see it in the Marketplace and Matching pages.');
}

function deleteScholarship(id) {
  if (!isAdmin()) return;
  const s = findScholarship(id);
  if (!s) return;
  const count = applications.filter(function (a) { return a.scholarshipId === id; }).length;
  if (count > 0) {
    showToast('Cannot delete: ' + count + ' application' + (count === 1 ? '' : 's') + ' exist for this scholarship.', 'error');
    return;
  }
  if (!confirm('Delete the scholarship "' + s.name + '"? This cannot be undone.')) return;
  deleteFile(s.announcementFileId);
  scholarships = scholarships.filter(function (x) { return x.id !== id; });
  saveScholarships();
  renderAll();
  showToast('Scholarship deleted.');
}

// Admin page: summary cards and the list of all listings
function renderManage() {
  const openCount = scholarships.filter(function (s) { return !isClosed(s); }).length;
  $('admin-stats').innerHTML =
    statCard('Scholarship listings', scholarships.length, 'total', '') +
    statCard('Open for applications', openCount, 'deadline not yet passed', 'green') +
    statCard('Closed', scholarships.length - openCount, 'deadline passed', '') +
    statCard('Student applications', applications.length, 'saved in this browser', 'gold');

  const sorted = scholarships.slice().sort(function (a, b) { return a.deadline.localeCompare(b.deadline); });
  if (sorted.length === 0) {
    $('sch-list').innerHTML = '<div class="card"><p>There are no scholarship listings yet.</p><p class="muted">Click "Add Scholarship" to create the first one.</p></div>';
    return;
  }
  $('sch-list').innerHTML = sorted.map(function (s) {
    const appCount = applications.filter(function (a) { return a.scholarshipId === s.id; }).length;
    return '<div class="card app-card">' +
      '<div class="app-head"><div><div class="badges"><span class="badge badge-gray">' + esc(s.type) + '</span>' + '</div>' +
      '<h4 class="sch-title">' + esc(s.name) + '</h4><div class="sch-provider">' + esc(s.provider) + '</div></div>' +
      '<div>' + deadlineBadge(s.deadline) + '</div></div>' +
      '<div class="app-meta">' +
        '<div><span>Deadline</span>' + formatDate(s.deadline) + '</div>' +
        '<div><span>Benefits</span>' + esc(s.benefits) + '</div>' +
        '<div><span>Applications received</span>' + appCount + '</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn btn-secondary btn-small" data-action="view" data-id="' + s.id + '">View Details</button>' +
        '<button class="btn btn-primary btn-small" data-action="admin-edit" data-id="' + s.id + '">Edit</button>' +
        '<button class="btn btn-danger btn-small" data-action="sch-delete" data-id="' + s.id + '">Delete</button>' +
      '</div></div>';
  }).join('');
}


/* =====================================================================
   8C. ADMIN: PDF ANNOUNCEMENT EXTRACTION AND STUDENT APPLICATION REVIEW
   ===================================================================== */

/*==EXTRACT-START== (plain text functions, no page access; easy to test) */
const HEADING_RE = /^(description|about( the (scholarship|program))?|overview|background|purpose|eligibility( requirements| criteria)?|qualifications?|who (may|can) apply|qualified applicants|benefits?|financial assistance|privileges|required documents?|documents? (required|needed|to submit|to be submitted)|documentary requirements?|application requirements?|requirements|how to apply|application (procedure|process|instructions?|guidelines)|procedure|instructions?|deadline|application deadline|closing date|contact( information)?|selection criteria|scholarship (name|title|type|provider)|name of (the )?scholarship|provider|sponsor|type|link|website|for more information|note|notes|terms and conditions)\b/i;
const YEAR_WORDS = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5 };
const MONTHS = { january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
  august: 8, aug: 8, september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12 };
const COURSE_WORDS = {
  'BS Applied Mathematics': /applied math/i, 'BS Architecture': /architecture/i, 'BS Biology': /biology/i,
  'BS Computer Science': /computer science|\bBSCS\b/i, 'BS Food Technology': /food tech/i,
  'BS Management Economics': /management economics/i, 'BA Anthropology': /anthropology/i,
  'BA Communication Arts': /communication arts/i
};

function isHeading(l) {
  if (!l || l.length > 90) return false;
  const i = l.indexOf(':');
  if (i > 0 && i <= 40 && HEADING_RE.test(l.slice(0, i).trim())) return true;
  return /^[A-Z0-9 &\/()-]{4,60}$/.test(l) && HEADING_RE.test(l);
}
function cleanBullet(l) { return l.replace(/^([-\u2022*\u00b7\u25cf\u25aa]|\d+[.)]|[a-zA-Z][.)])\s+/, '').trim(); }

// Finds a heading (like "Eligibility:") and returns the lines under it
function getSection(lines, re) {
  const withText = new RegExp('^(?:[0-9]+[.)]\\s*)?(?:' + re.source + ')\\s*[:\\-\u2013]\\s*(.*)$', 'i');
  const bare = new RegExp('^(?:[0-9]+[.)]\\s*)?(?:' + re.source + ')\\s*:?\\s*$', 'i');
  for (let i = 0; i < lines.length; i++) {
    let first = null;
    const m = lines[i].match(withText);
    if (m) first = m[1]; else if (bare.test(lines[i])) first = '';
    if (first === null) continue;
    const out = first ? [first] : [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (l === '') {
        if (out.length && !/^([-\u2022*\u00b7\u25cf]|\d+[.)]|[a-zA-Z][.)])\s+/.test(lines[j + 1] || '')) break;
        continue;
      }
      if (isHeading(l)) break;
      out.push(l);
    }
    if (out.length) return out;
  }
  return [];
}

function parseDateText(t) {
  const names = Object.keys(MONTHS).sort(function (a, b) { return b.length - a.length; }).join('|');
  let y, mo, d, m;
  if ((m = t.match(new RegExp('\\b(' + names + ')\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})', 'i')))) { mo = MONTHS[m[1].toLowerCase()]; d = +m[2]; y = +m[3]; }
  else if ((m = t.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(' + names + ')\\.?,?\\s+(\\d{4})', 'i')))) { d = +m[1]; mo = MONTHS[m[2].toLowerCase()]; y = +m[3]; }
  else if ((m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/))) { mo = +m[1]; d = +m[2]; y = +m[3]; }
  else return '';
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return '';
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function parseYears(text) {
  if (/all year levels?|any year level|all years|regardless of (the )?year/i.test(text)) return [1, 2, 3, 4, 5];
  const o = '(first|second|third|fourth|fifth|[1-5](?:st|nd|rd|th))';
  const set = new Set();
  let m;
  const range = new RegExp(o + '\\s*(?:year)?\\s*(?:to|-|\u2013|through|up to)\\s*' + o, 'ig');
  while ((m = range.exec(text))) { for (let k = YEAR_WORDS[m[1].toLowerCase()]; k <= YEAR_WORDS[m[2].toLowerCase()]; k++) set.add(k); }
  const above = new RegExp(o + '[\\s-]*year\\s*(?:and|&)\\s*(?:above|up|onwards?|higher)', 'ig');
  while ((m = above.exec(text))) { for (let k = YEAR_WORDS[m[1].toLowerCase()]; k <= 5; k++) set.add(k); }
  const single = new RegExp('\\b' + o + '\\b', 'ig');
  while ((m = single.exec(text))) set.add(YEAR_WORDS[m[1].toLowerCase()]);
  return Array.from(set).sort();
}

function guessType(text) {
  if (/alumni/i.test(text)) return 'Alumni';
  if (/government|\bCHED\b|\bDOST\b|\bDepEd\b|\bDSWD\b|\bTESDA\b|\bLGU\b|province of|city of|municipal|department of|commission on/i.test(text)) return 'Government';
  if (/universit|\bUP\b|college|campus|institute/i.test(text)) return 'University';
  if (/foundation|corporation|company|\binc\b|bank|group|private|association|club|council/i.test(text)) return 'Private';
  return '';
}

// Takes the text lines of a PDF and returns whatever could be identified.
// Anything not found stays blank ('' or []). Nothing is invented.
function extractScholarshipInfo(lines) {
  const flat = lines.filter(Boolean).join(' ');
  const all = lines.join('\n');
  const r = { name: '', provider: '', type: '', description: '', qualifications: [], courses: [], yearLevels: [], gwa: '', income: '',
    allowsAid: null, benefits: '', amount: '', documents: [], deadline: '', instructions: '', link: '', notes: [] };
  const text = function (re) { return getSection(lines, re).join(' ').trim(); };
  const amountRe = /(?:\b(?:PHP|Php|PhP|P)|\u20b1)\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)/;

  // Name
  r.name = text(/(?:name of (?:the )?scholarship|scholarship (?:name|title)|program name|title)/);
  if (!r.name) {
    const subj = lines.find(function (l) { return /^(subject|re)\s*[:\-\u2013]/i.test(l); });
    if (subj) r.name = subj.replace(/^[^:\-\u2013]+[:\-\u2013]\s*/, '').replace(/^(announcement|call for applications?)\s*(of|for|:)?\s*/i, '');
  }
  if (!r.name) {
    r.name = lines.filter(Boolean).slice(0, 12).find(function (l) {
      return /scholarship|grant|bursary|educational assistance|fellowship|award/i.test(l) && l.length <= 120 && !/[.]$/.test(l) && !/^(to|from|date|attention|cc)\s*:/i.test(l);
    }) || '';
  }
  r.name = r.name.replace(/^["\u201c'\u2018]|["\u201d'\u2019]$/g, '').trim();

  // Provider and type
  r.provider = text(/(?:scholarship provider|provider|sponsor(?:ing)?(?: organization| agency| institution)?|offered by|funded by|granting (?:agency|institution)|donor|issued by)/);
  if (!r.provider) { const pm = flat.match(/\b(?:offered|sponsored|funded|granted) by (?:the )?([A-Z][^.,;:]{3,80})/); if (pm) r.provider = pm[1].trim(); }
  r.type = guessType(text(/(?:scholarship )?type|category/)) || guessType(r.provider + ' ' + r.name);

  // Description (+ eligibility statements)
  r.description = text(/(?:scholarship )?description|about(?: the scholarship| the program)?|overview|background|purpose/);
  if (!r.description) {
    const sent = (flat.match(/[^.!?]*\b(?:scholarship|grant|assistance)\b[^.!?]*[.!?]/g) || []).find(function (s) { return s.length > 40 && !/:/.test(s); });
    if (sent) r.description = sent.trim().slice(0, 300);
  }
  const elig = getSection(lines, /(?:eligibility(?: requirements| criteria)?|qualifications?|who (?:may|can) apply|qualified applicants)/).map(cleanBullet);
  r.qualifications = elig.filter(function (q) { return q.length > 2; });
  r.description = r.description.slice(0, 900);

  // Benefits and amount
  r.benefits = text(/(?:benefits?|financial assistance|privileges|financial (?:benefits|grant)|allowance|stipend)/);
  let am = r.benefits.match(amountRe);
  if (!am) {
    const al = lines.find(function (l) { return /benefit|allowance|stipend|grant|assistance|tuition|financial/i.test(l) && amountRe.test(l); });
    if (al) { am = al.match(amountRe); if (!r.benefits) r.benefits = cleanBullet(al); }
  }
  if (am) r.amount = am[1].replace(/,/g, '');

  // Eligibility details (use the eligibility section when there is one)
  const src = elig.length ? elig : lines;
  const srcText = src.join(' ');
  r.courses = Object.keys(COURSE_WORDS).filter(function (c) { return COURSE_WORDS[c].test(srcText); });
  if (r.courses.length === 0 && /all (?:degree )?(?:courses|programs|degrees)|any (?:degree )?(?:course|program)/i.test(srcText)) r.courses = ['Any'];
  let yearSrc = src.filter(function (l) { return /\b(year|yr)\b/i.test(l); }).join(' ');
  if (!yearSrc && elig.length) yearSrc = lines.filter(function (l) { return /\b(year|yr)\b/i.test(l); }).join(' ');
  r.yearLevels = parseYears(yearSrc);

  const g = flat.match(/(?:GWA|general weighted average|weighted average|GPA)[^0-9]{0,60}?([1-5](?:\.\d{1,2})?)(?![0-9%])/i);
  if (g) r.gwa = g[1];
  for (let i = 0; i < lines.length; i++) {
    if (/income/i.test(lines[i]) && amountRe.test(lines[i])) {
      let v = Number(lines[i].match(amountRe)[1].replace(/,/g, ''));
      if (/annual|per year|yearly|a year/i.test(lines[i])) { v = Math.round(v / 12); r.notes.push('The family income limit was written as an annual amount, so it was divided by 12 to get a monthly figure. Please check it.'); }
      r.income = String(v);
      break;
    }
  }
  if (/\b(?:not|no)\b[^.\n]{0,40}(?:recipient|receiving|availing|beneficiar|enjoying)[^.\n]{0,60}(?:scholarship|assistance|grant)/i.test(flat)) r.allowsAid = false;

  // Documents, deadline, instructions, link
  r.documents = getSection(lines, /(?:required documents?|documents? (?:required|needed|to submit|to be submitted)|documentary requirements?|application requirements?|requirements|submit the following)/)
    .map(cleanBullet).filter(function (d) { return d.length > 2 && d.length <= 150; });
  if (r.documents.length === 1 && /;/.test(r.documents[0])) r.documents = r.documents[0].split(';').map(function (d) { return d.trim(); }).filter(Boolean);

  r.deadline = parseDateText(text(/(?:application )?deadline|closing date|last day (?:of|for) (?:filing|submission|application)|submission deadline|due date/));
  if (!r.deadline) {
    for (let i = 0; i < lines.length && !r.deadline; i++) {
      if (/deadline|on or before|not later than|until|closing|due/i.test(lines[i])) r.deadline = parseDateText(lines[i]);
    }
  }
  r.instructions = getSection(lines, /(?:how to apply|application (?:procedure|process|instructions?|guidelines)|procedure|instructions?|mode of application)/).map(cleanBullet).join('\n');

  const lm = all.match(/https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+/i);
  if (lm) { r.link = lm[0].replace(/[.,;]+$/, ''); if (/^www\./i.test(r.link)) r.link = 'https://' + r.link; }
  return r;
}
/*==EXTRACT-END==*/

// ----- Reading the PDF with PDF.js -----
const PDFJS_VERSION = '3.11.174';
let annFile = null;        // the PDF chosen in the upload box
let pdfWorkerReady = false;
let pendingAnn = null;     // the announcement attached to the scholarship form: { fileId, name, size, isNew }

function pdfLibReady() { return typeof pdfjsLib !== 'undefined'; }

async function readPdfLines(file) {
  // The worker is loaded through a small blob so it also works when the page is opened from a file
  if (!pdfWorkerReady) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob(
      ['importScripts("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION + '/pdf.worker.min.js");'], { type: 'text/javascript' }));
    pdfWorkerReady = true;
  }
  const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const lines = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 20); p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let line = '', lastY = null, lastH = 10;
    content.items.forEach(function (it) {
      if (typeof it.str !== 'string') return;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.replace(/\s+/g, ' ').trim());
        if (lastY - y > lastH * 1.7) lines.push('');   // bigger gap = new paragraph
        line = '';
      }
      line += it.str;
      lastY = y;
      lastH = it.height || lastH;
    });
    lines.push(line.replace(/\s+/g, ' ').trim(), '');
  }
  if (task.destroy) task.destroy();   // free the memory used by this PDF
  return lines;
}

function showAnnMsg(type, html) {
  const box = $('ann-msg');
  box.className = 'alert alert-' + type;
  box.innerHTML = html;
}

function onAnnFileChosen(input) {
  annFile = input.files[0] || null;
  $('ann-filename').textContent = annFile ? 'Chosen file: ' + annFile.name + ' (' + sizeText(annFile.size) + ')' : 'No file chosen.';
  $('ann-extract').disabled = !annFile;
  $('ann-msg').className = 'alert hidden';
}

// "Extract Scholarship Information" button
async function extractFromPdf() {
  if (!isAdmin() || !annFile) return;
  const problem = checkUpload(annFile, true);
  if (problem) { showAnnMsg('error', esc(problem)); return; }
  if (!pdfLibReady()) {
    showAnnMsg('warn', 'The PDF reader (PDF.js) could not be loaded. Check your internet connection and reload the page, or click "+ Add Scholarship" and type the details manually.');
    return;
  }
  const btn = $('ann-extract');
  btn.disabled = true;
  btn.textContent = 'Reading PDF...';
  try {
    const lines = await readPdfLines(annFile);
    const fileId = await saveFile(annFile);
    const scanned = lines.join('').replace(/\s/g, '').length < 50;
    const result = scanned ? null : extractScholarshipInfo(lines);

    openScholarshipForm();                    // empty Add Scholarship form
    pendingAnn = { fileId: fileId, name: annFile.name, size: annFile.size, isNew: true };
    renderAnnBox();
    if (result) fillFormFromExtraction(result);
    showReviewNote(result);
    $('ann-msg').className = 'alert hidden';
    window.scrollTo(0, 0);
  } catch (e) {
    showAnnMsg('error', 'Sorry, this PDF could not be read. It may be damaged or password-protected. You can click "+ Add Scholarship" and enter the details manually.');
  } finally {
    btn.textContent = 'Extract Scholarship Information';
    btn.disabled = !annFile;
  }
}

function fillFormFromExtraction(r) {
  $('sch-name').value = r.name;
  $('sch-provider').value = r.provider;
  if (TYPES.includes(r.type)) $('sch-type').value = r.type;
  $('sch-deadline').value = r.deadline;
  $('sch-desc').value = r.description;
  $('sch-qualifications').value = r.qualifications.join('\n');
  setChecked('sch-course', r.courses);
  setChecked('sch-year', r.yearLevels);
  $('sch-gwa').value = r.gwa;
  $('sch-income').value = r.income;
  if (r.allowsAid === false) $('sch-aid').checked = false;
  $('sch-benefits').value = r.benefits;
  $('sch-amount').value = r.amount;
  $('sch-docs').value = r.documents.join('\n');
  $('sch-instructions').value = r.instructions;
  $('sch-link').value = r.link;
}

// The reminder at the top of the form after an extraction
function showReviewNote(r) {
  const box = $('sch-review-note');
  let html;
  if (!r) {
    html = '<strong>No readable text found.</strong> This PDF looks scanned or image-based, so automatic extraction may not work. ' +
      'The original PDF is attached below. Please read it and enter the scholarship details manually.';
  } else {
    const found = [r.name, r.provider, r.type, r.description, r.qualifications.length, r.courses.length, r.yearLevels.length, r.gwa, r.income,
      r.benefits, r.amount, r.documents.length, r.deadline, r.instructions, r.link].filter(function (x) { return x; }).length;
    html = '<strong>Please review before publishing.</strong> The app filled in ' + found + ' of 15 details it could identify from the PDF. ' +
      'Automatic reading can make mistakes, so <strong>verify every field against the original PDF</strong> (view it below). ' +
      'Blank fields were not found. Field of study, compliance and renewal are never filled in automatically. ' +
      'The scholarship is <strong>not published</strong> until you click "Publish Scholarship".' +
      (r.notes.length ? '<ul>' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '');
  }
  box.innerHTML = html;
  box.classList.remove('hidden');
}

// Shows the attached announcement PDF in the form with View / Download buttons
function renderAnnBox() {
  const box = $('sch-pdf-box');
  if (!pendingAnn) { box.innerHTML = ''; box.classList.add('hidden'); return; }
  box.innerHTML = '<div class="field full"><label>Original announcement (kept for reference)</label>' +
    docRowsHTML([{ name: 'Scholarship announcement PDF', fileId: pendingAnn.fileId, fileName: pendingAnn.name, fileSize: pendingAnn.size }], false) + '</div>';
  box.classList.remove('hidden');
}

// Throws away an announcement that was uploaded but never published
function discardPendingAnn() {
  if (pendingAnn && pendingAnn.isNew) deleteFile(pendingAnn.fileId);
  pendingAnn = null;
}

function cancelScholarshipForm() {
  discardPendingAnn();
  showScholarshipForm(false);
  editingScholarshipId = null;
}

// ----- Admin: Student Applications -----
function renderAdminApps() {
  const box = $('adminapps-table');
  const list = applications.filter(function (a) { return a.status !== 'Draft'; })
    .sort(function (a, b) { return (b.dateSubmitted || '').localeCompare(a.dateSubmitted || '') || b.id - a.id; });
  if (list.length === 0) {
    box.innerHTML = '<p>No submitted applications yet.</p><p class="muted">Applications appear here after a student clicks Submit Application.</p>';
    return;
  }
  box.innerHTML = '<table class="table"><thead><tr><th>Student</th><th>Email</th><th>Scholarship</th><th>Course &amp; year</th><th>Date submitted</th><th>Status</th><th></th></tr></thead><tbody>' +
    list.map(function (a) {
      const s = findScholarship(a.scholarshipId);
      return '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.email) + '</td><td>' + esc(s ? s.name : 'Removed scholarship') + '</td>' +
        '<td>' + esc(a.course) + ', ' + esc(yearLabel(a.yearLevel)) + '</td><td>' + formatDate(a.dateSubmitted) + '</td><td>' + statusBadge(a.status) + '</td>' +
        '<td><button class="btn btn-primary btn-small" data-action="admin-app-open" data-id="' + a.id + '">Open</button></td></tr>';
    }).join('') + '</tbody></table>';
}

function openAdminApp(id) {
  const app = findApp(id);
  if (!app || !isAdmin()) return;
  const s = findScholarship(app.scholarshipId);
  const reviewStatuses = APP_STATUSES.filter(function (x) { return x !== 'Draft'; });
  let html = '<div class="badges">' + statusBadge(app.status) + '</div>' +
    '<h3 id="modal-title">' + esc(app.name) + '</h3><div class="sch-provider">Applying for: ' + esc(s ? s.name : 'Removed scholarship') + '</div>' +
    '<ul class="info-list">' +
    '<li><strong>Email:</strong> ' + esc(app.email) + '</li>' +
    '<li><strong>Contact number:</strong> ' + esc(app.contact || '-') + '</li>' +
    '<li><strong>Course and year:</strong> ' + esc(app.course) + ', ' + esc(yearLabel(app.yearLevel)) + '</li>' +
    '<li><strong>GWA:</strong> ' + esc(app.gwa) + '</li>' +
    '<li><strong>Monthly family income:</strong> ' + (app.income === '' ? '-' : peso(app.income)) + '</li>' +
    '<li><strong>Date submitted:</strong> ' + formatDate(app.dateSubmitted) + '</li></ul>' +
    '<div class="detail-section"><h4>Statement</h4><p>' + esc(app.statement) + '</p></div>' +
    '<div class="detail-section"><h4>Submitted requirements</h4>' + docRowsHTML(app.documents, false) + '</div>' +
    '<div class="detail-section"><h4>Review</h4>' +
    '<div class="field"><label for="aa-status">Application status</label><select id="aa-status">' +
    reviewStatuses.map(function (st) { return '<option value="' + esc(st) + '"' + (st === app.status ? ' selected' : '') + '>' + esc(st) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field' + (app.status === 'Incomplete' ? '' : ' hidden') + '" id="aa-note-box"><label for="aa-note">What is missing or incorrect? (shown to the student)</label>' +
    '<textarea id="aa-note" rows="3" placeholder="e.g., Certificate of Indigency is unreadable. Please contact the scholarship office.">' + esc(app.adminNote || '') + '</textarea></div></div>' +
    '<div class="card-actions"><button class="btn btn-primary" data-action="aa-save" data-id="' + app.id + '">Update Status</button>' +
    '<button class="btn btn-ghost" data-action="close-modal">Close</button></div>';
  $('modal-body').innerHTML = html;
  $('modal').classList.remove('hidden');
}

function saveAdminStatus(id) {
  const app = findApp(id);
  if (!app || !isAdmin()) return;
  const status = val('aa-status');
  const note = val('aa-note').trim();
  if (status === 'Incomplete' && !note) { showToast('Please explain what is missing or incorrect.', 'error'); return; }
  changeStatus(id, status, status === 'Incomplete' ? note : '');
  closeModal();
}


/* =====================================================================
   9. NAVIGATION, MESSAGES, RESET
   ===================================================================== */

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  matching: 'Scholarship Matching',
  marketplace: 'Scholarship Marketplace',
  applications: 'My Applications',
  tracking: 'Tracking & Disbursement',
  manage: 'Manage Scholarships',
  adminapps: 'Student Applications'
};

function showPage(name) {
  if (!session) return;                          // nobody signed in
  if (!pageAllowed(name)) name = defaultPage();  // this role may not open that page
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  $('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.page === name);
  });
  $('page-title').textContent = PAGE_TITLES[name];

  showAppForm(false);        // always start on the application list
  editingAppId = null;
  showScholarshipForm(false);
  discardPendingAnn();
  editingScholarshipId = null;
  closeMenu();
  renderAll();
  window.scrollTo(0, 0);
}

function toggleMenu() {
  $('sidebar').classList.toggle('open');
  $('backdrop').classList.toggle('show');
}
function closeMenu() {
  $('sidebar').classList.remove('open');
  $('backdrop').classList.remove('show');
}

function showToast(message, type) {
  const t = $('toast');
  t.textContent = message;
  t.className = 'toast ' + (type || 'success');   // also removes the "hidden" class
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3800);
}

// "Reset Demo Data" button
function resetDemoData() {
  if (!confirm('Reset all demo data? This deletes your profile, all applications, uploaded documents, announcement PDFs and any scholarships added by staff, and restores the sample scholarships.')) return;
  localStorage.removeItem(KEYS.scholarships);
  localStorage.removeItem(KEYS.profile);
  localStorage.removeItem(KEYS.applications);
  clearFiles().then(function () {
    loadAllData();             // loads fresh sample scholarships and saves them
    profile = null;
    pendingAnn = null;
    matchingShown = false;
    $('matching-results').innerHTML = '';
    showProfileErrors([]);
    fillProfileForm();
    clearFilters();
    showPage(defaultPage());
    showToast('Demo data has been reset.');
  });
}


/* =====================================================================
   10. LISTENERS AND START-UP
   Buttons that are created by JavaScript use a data-action attribute.
   One listener on the whole page watches for clicks and calls the right function.
   ===================================================================== */

document.addEventListener('click', function (e) {
  // Click on the dark area outside the pop-up closes it
  if (e.target.id === 'modal') { closeModal(); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = Number(el.dataset.id);

  switch (action) {
    case 'goto': showPage(el.dataset.page); break;
    case 'toggle-menu': toggleMenu(); break;
    case 'reset-data': resetDemoData(); break;
    case 'find-matches': handleFindMatches(); break;
    case 'clear-filters': clearFilters(); break;
    case 'view': openDetails(id); break;
    case 'close-modal': closeModal(); break;
    case 'apply': closeModal(); startApplication(id); break;
    case 'new-app': openNewAppForm(); break;
    case 'app-submit': saveApplication('submit'); break;
    case 'app-draft': saveApplication('draft'); break;
    case 'app-cancel': showAppForm(false); editingAppId = null; break;
    case 'edit-app': { const a = findApp(id); if (a && a.status === 'Draft') openEditForm(a); else showToast('Submitted applications are locked.', 'error'); break; }
    case 'delete-app': deleteApplication(id); break;
    case 'save-tracking': saveTracking(id, el.closest('.track-card')); break;
    // sign-in and admin
    case 'pick-role': pickRole(el.dataset.role); break;
    case 'sign-out': signOut(); break;
    case 'admin-new': openScholarshipForm(); break;
    case 'admin-edit': closeModal(); showPage('manage'); openScholarshipForm(id); break;
    case 'sch-save': saveScholarship(); break;
    case 'sch-cancel': cancelScholarshipForm(); break;
    // files, PDF extraction and admin review
    case 'ann-extract': extractFromPdf(); break;
    case 'file-preview': previewFile(el.dataset.file, el.closest('.doc-block').querySelector('.preview-area')); break;
    case 'file-download': downloadFile(el.dataset.file); break;
    case 'preview-close': clearPreview(el.closest('.preview-area')); break;
    case 'admin-app-open': openAdminApp(id); break;
    case 'aa-save': saveAdminStatus(id); break;
    case 'sch-delete': deleteScholarship(id); break;
  }
});

// Dropdowns and checkboxes created by JavaScript
document.addEventListener('change', function (e) {
  const el = e.target;
  if (el.dataset.action === 'doc-file') handleDocFile(el);
  if (el.id === 'ann-file') onAnnFileChosen(el);
  if (el.id === 'aa-status') $('aa-note-box').classList.toggle('hidden', el.value !== 'Incomplete');
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
});

function startApp() {
  loadAllData();

  // Fill the dropdown menus
  fillSelect('p-course', COURSES, 'Select your program');
  fillSelect('p-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }), 'Select year level');
  fillSelect('p-aid', AID_OPTIONS);
  fillSelect('p-interest', INTERESTS, 'Select an interest');
  fillSelect('f-course', COURSES.filter(function (c) { return c !== 'Other'; }), 'All programs');
  fillSelect('f-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }), 'All year levels');
  fillSelect('f-type', TYPES, 'All types');
  fillSelect('af-course', COURSES, 'Select your program');
  fillSelect('af-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }), 'Select year level');

  buildScholarshipFormChoices();
  fillProfileForm();

  // Sign-in form and admin scholarship form: do not let the Enter key reload the page
  $('login-form').addEventListener('submit', function (e) { e.preventDefault(); handleSignIn(); });
  $('sch-form').addEventListener('submit', function (e) { e.preventDefault(); });

  // Profile form: pressing "Save Profile"
  $('profile-form').addEventListener('submit', function (e) {
    e.preventDefault();
    handleSaveProfile();
  });

  // Application form: do not let the Enter key reload the page
  $('app-form').addEventListener('submit', function (e) { e.preventDefault(); });

  // Marketplace: update the list while typing and whenever a filter changes
  ['m-search', 'f-course', 'f-year', 'f-type', 'm-sort'].forEach(function (id) {
    $(id).addEventListener('input', renderMarketplace);
    $(id).addEventListener('change', renderMarketplace);
  });

  // Application form: show new documents when another scholarship is chosen
  $('af-scholarship').addEventListener('change', function () {
    if (editingAppId === null) renderFormDocs(null);
  });

  renderAll();
  pickRole('student');
  showSessionScreen();   // shows the sign-in screen, or the app if someone is already signed in
}

startApp();
