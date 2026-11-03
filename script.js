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
  'BS Applied Mathematics', 'BS Architecture', 'BS Biology', 'BS Computer Science',
  'BS Food Technology', 'BS Management Economics', 'BA Anthropology',
  'BA Communication Arts', 'Other'
];

const INTERESTS = [
  'Science & Mathematics', 'Technology & Computing', 'Social Sciences',
  'Management & Economics', 'Arts & Humanities', 'Undecided / Other'
];

const YEARS = [1, 2, 3, 4, 5];

const AID_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'scholarship', label: 'Currently receiving another scholarship' },
  { value: 'assistance', label: 'Currently receiving financial assistance' }
];

const TYPES = ['Government', 'Private', 'University', 'Alumni'];

const APP_STATUSES = [
  'Draft', 'Submitted', 'Under Review', 'Additional Requirements Needed', 'Approved', 'Rejected'
];

const DISB_STATUSES = ['Not Yet Approved', 'Pending', 'Processing', 'Released', 'Delayed'];

// An application can only be edited while it is in one of these statuses
const EDITABLE_STATUSES = ['Draft', 'Submitted', 'Additional Requirements Needed'];

const TIMELINE_STEPS = [
  'Application Submitted', 'Under Review', 'Approved', 'Disbursement Processing', 'Funds Released'
];


/* =====================================================================
   2. SAMPLE SCHOLARSHIP DATA  (FICTIONAL - for demonstration only)
   Deadlines are calculated from today's date so the demo always has
   some open and some closing-soon scholarships.
   ===================================================================== */

function getSampleScholarships() {
  return [
    {
      id: 1, isSample: true,
      name: 'Sample Academic Excellence Grant',
      provider: 'Demo University Foundation',
      type: 'University',
      description: 'A demonstration merit grant for students with a high general weighted average.',
      courses: ['Any'],
      yearLevels: [2, 3, 4, 5],
      maxGWA: 1.75,
      maxIncome: null,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'PHP 15,000 grant per semester',
      benefitAmount: 15000,
      documents: ['Certified copy of grades', 'Photocopy of school ID', 'Letter of intent'],
      deadline: dateInDays(21),
      instructions: 'Sample instructions: complete the in-app form, check each document you have prepared, then submit.',
      link: '',
      compliance: ['Maintain a GWA of 1.75 or better', 'Enroll in a full load each semester'],
      renewal: 'Renews each semester after submission of updated grades and a short progress letter.'
    },
    {
      id: 2, isSample: true,
      name: 'Sample Science & Math Scholars Scholarship',
      provider: 'Demo Science Foundation',
      type: 'Private',
      description: 'A demonstration scholarship for science, mathematics and computing students from lower-income households.',
      courses: ['BS Applied Mathematics', 'BS Biology', 'BS Computer Science', 'BS Food Technology'],
      yearLevels: [2, 3, 4, 5],
      maxGWA: 2.0,
      maxIncome: 40000,
      fields: ['Science & Mathematics', 'Technology & Computing'],
      allowsExistingAid: false,
      benefits: 'PHP 20,000 per semester plus PHP 5,000 book allowance',
      benefitAmount: 25000,
      documents: ['Certified copy of grades', 'Proof of family income', 'Photocopy of school ID', 'Recommendation letter'],
      deadline: dateInDays(14),
      instructions: 'Sample instructions: prepare the four documents listed, fill out the form, and submit before the deadline.',
      link: 'https://example.com/sample-science-scholarship',
      compliance: ['Maintain a GWA of 2.00 or better', 'Submit grades within 2 weeks after each semester', 'No failing or dropped subjects'],
      renewal: 'Renewable every academic year if compliance requirements are met.'
    },
    {
      id: 3, isSample: true,
      name: 'Sample Tuition Support Program',
      provider: 'Demo Government Agency',
      type: 'Government',
      description: 'A demonstration tuition support program for students from low-income households.',
      courses: ['Any'],
      yearLevels: [1, 2, 3, 4, 5],
      maxGWA: 2.5,
      maxIncome: 20000,
      fields: ['Any'],
      allowsExistingAid: false,
      benefits: 'PHP 20,000 tuition support per semester',
      benefitAmount: 20000,
      documents: ['Proof of family income', 'Certificate of enrollment', 'Barangay certificate', 'Photocopy of school ID'],
      deadline: dateInDays(30),
      instructions: 'Sample instructions: submit the form together with all four documents.',
      link: 'https://example.com/sample-tuition-support',
      compliance: ['Maintain a GWA of 2.50 or better', 'Submit certificate of enrollment each semester'],
      renewal: 'Renews yearly after income re-validation.'
    },
    {
      id: 4, isSample: true,
      name: 'Sample Tech Futures Scholarship',
      provider: 'Demo Tech Industry Council',
      type: 'Private',
      description: 'A demonstration scholarship for upper-year computing and mathematics students.',
      courses: ['BS Computer Science', 'BS Applied Mathematics'],
      yearLevels: [3, 4],
      maxGWA: 2.25,
      maxIncome: null,
      fields: ['Technology & Computing', 'Science & Mathematics'],
      allowsExistingAid: true,
      benefits: 'PHP 25,000 per semester plus internship opportunity (sample)',
      benefitAmount: 25000,
      documents: ['Certified copy of grades', 'Resume', 'Short project portfolio'],
      deadline: dateInDays(9),
      instructions: 'Sample instructions: include a short portfolio of a class or personal project.',
      link: '',
      compliance: ['Maintain a GWA of 2.25 or better', 'Attend two sample mentoring sessions per semester'],
      renewal: 'Renews each semester with a progress report.'
    },
    {
      id: 5, isSample: true,
      name: 'Sample Alumni Book Allowance',
      provider: 'Demo Alumni Association',
      type: 'Alumni',
      description: 'A small demonstration allowance for textbooks and learning materials.',
      courses: ['Any'],
      yearLevels: [1, 2, 3, 4, 5],
      maxGWA: null,
      maxIncome: 30000,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'PHP 5,000 one-time book allowance',
      benefitAmount: 5000,
      documents: ['Photocopy of school ID', 'Proof of family income'],
      deadline: dateInDays(4),
      instructions: 'Sample instructions: two documents only. Closing soon!',
      link: '',
      compliance: ['Submit receipts for purchased books within 30 days'],
      renewal: 'One-time grant. Not renewable.'
    },
    {
      id: 6, isSample: true,
      name: 'Sample Future Managers Award',
      provider: 'Demo Business Circle',
      type: 'Private',
      description: 'A demonstration award for management and economics students who show leadership.',
      courses: ['BS Management Economics'],
      yearLevels: [3, 4, 5],
      maxGWA: 2.0,
      maxIncome: null,
      fields: ['Management & Economics'],
      allowsExistingAid: true,
      benefits: 'PHP 12,000 per semester',
      benefitAmount: 12000,
      documents: ['Certified copy of grades', 'Leadership essay', 'Certificate of good moral character'],
      deadline: dateInDays(45),
      instructions: 'Sample instructions: write a one-page leadership essay and attach it to your submission.',
      link: 'https://example.com/sample-managers-award',
      compliance: ['Maintain a GWA of 2.00 or better', 'Complete 20 hours of sample community service'],
      renewal: 'Renewable once with a service report.'
    },
    {
      id: 7, isSample: true,
      name: 'Sample Community Service Leaders Grant',
      provider: 'Demo University Foundation',
      type: 'University',
      description: 'A demonstration grant for students active in community service and campus organizations.',
      courses: ['Any'],
      yearLevels: [2, 3, 4, 5],
      maxGWA: 2.5,
      maxIncome: null,
      fields: ['Social Sciences', 'Arts & Humanities', 'Management & Economics'],
      allowsExistingAid: true,
      benefits: 'PHP 8,000 per semester',
      benefitAmount: 8000,
      documents: ['Certified copy of grades', 'Certificate of community service', 'Photocopy of school ID'],
      deadline: dateInDays(7),
      instructions: 'Sample instructions: attach proof of at least 40 hours of community service.',
      link: '',
      compliance: ['Maintain a GWA of 2.50 or better', 'Submit a semestral service report'],
      renewal: 'Renews each semester after a service report.'
    },
    {
      id: 8, isSample: true,
      name: 'Sample Freshman Access Aid (Closed)',
      provider: 'Demo Government Agency',
      type: 'Government',
      description: 'A demonstration aid for incoming first-year students. Its deadline has already passed so you can see how closed listings look.',
      courses: ['Any'],
      yearLevels: [1],
      maxGWA: null,
      maxIncome: 25000,
      fields: ['Any'],
      allowsExistingAid: false,
      benefits: 'PHP 10,000 one-time grant',
      benefitAmount: 10000,
      documents: ['Proof of family income', 'Certificate of admission'],
      deadline: dateInDays(-5),
      instructions: 'Sample instructions: this listing is closed.',
      link: '',
      compliance: ['Enroll full-time for the first semester'],
      renewal: 'One-time grant. Not renewable.'
    }
  ];
}


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
      '<div class="badges"><span class="badge badge-gray">' + esc(s.type) + '</span>' +
      (s.isSample ? '<span class="badge badge-sample">Sample data</span>' : '') + '</div>' +
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

function closeModal() { $('modal').classList.add('hidden'); }


/* =====================================================================
   6. FEATURE 3 - APPLICATION MANAGEMENT
   Each application is an object like:
   { id, scholarshipId, status, dateSubmitted, name, email, contact, course,
     yearLevel, gwa, income, statement,
     documents: [ { name, done } ],
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

// Shows the right buttons: new/draft = Submit + Save Draft; already submitted = Save Changes
function setFormButtons(mode) {
  $('af-submit').classList.toggle('hidden', mode === 'edit');
  $('af-draft').classList.toggle('hidden', mode === 'edit');
  $('af-update').classList.toggle('hidden', mode !== 'edit');
}

// Shows the document checkboxes and a short info box for the chosen scholarship
function renderFormDocs(app) {
  const s = findScholarship(Number(val('af-scholarship')));
  if (!s) {
    $('af-docs').innerHTML = '<p class="muted">Choose a scholarship to see its required documents.</p>';
    $('af-scholarship-info').innerHTML = '';
    return;
  }
  const docs = app ? app.documents : s.documents.map(function (name) { return { name: name, done: false }; });
  $('af-docs').innerHTML = docs.map(function (d, i) {
    return '<label class="check"><input type="checkbox" data-index="' + i + '"' + (d.done ? ' checked' : '') + '> ' + esc(d.name) + '</label>';
  }).join('');

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
  setFormButtons('new');
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

  $('app-form-title').textContent = app.status === 'Draft' ? 'Edit Draft Application' : 'Update Application';
  setFormButtons(app.status === 'Draft' ? 'draft' : 'edit');
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
    showToast('You already have an application for this scholarship. Opening it for editing.', 'info');
  } else {
    showToast('You already have an application for this scholarship (status: ' + existing.status + ').', 'info');
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
function readFormDocs(scholarship, existingApp) {
  const names = existingApp ? existingApp.documents.map(function (d) { return d.name; }) : scholarship.documents;
  const boxes = document.querySelectorAll('#af-docs input[type="checkbox"]');
  return names.map(function (name, i) {
    return { name: name, done: boxes[i] ? boxes[i].checked : false };
  });
}

// mode is 'draft' (save draft), 'submit' (submit), or 'update' (save changes to an existing application)
function saveApplication(mode) {
  const f = readAppForm();
  const strict = mode !== 'draft';
  const errors = validateAppForm(f, strict);
  const scholarship = findScholarship(f.scholarshipId);
  const existingApp = editingAppId ? findApp(editingAppId) : null;

  if (scholarship && mode === 'submit' && isClosed(scholarship)) {
    errors.push('The deadline for this scholarship has passed, so it cannot be submitted.');
  }
  if (f.scholarshipId && applications.some(function (a) { return a.scholarshipId === f.scholarshipId && a.id !== editingAppId; })) {
    errors.push('You already have an application for this scholarship. Edit it from the My Applications list instead.');
  }
  if (errors.length > 0) {
    showFormErrors(errors);
    showToast('Application not saved. Please fix the errors.', 'error');
    return;
  }

  const docs = readFormDocs(scholarship, existingApp);
  const missing = docs.filter(function (d) { return !d.done; });

  // Warn (but allow) submitting when documents are missing
  if (mode === 'submit' && missing.length > 0) {
    const names = missing.map(function (d) { return '- ' + d.name; }).join('\n');
    if (!confirm('Warning: ' + missing.length + ' required document(s) are not checked:\n' + names + '\n\nSubmit anyway?')) return;
  }

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
  app.documents = docs;

  if (mode === 'submit') {
    app.status = 'Submitted';
    app.dateSubmitted = todayISO();
  }

  saveApplications();
  renderAll();
  showAppForm(false);
  editingAppId = null;

  if (mode === 'submit') showToast('Application submitted within this prototype. It was not sent to any real provider.');
  else if (mode === 'draft') showToast('Draft saved.');
  else showToast('Application updated.');
}

// Called when the status dropdown on an application card changes (demonstration control)
function changeStatus(id, newStatus) {
  const app = findApp(id);
  if (!app || app.status === newStatus) return;

  app.status = newStatus;
  if (newStatus === 'Draft') app.dateSubmitted = '';
  else if (!app.dateSubmitted) app.dateSubmitted = todayISO();

  // Disbursement only applies to approved applications
  if (newStatus === 'Approved') {
    if (app.disbursement.status === 'Not Yet Approved') app.disbursement.status = 'Pending';
  } else {
    app.disbursement.status = 'Not Yet Approved';
  }

  saveApplications();
  renderAll();
  showToast('Status changed to "' + newStatus + '".');
}

function toggleDocument(id, index, checked) {
  const app = findApp(id);
  if (!app || !app.documents[index]) return;
  app.documents[index].done = checked;
  saveApplications();
  renderAll();
}

function deleteApplication(id) {
  const app = findApp(id);
  if (!app) return;
  const s = findScholarship(app.scholarshipId);
  if (!confirm('Delete your application for "' + (s ? s.name : 'this scholarship') + '"? This cannot be undone.')) return;
  applications = applications.filter(function (a) { return a.id !== id; });
  saveApplications();
  renderAll();
  showToast('Application deleted.');
}

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
    const missing = app.documents.filter(function (d) { return !d.done; });
    const canEdit = EDITABLE_STATUSES.includes(app.status);

    let html = '<div class="card app-card">';
    html += '<div class="app-head"><div><h4 class="sch-title">' + esc(s.name) + '</h4>' +
      '<div class="sch-provider">' + esc(s.provider) + '</div></div>' + statusBadge(app.status) + '</div>';

    html += '<div class="app-meta">' +
      '<div><span>Applicant</span>' + esc(app.name || '(no name yet)') + '</div>' +
      '<div><span>Date submitted</span>' + (app.dateSubmitted ? formatDate(app.dateSubmitted) : 'Not submitted yet') + '</div>' +
      '<div><span>Application deadline</span>' + (s.deadline ? formatDate(s.deadline) + ' ' + deadlineBadge(s.deadline) : '-') + '</div>' +
      '</div>';

    // Status dropdown (for demonstration and testing)
    html += '<div class="status-control"><label>Change status (demo control):</label><select data-action="status-change" data-id="' + app.id + '">' +
      APP_STATUSES.map(function (st) { return '<option value="' + esc(st) + '"' + (st === app.status ? ' selected' : '') + '>' + esc(st) + '</option>'; }).join('') +
      '</select></div>';

    // Requirements checklist
    html += '<div class="checklist"><h4>Requirements checklist (' + (app.documents.length - missing.length) + ' of ' + app.documents.length + ' ready)</h4>' +
      app.documents.map(function (d, i) {
        return '<label class="check"><input type="checkbox" data-action="doc-toggle" data-id="' + app.id + '" data-index="' + i + '"' +
          (d.done ? ' checked' : '') + '> ' + esc(d.name) + '</label>';
      }).join('') + '</div>';

    if (missing.length > 0) {
      html += '<div class="alert alert-warn"><strong>Missing requirements:</strong> ' +
        missing.map(function (d) { return esc(d.name); }).join(', ') + '</div>';
    } else {
      html += '<div class="alert alert-ok">All required documents are checked.</div>';
    }
    if (app.status === 'Additional Requirements Needed') {
      html += '<div class="alert alert-warn"><strong>The reviewer asked for additional requirements.</strong> Update your application and check the documents you have added.</div>';
    }

    html += '<div class="card-actions">' +
      (canEdit
        ? '<button class="btn btn-secondary btn-small" data-action="edit-app" data-id="' + app.id + '">' + (app.status === 'Draft' ? 'Edit / Submit' : 'Update') + '</button>'
        : '<button class="btn btn-secondary btn-small" disabled title="Applications under review, approved or rejected cannot be edited">Locked</button>') +
      '<button class="btn btn-danger btn-small" data-action="delete-app" data-id="' + app.id + '">Delete</button></div>';
    html += '</div>';
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

  if (app.status === 'Submitted' || app.status === 'Under Review' || app.status === 'Additional Requirements Needed') {
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
    if (app.status === 'Additional Requirements Needed') {
      html += '<div class="alert alert-warn">Additional requirements are needed. Go to My Applications to update your documents.</div>';
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
      html += '<p class="muted">Disbursement fields unlock once the application is Approved. (For this demo, change the status in My Applications.)</p>';
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
  admin: ['manage', 'marketplace']
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
    [{ value: 'Any', label: 'Any field' }].concat(INTERESTS.filter(function (i) { return i !== 'Undecided / Other'; }).map(function (i) { return { value: i, label: i }; })));
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

  const d = s || {
    name: '', provider: '', type: '', description: '', courses: [], yearLevels: [], fields: [],
    maxGWA: null, maxIncome: null, allowsExistingAid: true, benefits: '', benefitAmount: '',
    documents: [], deadline: '', instructions: '', link: '', compliance: [], renewal: ''
  };
  $('sch-name').value = d.name;
  $('sch-provider').value = d.provider;
  $('sch-type').value = d.type;
  $('sch-deadline').value = d.deadline;
  $('sch-desc').value = d.description;
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

  const existing = editingScholarshipId ? findScholarship(editingScholarshipId) : null;
  if (existing) {
    Object.assign(existing, data);
  } else {
    scholarships.push(Object.assign({ id: newScholarshipId(), isSample: false }, data));
  }

  saveScholarships();
  editingScholarshipId = null;
  renderAll();
  showScholarshipForm(false);
  showToast(existing ? 'Scholarship updated.' : 'Scholarship added. Students can now see it in the Marketplace.');
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
      '<div class="app-head"><div><div class="badges"><span class="badge badge-gray">' + esc(s.type) + '</span>' +
      (s.isSample ? '<span class="badge badge-sample">Sample data</span>' : '<span class="badge badge-green">Added by staff</span>') + '</div>' +
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
   9. NAVIGATION, MESSAGES, RESET
   ===================================================================== */

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  matching: 'Scholarship Matching',
  marketplace: 'Scholarship Marketplace',
  applications: 'My Applications',
  tracking: 'Tracking & Disbursement',
  manage: 'Manage Scholarships'
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
  if (!confirm('Reset all demo data? This deletes your profile, all applications and any scholarships added by staff, and restores the sample scholarships.')) return;
  localStorage.removeItem(KEYS.scholarships);
  localStorage.removeItem(KEYS.profile);
  localStorage.removeItem(KEYS.applications);
  loadAllData();             // loads fresh sample scholarships and saves them
  matchingShown = false;
  $('matching-results').innerHTML = '';
  showProfileErrors([]);
  fillProfileForm();
  clearFilters();
  showPage('dashboard');
  showToast('Demo data has been reset.');
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
    case 'app-update': saveApplication('update'); break;
    case 'app-cancel': showAppForm(false); editingAppId = null; break;
    case 'edit-app': openEditForm(findApp(id)); break;
    case 'delete-app': deleteApplication(id); break;
    case 'save-tracking': saveTracking(id, el.closest('.track-card')); break;
    // sign-in and admin
    case 'pick-role': pickRole(el.dataset.role); break;
    case 'sign-out': signOut(); break;
    case 'admin-new': openScholarshipForm(); break;
    case 'admin-edit': closeModal(); showPage('manage'); openScholarshipForm(id); break;
    case 'sch-save': saveScholarship(); break;
    case 'sch-cancel': showScholarshipForm(false); editingScholarshipId = null; break;
    case 'sch-delete': deleteScholarship(id); break;
  }
});

// Dropdowns and checkboxes created by JavaScript
document.addEventListener('change', function (e) {
  const el = e.target;
  if (el.dataset.action === 'status-change') changeStatus(Number(el.dataset.id), el.value);
  if (el.dataset.action === 'doc-toggle') toggleDocument(Number(el.dataset.id), Number(el.dataset.index), el.checked);
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