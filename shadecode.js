// ============================================================
// ASS Shade Calculator — shadecode.js
// ============================================================
// This script handles measurement input, error calculation,
// residual fitting, recommendation logic, and 3D visualization
// for shade sail layouts (4-point and 5-point).
// ============================================================

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

/** Label definitions for 4-point shade sails. */
const fourpoint = [
  "A-B",
  "B-C",
  "C-D",
  "D-A",
  "A-C",
  "B-D",
  "Ah",
  "Bh",
  "Ch",
  "Dh",
];

/** Label definitions for 5-point shade sails. */
const fivepoint = [
  "A-B",
  "B-C",
  "C-D",
  "D-E",
  "E-A",
  "A-C",
  "A-D",
  "B-D",
  "B-E",
  "C-E",
  "Ah",
  "Bh",
  "Ch",
  "Dh",
  "Eh",
];

/** Label definitions for 6-point shade sails. */
const sixpoint = [
  "A-B",
  "B-C",
  "C-D",
  "D-E",
  "E-F",
  "F-A",
  "A-C",
  "A-D",
  "A-E",
  "B-D",
  "B-E",
  "B-F",
  "C-E",
  "C-F",
  "D-F",
  "Ah",
  "Bh",
  "Ch",
  "Dh",
  "Eh",
  "Fh",
];

/** localStorage key used for saving/loading measurement sets. */
const STORAGE_KEY = "shadeCalcMeasurementsV1";

/**
 * Returns the localStorage key used for autosave for a given point count.
 * Separate keys for 4-point, 5-point, and 6-point prevents switching from erasing data.
 * @param {number} numpoints - 4, 5, or 6
 * @returns {string}
 */
function autosaveKey(numpoints) {
  return "shadeCalcAutosaveV1_" + numpoints;
}

/** Percent error threshold below which angle-closure is considered passing. */
const ERROR_PASS_THRESHOLD = 0.4;

/** RMS (mm) threshold below which residual-fit is considered passing. */
const RMS_PASS_THRESHOLD = 15;

/** RMS (mm) threshold below which residual-fit is considered marginal. */
const RMS_MARGINAL_THRESHOLD = 25;

/** Weight given to angle error in the combined recommendation score. */
const RECOMMENDER_ERROR_WEIGHT = 0.5;

/** Weight given to RMS mismatch in the combined recommendation score. */
const RECOMMENDER_RMS_WEIGHT = 0.5;

// ============================================================
// STATE
// ============================================================

/** @type {Array<Object>} List of current recommendation candidates. */
let currentRecommendations = [];

/** Whether the auto-update feature is enabled. */
let autoErrorUpdateEnabled = false;

/** Whether the user has pressed "Calculate Error" at least once (arms auto-update). */
let autoErrorPrimed = false;

/** Undo support: stores the last recommendation that was applied. */
let lastUndo = null;

/** Snapshot of measurement inputs before the latest change (for change-history diffing). */
let lastSnapshot = null;

/** History of measurement changes, used for the change log UI. */
let changeHistory = [];

/** Current number of points (4, 5, or 6). Initialized to 4. */
let currentNumpoints = 4;

// ============================================================
// DATA: Test values for demo / initial load
// ============================================================

/** Default test values for a 4-point sail. */
var test4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Default test values for a 5-point sail. */
var test5 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Default test values for a 6-point sail. */
var test6 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// ============================================================
// DOM HELPERS
// ============================================================

/**
 * Returns the current number of points (4, 5, or 6).
 * @returns {number}
 */
function numberofpoints() {
  return currentNumpoints;
}

/**
 * Sets up or clears the measurement input form for a given number of points.
 * @param {number} numpoints - 4, 5, or 6
 */
function measurements(numpoints) {
  currentNumpoints = numpoints;

  // Update active state on pointer buttons
  document.querySelectorAll(".ptr-btn").forEach(function (btn) {
    btn.classList.toggle(
      "active",
      parseInt(btn.getAttribute("data-ptr")) === numpoints,
    );
  });

  // Check for autosaved values for this point count (preserves data when switching 4⇄5)
  var autosaveVals = null;
  try {
    var raw = localStorage.getItem(autosaveKey(numpoints));
    if (raw) {
      var parsed = JSON.parse(raw);
      var expectedLen =
        numpoints === 4
          ? fourpoint.length
          : numpoints === 5
            ? fivepoint.length
            : sixpoint.length;
      if (
        parsed &&
        Array.isArray(parsed.values) &&
        parsed.values.length === expectedLen
      ) {
        autosaveVals = parsed.values;
      }
    }
  } catch (e) {}

  const labels =
    numpoints === 4 ? fourpoint : numpoints === 5 ? fivepoint : sixpoint;
  const perimCount = numpoints; // e.g. 4, 5, or 6
  const diagCount = numpoints === 4 ? 2 : numpoints === 5 ? 5 : 9; // diagonals
  // heights = remaining labels after perim + diag

  let html =
    '<div class="table-scroll"><table class="meas-table" cellpadding="0" cellspacing="0" align="center">';

  // Perimeters section
  html +=
    '<tr class="meas-section-header"><th colspan="2">Perimeters</th></tr>';

  let labelIdx = 0;
  const totalLabels = labels.length;

  for (let i = 0; i < perimCount; i++, labelIdx++) {
    html +=
      '<tr><td class="meas-label">' +
      labels[labelIdx] +
      "</td><td>" +
      '<input type="number" value="' +
      (autosaveVals
        ? autosaveVals[labelIdx]
        : getTestValue(numpoints, labelIdx)) +
      '" id="' +
      labels[labelIdx] +
      '" />' +
      "</td></tr>";
  }

  // Diagonals section
  html += '<tr class="meas-section-header"><th colspan="2">Diagonals</th></tr>';
  for (let i = 0; i < diagCount; i++, labelIdx++) {
    html +=
      '<tr><td class="meas-label">' +
      labels[labelIdx] +
      "</td><td>" +
      '<input type="number" value="' +
      (autosaveVals
        ? autosaveVals[labelIdx]
        : getTestValue(numpoints, labelIdx)) +
      '" id="' +
      labels[labelIdx] +
      '" />' +
      "</td></tr>";
  }

  // Heights section
  html += '<tr class="meas-section-header"><th colspan="2">Heights</th></tr>';
  while (labelIdx < totalLabels) {
    html +=
      '<tr><td class="meas-label">' +
      labels[labelIdx] +
      "</td><td>" +
      '<input type="number" value="' +
      (autosaveVals
        ? autosaveVals[labelIdx]
        : getTestValue(numpoints, labelIdx)) +
      '" id="' +
      labels[labelIdx] +
      '" />' +
      "</td></tr>";
    labelIdx++;
  }

  html += "</table></div>";

  document.getElementById("measurements").innerHTML = html;
  wireAutoErrorInputs(numpoints);
}

/**
 * Gets the default test value for a given label index.
 * @param {number} numpoints
 * @param {number} labelIndex
 * @returns {number|string}
 */
function getTestValue(numpoints, labelIndex) {
  if (numpoints === 4) {
    return test4[labelIndex];
  }
  if (numpoints === 5) {
    return test5[labelIndex];
  }
  return test6[labelIndex];
}

/**
 * Loads example data for a 5-point sail and re-renders the form.
 */
/**
 * Loads example data for a 5-point sail and re-renders the form.
 */
function example5() {
  test5 = [
    3200, 3620, 4850, 6920, 3810, 5650, 7440, 6000, 5620, 7750, 2500, 4400,
    2500, 2800, 2500,
  ];
  localStorage.removeItem(autosaveKey(5));
  measurements(5);
}

/**
 * Loads example data for a 6-point sail and re-renders the form.
 */
function example6() {
  test6 = [
    3000,
    3000,
    3000,
    3000,
    3000,
    3000, // perimeters
    5196,
    6000,
    5196,
    5196,
    6000,
    5196,
    5196,
    6000,
    5196, // diagonals
    2000,
    2000,
    2000,
    2000,
    2000,
    2000, // heights
  ];
  localStorage.removeItem(autosaveKey(6));
  measurements(6);
}

// ============================================================
// AUTO-UPDATE & INPUT WIRING
// ============================================================

/**
 * Attaches 'input' event listeners to all measurement fields so that
 * changes automatically re-trigger error calculation (when primed).
 * @param {number} numpoints
 */
function wireAutoErrorInputs(numpoints) {
  const ids =
    numpoints === 4
      ? fourpoint
      : numpoints === 5
        ? fivepoint
        : numpoints === 6
          ? sixpoint
          : [];
  for (let i = 0; i < ids.length; i++) {
    const input = document.getElementById(ids[i]);
    if (!input || input.dataset.autoErrorWired === "1") {
      continue;
    }
    input.addEventListener("input", function () {
      if (autoErrorPrimed && autoErrorUpdateEnabled) {
        disp_error();
      }
      triggerAutosave();
    });
    input.dataset.autoErrorWired = "1";
  }
}

/**
 * Updates the auto-update toggle UI to reflect current state.
 */
function setAutoUpdateUi() {
  const toggle = document.getElementById("autoUpdateToggle");
  const status = document.getElementById("autoUpdateStatus");
  if (!toggle || !status) {
    return;
  }
  toggle.disabled = !autoErrorPrimed;
  toggle.checked = autoErrorUpdateEnabled;
  if (!autoErrorPrimed) {
    status.textContent = "OFF (press Calculate Error first)";
  } else {
    status.textContent = autoErrorUpdateEnabled ? "ON" : "OFF";
  }
}

// ============================================================

// ============================================================
// AUTOSAVE (silent, automatic localStorage persistence)
// ============================================================

/** Timer handle for debounced autosave. */
let autosaveTimer = null;

/** Flag: suppresses triggerAutosave() while restoreAutosave() is populating fields. */
let isRestoringFromAutosave = false;

/**
 * Updates the on-screen autosave indicator text.
 * @param {string} msg - Message to display
 */
function updateAutosaveIndicator(msg) {
  const el = document.getElementById("autosaveIndicator");
  if (el) {
    el.textContent = msg;
  }
}

/**
 * Debounced autosave: writes current measurement state to localStorage.
 * Throttled so rapid typing does not hammer storage.
 */
function triggerAutosave() {
  if (isRestoringFromAutosave) {
    return;
  }
  const numpoints = numberofpoints();
  if (numpoints !== 4 && numpoints !== 5 && numpoints !== 6) {
    return;
  }
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
  }
  autosaveTimer = setTimeout(function () {
    const ids =
      numpoints === 4 ? fourpoint : numpoints === 5 ? fivepoint : sixpoint;
    const values = readMeasurementValues(ids);
    if (!values) {
      return;
    }
    try {
      localStorage.setItem(
        autosaveKey(numpoints),
        JSON.stringify({
          numpoints: numpoints,
          values: values,
          timestamp: new Date().toISOString(),
        }),
      );
      const timeStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      updateAutosaveIndicator("✓ Autosaved " + timeStr);
    } catch (e) {
      // Storage full or unavailable
    }
  }, 2000);
}

/**
 * Checks for a saved autosave entry in localStorage and restores it
 * (numpoints + field values) if available. Called during DOMContentLoaded.
 */
function restoreAutosave() {
  try {
    // Check all autosaves, pick the one with the newer timestamp
    var raw4 = localStorage.getItem(autosaveKey(4));
    var raw5 = localStorage.getItem(autosaveKey(5));
    var raw6 = localStorage.getItem(autosaveKey(6));
    var data4 = raw4 ? JSON.parse(raw4) : null;
    var data5 = raw5 ? JSON.parse(raw5) : null;
    var data6 = raw6 ? JSON.parse(raw6) : null;

    // Validate data structures
    if (
      data4 &&
      (!Array.isArray(data4.values) || data4.values.length !== fourpoint.length)
    ) {
      data4 = null;
    }
    if (
      data5 &&
      (!Array.isArray(data5.values) || data5.values.length !== fivepoint.length)
    ) {
      data5 = null;
    }
    if (
      data6 &&
      (!Array.isArray(data6.values) || data6.values.length !== sixpoint.length)
    ) {
      data6 = null;
    }

    // Pick the newest one
    var allData = [];
    if (data4) allData.push(data4);
    if (data5) allData.push(data5);
    if (data6) allData.push(data6);
    if (allData.length === 0) return;
    allData.sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    var data = allData[0];

    var numpoints = data === data4 ? 4 : data === data5 ? 5 : 6;
    var ids =
      numpoints === 4 ? fourpoint : numpoints === 5 ? fivepoint : sixpoint;

    // Suppress triggerAutosave while we populate: measurements() calls it, but the DOM
    // still has default test values at that point, so we must not overwrite the autosave.
    isRestoringFromAutosave = true;
    measurements(numpoints);
    writeMeasurementValues(ids, data.values);
    isRestoringFromAutosave = false;
    var timeStr = new Date(data.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    updateAutosaveIndicator("↩ Restored from " + timeStr);
  } catch (e) {
    // Corrupted data — silently ignore
  }
}

// SAVE / LOAD MEASUREMENTS (localStorage)
// ============================================================

/**
 * Retrieves the saved collection from localStorage.
 * Handles backward-compatibility with old single-save format.
 * @returns {{ sets: Object }}
 */
function getSavedCollection() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { sets: {} };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { sets: {} };
  }

  // Backward compatibility: old single-save format
  if (
    parsed &&
    !parsed.sets &&
    (parsed.numpoints === 4 || parsed.numpoints === 5) &&
    Array.isArray(parsed.values)
  ) {
    const migrated = {
      sets: {
        "Saved Set": {
          numpoints: parsed.numpoints,
          values: parsed.values,
          savedAt: parsed.savedAt || new Date().toISOString(),
        },
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.sets ||
    typeof parsed.sets !== "object"
  ) {
    return { sets: {} };
  }

  return parsed;
}

/**
 * Persists the saved collection to localStorage.
 * @param {Object} collection
 */
function setSavedCollection(collection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}

/**
 * Rebuilds the saved-sets dropdown <select> element.
 * @param {string} [selectedName] - The name to mark as selected (optional)
 */
function refreshSavedSetsDropdown(selectedName) {
  const select = document.getElementById("savedSets");
  if (!select) {
    return;
  }

  const collection = getSavedCollection();
  const names = Object.keys(collection.sets).sort();

  let html = '<option value="">Select saved set</option>';
  for (let i = 0; i < names.length; i++) {
    const selectedAttr =
      selectedName === names[i] ? ' selected="selected"' : "";
    html +=
      '<option value="' +
      names[i] +
      '"' +
      selectedAttr +
      ">" +
      names[i] +
      "</option>";
  }
  select.innerHTML = html;
}

/**
 * Gets the currently selected or typed save name.
 * @returns {string} - The save name (may be empty)
 */
function getSelectedSaveName() {
  const saveNameInput = document.getElementById("saveName");
  const savedSetsSelect = document.getElementById("savedSets");

  const typedName = saveNameInput ? saveNameInput.value.trim() : "";
  if (typedName) {
    return typedName;
  }
  if (savedSetsSelect && savedSetsSelect.value) {
    return savedSetsSelect.value;
  }
  return "";
}

/**
 * Reads measurement values from the DOM for the given list of field IDs.
 * @param {string[]} ids
 * @returns {string[]|null} - Array of string values, or null if a field is missing
 */
function readMeasurementValues(ids) {
  const values = [];
  for (let i = 0; i < ids.length; i++) {
    const input = document.getElementById(ids[i]);
    if (!input) {
      return null;
    }
    values.push(input.value);
  }
  return values;
}

/**
 * Writes measurement values to the DOM for the given list of field IDs.
 * @param {string[]} ids
 * @param {string[]} values
 */
function writeMeasurementValues(ids, values) {
  for (let i = 0; i < ids.length; i++) {
    const input = document.getElementById(ids[i]);
    if (!input) {
      continue;
    }
    input.value = values[i] ?? "";
  }
}

/**
 * Saves the current measurements to localStorage under a user-specified name.
 */
function save_measurements() {
  const numpoints = numberofpoints();
  if (numpoints !== 4 && numpoints !== 5 && numpoints !== 6) {
    alert("Generate a 4, 5, or 6 point measurement form first");
    return;
  }

  const ids =
    numpoints === 4 ? fourpoint : numpoints === 5 ? fivepoint : sixpoint;
  const values = readMeasurementValues(ids);
  if (!values) {
    alert("Measurement inputs were not found");
    return;
  }

  const saveName = getSelectedSaveName();
  if (!saveName) {
    alert("Enter a save name or choose an existing saved set");
    return;
  }

  // Capture current error values (if calculated)
  let percentError = "N/A";
  let rmsError = "N/A";
  if (autoErrorPrimed) {
    try {
      const errorVal = parseFloat(errorcheck());
      if (!isNaN(errorVal)) {
        percentError = errorVal;
      }
    } catch (e) {
      /* ignore */
    }
    try {
      const fitResult = computeResidualFit();
      if (fitResult && typeof fitResult.rms === "number") {
        rmsError = fitResult.rms;
      }
    } catch (e) {
      /* ignore */
    }
  }

  const collection = getSavedCollection();
  collection.sets[saveName] = {
    numpoints: numpoints,
    values: values,
    savedAt: new Date().toISOString(),
    percentError: percentError,
    rmsError: rmsError,
  };
  setSavedCollection(collection);

  if (document.getElementById("saveName")) {
    document.getElementById("saveName").value = saveName;
  }
  refreshSavedSetsDropdown(saveName);
  refreshSavedSetsBadge();
  renderSavedSetsTable();
  alert('Measurements saved as "' + saveName + '"');
}

/**
 * Loads a previously saved measurement set from localStorage.
 */
function load_measurements() {
  const saveName = getSelectedSaveName();
  if (!saveName) {
    alert("Enter or select a saved set name to load");
    return;
  }

  const collection = getSavedCollection();
  const payload = collection.sets[saveName];
  if (!payload) {
    alert('No saved set found named "' + saveName + '"');
    refreshSavedSetsDropdown("");
    return;
  }

  const ids =
    payload.numpoints === 4
      ? fourpoint
      : payload.numpoints === 5
        ? fivepoint
        : sixpoint;
  if (payload.values.length !== ids.length) {
    alert("Saved measurements do not match required fields");
    return;
  }

  measurements(payload.numpoints);
  writeMeasurementValues(ids, payload.values);

  if (document.getElementById("saveName")) {
    document.getElementById("saveName").value = saveName;
  }
  refreshSavedSetsDropdown(saveName);
  refreshSavedSetsBadge();
  renderSavedSetsTable();
  alert('Loaded measurements from "' + saveName + '"');
}

// ============================================================
// SAVED SETS MANAGER — TAB SWITCHING, TABLE, DELETE, IMPORT/EXPORT
// ============================================================

/**
 * Switches between the Calculator and Saved Sets tabs.
 * @param {string} tabId - 'calculator' or 'saved-sets'
 */
function switchTab(tabId) {
  const calcTab = document.getElementById("tab-calculator");
  const ssTab = document.getElementById("tab-saved-sets");
  const calcBtn = document.getElementById("tabBtnCalculator");
  const ssBtn = document.getElementById("tabBtnSavedSets");

  if (!calcTab || !ssTab || !calcBtn || !ssBtn) return;

  if (tabId === "calculator") {
    calcTab.style.display = "block";
    ssTab.style.display = "none";
    calcBtn.classList.add("active");
    ssBtn.classList.remove("active");
  } else {
    calcTab.style.display = "none";
    ssTab.style.display = "block";
    ssBtn.classList.add("active");
    calcBtn.classList.remove("active");
    // Refresh the table when switching to Saved Sets tab
    renderSavedSetsTable();
  }
}

/**
 * Returns the total number of saved sets.
 * @returns {number}
 */
function getSavedSetCount() {
  try {
    const collection = getSavedCollection();
    return Object.keys(collection.sets).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Updates the badge on the Saved Sets tab button.
 */
function refreshSavedSetsBadge() {
  const badge = document.getElementById("savedSetsBadge");
  if (badge) {
    badge.textContent = getSavedSetCount();
  }
}

/**
 * Renders the saved sets table in the manager.
 */
function renderSavedSetsTable() {
  const container = document.getElementById("savedSetsManager");
  if (!container) return;

  const collection = getSavedCollection();
  const names = Object.keys(collection.sets);

  if (names.length === 0) {
    container.innerHTML =
      '<div class="saved-sets-empty">No saved sets yet. Save a set from the Calculator tab first.</div>';
    return;
  }

  // Build sortable array
  let sets = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const s = collection.sets[name];
    let errDisplay = "N/A";
    if (
      s.percentError !== undefined &&
      s.percentError !== "N/A" &&
      s.percentError !== null
    ) {
      errDisplay = parseFloat(s.percentError).toFixed(3) + "%";
    }
    let rmsDisplay = "N/A";
    if (
      s.rmsError !== undefined &&
      s.rmsError !== "N/A" &&
      s.rmsError !== null
    ) {
      rmsDisplay = parseFloat(s.rmsError).toFixed(1) + " mm";
    }
    let dateDisplay = "?";
    if (s.savedAt) {
      try {
        dateDisplay = new Date(s.savedAt).toLocaleString();
      } catch (e) {
        dateDisplay = s.savedAt;
      }
    }
    sets.push({
      name: name,
      numpoints: s.numpoints || "?",
      errorDisplay: errDisplay,
      rmsDisplay: rmsDisplay,
      dateDisplay: dateDisplay,
      savedAt: s.savedAt || "",
    });
  }

  // Sort the sets
  sets.sort(function (a, b) {
    var result = 0;
    if (savedSetsSortBy === "name") {
      result = a.name.localeCompare(b.name);
    } else if (savedSetsSortBy === "date") {
      if (a.savedAt < b.savedAt) result = -1;
      else if (a.savedAt > b.savedAt) result = 1;
    }
    return savedSetsSortAsc ? result : -result;
  });

  let html = '<div class="saved-sets-table-wrap">';
  html += '<table class="saved-sets-table">';
  html += "<thead><tr>";
  html +=
    '<th onclick="sortSavedSets(&quot;name&quot;);">Name <span class="sort-arrow"></span></th>';
  html += "<th>Points</th>";
  html += "<th>% Error</th>";
  html += "<th>RMS</th>";
  html +=
    '<th onclick="sortSavedSets(&quot;date&quot;);">Date Saved <span class="sort-arrow"></span></th>';
  html += "<th>Actions</th>";
  html += "</tr></thead><tbody>";

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    const escapedName = s.name.replace(/'/g, "\\'");
    html += "<tr>";
    html += '<td class="set-name">' + escapeHtml(s.name) + "</td>";
    html += "<td>" + s.numpoints + "</td>";
    html += "<td>" + s.errorDisplay + "</td>";
    html += "<td>" + s.rmsDisplay + "</td>";
    html += "<td>" + s.dateDisplay + "</td>";
    html += '<td class="set-actions">';
    html +=
      '<button class="btn-load" onclick="loadSetFromManager(\'' +
      escapedName +
      "');\">Load</button>";
    html +=
      '<button class="btn-del" onclick="deleteSavedSet(\'' +
      escapedName +
      "');\">Delete</button>";
    html +=
      '<button class="btn-export" onclick="exportSingleSet(\'' +
      escapedName +
      "');\">Export</button>";
    html += "</td>";
    html += "</tr>";
  }

  html += "</tbody></table></div>";
  container.innerHTML = html;
}

/**
 * Simple HTML entity escaping.
 */
function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Loads a saved set from the manager table.
 * Switches to Calculator tab and loads the set.
 * @param {string} name
 */
function loadSetFromManager(name) {
  const collection = getSavedCollection();
  const payload = collection.sets[name];
  if (!payload) {
    alert('No saved set found named "' + name + '"');
    renderSavedSetsTable();
    return;
  }
  const ids =
    payload.numpoints === 4
      ? fourpoint
      : payload.numpoints === 5
        ? fivepoint
        : sixpoint;
  if (payload.values.length !== ids.length) {
    alert("Saved measurements do not match required fields");
    return;
  }
  measurements(payload.numpoints);
  writeMeasurementValues(ids, payload.values);
  // Fill the quick-access save name input
  var nameInput = document.getElementById("saveName");
  if (nameInput) {
    nameInput.value = name;
  }
  refreshSavedSetsDropdown(name);
  // Auto-calculate error after loading so results are visible
  setTimeout(function () {
    disp_error();
  }, 100);
  // Switch to Calculator tab
  switchTab("calculator");
}

/**
 * Deletes a single saved set after confirmation.
 * @param {string} name
 */
function deleteSavedSet(name) {
  if (!confirm('Delete saved set "' + name + '"?')) {
    return;
  }
  const collection = getSavedCollection();
  delete collection.sets[name];
  setSavedCollection(collection);
  refreshSavedSetsDropdown("");
  refreshSavedSetsBadge();
  renderSavedSetsTable();
}

/**
 * Deletes all saved sets after double confirmation.
 */
function deleteAllSavedSets() {
  if (!confirm("Delete ALL saved sets? This cannot be undone.")) {
    return;
  }
  if (!confirm("Are you sure? All saved sets will be permanently removed.")) {
    return;
  }
  const collection = getSavedCollection();
  collection.sets = {};
  setSavedCollection(collection);
  refreshSavedSetsDropdown("");
  refreshSavedSetsBadge();
  renderSavedSetsTable();
}

/**
 * Exports all saved sets as a downloadable JSON file.
 */
function exportAllSets() {
  const collection = getSavedCollection();
  const names = Object.keys(collection.sets);
  if (names.length === 0) {
    alert("No saved sets to export.");
    return;
  }
  const exportData = JSON.stringify(collection, null, 2);
  const blob = new Blob([exportData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const a = document.createElement("a");
  a.href = url;
  a.download = "shade-sets-export-" + dateStr + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports a single saved set as a downloadable JSON file.
 * @param {string} name
 */
function exportSingleSet(name) {
  const collection = getSavedCollection();
  const payload = collection.sets[name];
  if (!payload) {
    alert('No saved set found named "' + name + '"');
    return;
  }
  const exportData = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      sets: {
        [name]: payload,
      },
    },
    null,
    2,
  );
  const blob = new Blob([exportData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = "shade-set-" + safeName + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Handles importing saved sets from an uploaded JSON file.
 * @param {Event} event - File input change event
 */
function importSavedSets(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var imported = JSON.parse(e.target.result);
      if (!imported || typeof imported !== "object") {
        alert("Invalid file format: expected a JSON object.");
        return;
      }

      // Support both full collection { sets: {...} } and legacy { numpoints, values } format
      var incomingSets = {};
      if (imported.sets && typeof imported.sets === "object") {
        incomingSets = imported.sets;
      } else if (imported.numpoints && Array.isArray(imported.values)) {
        // Single-set legacy format
        incomingSets[imported.name || "Imported Set"] = {
          numpoints: imported.numpoints,
          values: imported.values,
          savedAt: imported.savedAt || new Date().toISOString(),
        };
      } else {
        // Try treating the entire imported object as a flat sets-like object
        var keys = Object.keys(imported);
        var valid = false;
        for (var k = 0; k < keys.length; k++) {
          var maybe = imported[keys[k]];
          if (maybe && maybe.numpoints && Array.isArray(maybe.values)) {
            valid = true;
            break;
          }
        }
        if (valid) {
          incomingSets = imported;
        } else {
          alert("Invalid file format: could not find any saved set data.");
          return;
        }
      }

      var incomingNames = Object.keys(incomingSets);
      if (incomingNames.length === 0) {
        alert("No saved sets found in the file.");
        return;
      }

      var collection = getSavedCollection();
      var renamed = 0;
      var added = 0;

      for (var i = 0; i < incomingNames.length; i++) {
        var inName = incomingNames[i];
        var setData = incomingSets[inName];

        // Validate structure
        if (!setData || !setData.numpoints || !Array.isArray(setData.values)) {
          continue; // skip invalid entries
        }

        var finalName = inName;
        if (collection.sets[finalName] !== undefined) {
          // Auto-rename on conflict
          var counter = 2;
          while (collection.sets[finalName] !== undefined) {
            finalName = inName + " (" + counter + ")";
            counter++;
          }
          renamed++;
        }

        collection.sets[finalName] = {
          numpoints: setData.numpoints,
          values: setData.values,
          savedAt: setData.savedAt || new Date().toISOString(),
          percentError: setData.percentError || "N/A",
          rmsError: setData.rmsError || "N/A",
        };
        added++;
      }

      setSavedCollection(collection);
      refreshSavedSetsDropdown("");
      refreshSavedSetsBadge();
      renderSavedSetsTable();

      var msg = "Imported " + added + " set" + (added !== 1 ? "s" : "") + ".";
      if (renamed > 0) {
        msg += " " + renamed + " renamed due to conflicts.";
      }
      alert(msg);
    } catch (err) {
      alert("Error reading file: " + err.message);
    }

    // Reset the file input so the same file can be re-imported
    event.target.value = "";
  };
  reader.readAsText(file);
}

// ============================================================
// TABLE SORTING
// ============================================================

/** Current sort direction for the saved sets table. */
var savedSetsSortBy = "date";
var savedSetsSortAsc = false;

/**
 * Sorts the saved sets table by the given key.
 * @param {string} key - 'name' or 'date'
 */
function sortSavedSets(key) {
  if (savedSetsSortBy === key) {
    savedSetsSortAsc = !savedSetsSortAsc;
  } else {
    savedSetsSortBy = key;
    savedSetsSortAsc = key === "name" ? true : false;
  }
  renderSavedSetsTable();
}

// ============================================================
// DEV MODE TOGGLE
// ============================================================

/**
 * Initializes the dev mode toggle at the bottom of the page.
 * Shows/hides example buttons based on checkbox state, persisted in localStorage.
 */
function initDevMode() {
  const toggle = document.getElementById("devModeToggle");
  const examples = document.getElementById("devExamples");
  if (!toggle || !examples) return;

  // Restore saved state
  const saved = localStorage.getItem("shadeDevMode") === "true";
  toggle.checked = saved;
  examples.style.display = saved ? "block" : "none";

  // Persist on change
  toggle.addEventListener("change", function () {
    const on = toggle.checked;
    localStorage.setItem("shadeDevMode", on ? "true" : "false");
    examples.style.display = on ? "block" : "none";
  });
}

// ============================================================
// DOM INITIALIZATION
// ============================================================

window.addEventListener("DOMContentLoaded", function () {
  refreshSavedSetsDropdown("");
  refreshSavedSetsBadge();
  renderSavedSetsTable();

  const savedSetsSelect = document.getElementById("savedSets");
  const saveNameInput = document.getElementById("saveName");
  const autoUpdateToggle = document.getElementById("autoUpdateToggle");
  const sizeInput = document.getElementById("size");

  setAutoUpdateUi();
  restoreAutosave();
  initDevMode();

  // When a saved set is selected from the dropdown, fill the save-name input
  if (savedSetsSelect && saveNameInput) {
    savedSetsSelect.addEventListener("change", function () {
      saveNameInput.value = savedSetsSelect.value;
    });
  }

  // Auto-update toggle handler
  if (autoUpdateToggle) {
    autoUpdateToggle.addEventListener("change", function () {
      if (!autoErrorPrimed) {
        autoUpdateToggle.checked = false;
        return;
      }
      autoErrorUpdateEnabled = autoUpdateToggle.checked;
      setAutoUpdateUi();
    });
  }

  // Size-input triggers error sweep table
  if (sizeInput) {
    sizeInput.addEventListener("input", function () {
      const sizeValue = parseFloat(sizeInput.value);
      if (!isNaN(sizeValue)) {
        error_sweep(sizeValue);
      } else {
        document.getElementById("errorcheck").innerHTML = "";
      }
    });
  }
});

// ============================================================
// MEASUREMENT EXTRACTION
// ============================================================

/**
 * Reads all current measurement values from the DOM and groups them
 * into [perimeters, diagonals, heights] arrays of numbers.
 * @returns {number[][]}
 */
function array_meas() {
  const numpoints = numberofpoints();
  const perim = [];
  const diag = [];
  const height = [];

  if (numpoints === 4) {
    for (let i = 0; i < fourpoint.length; i++) {
      const val = parseFloat(document.getElementById(fourpoint[i]).value);
      if (i < 4) {
        perim.push(val);
      } else if (i < 6) {
        diag.push(val);
      } else {
        height.push(val);
      }
    }
  } else if (numpoints === 5) {
    for (let i = 0; i < fivepoint.length; i++) {
      const val = parseFloat(document.getElementById(fivepoint[i]).value);
      if (i < 5) {
        perim.push(val);
      } else if (i < 10) {
        diag.push(val);
      } else {
        height.push(val);
      }
    }
  } else if (numpoints === 6) {
    for (let i = 0; i < sixpoint.length; i++) {
      const val = parseFloat(document.getElementById(sixpoint[i]).value);
      if (i < 6) {
        perim.push(val);
      } else if (i < 15) {
        diag.push(val);
      } else {
        height.push(val);
      }
    }
  }

  return [perim, diag, height];
}

// ============================================================
// DISTANCE CONSTRAINT BUILDING (for residual fitting)
// ============================================================

/**
 * Builds an array of distance constraint objects describing which points
 * are connected and what their measured distances are.
 *
 * @param {number} numpoints - 4, 5, or 6
 * @param {number[]} perim - Perimeter measurements
 * @param {number[]} diag  - Diagonal measurements
 * @returns {Array<{i: number, j: number, d: number, label: string}>}
 */
function buildDistanceConstraints(numpoints, perim, diag) {
  if (numpoints === 4) {
    return [
      { i: 0, j: 1, d: perim[0], label: "A-B" },
      { i: 1, j: 2, d: perim[1], label: "B-C" },
      { i: 2, j: 3, d: perim[2], label: "C-D" },
      { i: 3, j: 0, d: perim[3], label: "D-A" },
      { i: 0, j: 2, d: diag[0], label: "A-C" },
      { i: 1, j: 3, d: diag[1], label: "B-D" },
    ];
  }
  if (numpoints === 5) {
    return [
      { i: 0, j: 1, d: perim[0], label: "A-B" },
      { i: 1, j: 2, d: perim[1], label: "B-C" },
      { i: 2, j: 3, d: perim[2], label: "C-D" },
      { i: 3, j: 4, d: perim[3], label: "D-E" },
      { i: 4, j: 0, d: perim[4], label: "E-A" },
      { i: 0, j: 2, d: diag[0], label: "A-C" },
      { i: 0, j: 3, d: diag[1], label: "A-D" },
      { i: 1, j: 3, d: diag[2], label: "B-D" },
      { i: 1, j: 4, d: diag[3], label: "B-E" },
      { i: 2, j: 4, d: diag[4], label: "C-E" },
    ];
  }
  // 6-point
  return [
    { i: 0, j: 1, d: perim[0], label: "A-B" },
    { i: 1, j: 2, d: perim[1], label: "B-C" },
    { i: 2, j: 3, d: perim[2], label: "C-D" },
    { i: 3, j: 4, d: perim[3], label: "D-E" },
    { i: 4, j: 5, d: perim[4], label: "E-F" },
    { i: 5, j: 0, d: perim[5], label: "F-A" },
    { i: 0, j: 2, d: diag[0], label: "A-C" },
    { i: 0, j: 3, d: diag[1], label: "A-D" },
    { i: 0, j: 4, d: diag[2], label: "A-E" },
    { i: 1, j: 3, d: diag[3], label: "B-D" },
    { i: 1, j: 4, d: diag[4], label: "B-E" },
    { i: 1, j: 5, d: diag[5], label: "B-F" },
    { i: 2, j: 4, d: diag[6], label: "C-E" },
    { i: 2, j: 5, d: diag[7], label: "C-F" },
    { i: 3, j: 5, d: diag[8], label: "D-F" },
  ];
}

// ============================================================
// OPTIMIZATION: GRADIENT-DESCENT DISTANCE FITTING
// ============================================================

/**
 * Generates initial (x, y) guesses for points 2..N by placing them
 * on a regular polygon centered at the midpoint of A-B.
 *
 * @param {number} numpoints
 * @param {number} abHorizontal - Horizontal distance between A and B
 * @param {number[]} perim
 * @returns {number[]} - Flattened array of [x2, y2, x3, y3, ...]
 */
function makeInitialXy(numpoints, abHorizontal, perim) {
  const vars = [];
  const avgRadius =
    perim.reduce(function (acc, v) {
      return acc + Math.abs(v);
    }, 0) / perim.length;

  for (let p = 2; p < numpoints; p++) {
    const angle = (2 * Math.PI * p) / numpoints;
    vars.push(abHorizontal * 0.5 + avgRadius * Math.cos(angle));
    vars.push(avgRadius * Math.sin(angle));
  }
  return vars;
}

/**
 * Returns the (x, y) coordinates for a given point index.
 * Point 0 is always (0, 0). Point 1 is always (abHorizontal, 0).
 * Points 2+ are looked up from the variables array.
 *
 * @param {number} pointIdx - 0-based point index
 * @param {number[]} vars
 * @param {number} abHorizontal
 * @returns {[number, number]}
 */
function getXyForPoint(pointIdx, vars, abHorizontal) {
  if (pointIdx === 0) {
    return [0, 0];
  }
  if (pointIdx === 1) {
    return [abHorizontal, 0];
  }
  const offset = 2 * (pointIdx - 2);
  return [vars[offset], vars[offset + 1]];
}

/**
 * Computes the sum of squared residuals for all distance constraints
 * given the current variable positions and heights.
 *
 * @param {number} numpoints
 * @param {number[]} vars
 * @param {number} abHorizontal
 * @param {number[]} heights
 * @param {Array<{i: number, j: number, d: number}>} constraints
 * @returns {number} - Sum of squared residuals
 */
function residualCost(numpoints, vars, abHorizontal, heights, constraints) {
  let sumSquares = 0;

  for (let k = 0; k < constraints.length; k++) {
    const c = constraints[k];
    const p1 = getXyForPoint(c.i, vars, abHorizontal);
    const p2 = getXyForPoint(c.j, vars, abHorizontal);
    const dz = heights[c.i] - heights[c.j];
    const modeled = Math.sqrt(
      (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + dz ** 2,
    );
    sumSquares += (modeled - c.d) ** 2;
  }

  return sumSquares;
}

/**
 * Computes the intersection point(s) of two circles.
 * Circles: center1=(x1,y1) radius=r1, center2=(x2,y2) radius=r2.
 * @returns {Array<{x: number, y: number}>|null}
 */
function circleIntersection(x1, y1, r1, x2, y2, r2) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  var distSq = dx * dx + dy * dy;
  var dist = Math.sqrt(distSq);
  if (dist > r1 + r2 || dist < Math.abs(r1 - r2)) {
    return null;
  }
  if (dist === 0 && r1 === r2) {
    return null;
  }
  var a = (r1 * r1 - r2 * r2 + distSq) / (2 * dist);
  var hSq = r1 * r1 - a * a;
  var mx = x1 + (dx / dist) * a;
  var my = y1 + (dy / dist) * a;
  if (hSq < 0) {
    return [{ x: mx, y: my }];
  }
  var h = Math.sqrt(hSq);
  var rx = (-dy / dist) * h;
  var ry = (dx / dist) * h;
  return [
    { x: mx + rx, y: my + ry },
    { x: mx - rx, y: my - ry },
  ];
}

/**
 * Solves for the exact (x, y) positions of points C and D in a 4-point
 * shade sail using circle-circle intersection in the horizontal plane.
 * A is fixed at (0,0), B is fixed at (abHorizontal, 0).
 * Returns null when measurements are inconsistent (e.g., circles don't intersect).
 *
 * @param {number} abHorizontal - Horizontal distance between A and B
 * @param {number[]} perim - Raw perimeter measurements [AB, BC, CD, DA]
 * @param {number[]} diag  - Raw diagonal measurements [AC, BD]
 * @param {number[]} height - Heights [hA, hB, hC, hD]
 * @param {number} numpoints - Number of points (must be 4)
 * @param {Array<{i:number,j:number,d:number}>} constraints - All 6 distance constraints
 * @returns {number[]|null} - Flattened [Cx, Cy, Dx, Dy] or null
 */
function solveFourPointAnalytic(
  abHorizontal,
  perim,
  diag,
  height,
  numpoints,
  constraints,
) {
  var bcH = Math.sqrt(
    perim[1] * perim[1] - (height[1] - height[2]) * (height[1] - height[2]),
  );
  var cdH = Math.sqrt(
    perim[2] * perim[2] - (height[2] - height[3]) * (height[2] - height[3]),
  );
  var daH = Math.sqrt(
    perim[3] * perim[3] - (height[3] - height[0]) * (height[3] - height[0]),
  );
  var acH = Math.sqrt(
    diag[0] * diag[0] - (height[0] - height[2]) * (height[0] - height[2]),
  );
  var bdH = Math.sqrt(
    diag[1] * diag[1] - (height[1] - height[3]) * (height[1] - height[3]),
  );

  if (isNaN(bcH) || isNaN(cdH) || isNaN(daH) || isNaN(acH) || isNaN(bdH)) {
    return null;
  }

  var C = circleIntersection(0, 0, acH, abHorizontal, 0, bcH);
  if (!C) return null;

  var candidates = [];
  for (var ci = 0; ci < C.length; ci++) {
    var Cx = C[ci].x;
    var Cy = C[ci].y;
    var D = circleIntersection(Cx, Cy, cdH, 0, 0, daH);
    if (!D) continue;
    for (var di = 0; di < D.length; di++) {
      var vars = [Cx, Cy, D[di].x, D[di].y];
      var cst = residualCost(
        numpoints,
        vars,
        abHorizontal,
        height,
        constraints,
      );
      candidates.push({ vars: vars, cost: cst });
    }
  }

  if (candidates.length === 0) return null;
  // Return the candidate with lowest total cost (checks all 6 constraints including BD)
  var best = candidates[0];
  for (var idx = 1; idx < candidates.length; idx++) {
    if (candidates[idx].cost < best.cost) {
      best = candidates[idx];
    }
  }
  return best.vars;
}

/**
 * Uses gradient descent to find the best-fit (x, y) positions for the
 * shade sail points, minimizing the sum of squared distance residuals.
 *
 * @param {number} numpoints
 * @param {number[]} perim
 * @param {number[]} diag
 * @param {number[]} height
 * @param {number} [maxIterations=1200]
 * @returns {{ vars: number[], abHorizontal: number, constraints: Array, cost: number } | null}
 */
function optimizeDistanceFit(numpoints, perim, diag, height, maxIterations) {
  // Compute the horizontal (flattened) distance A-B from measured A-B and heights
  const abSq = perim[0] ** 2 - (height[0] - height[1]) ** 2;
  if (abSq <= 0) {
    return null;
  }
  const abHorizontal = Math.sqrt(abSq);

  const constraints = buildDistanceConstraints(numpoints, perim, diag);

  // For 4-point, try the analytic circle-intersection solver first for exact positioning
  if (numpoints === 4) {
    const analyticVars = solveFourPointAnalytic(
      abHorizontal,
      perim,
      diag,
      height,
      numpoints,
      constraints,
    );
    if (analyticVars) {
      const cost = residualCost(
        numpoints,
        analyticVars,
        abHorizontal,
        height,
        constraints,
      );
      return {
        vars: analyticVars,
        abHorizontal: abHorizontal,
        constraints: constraints,
        cost: cost,
      };
    }
  }

  // Fall back to gradient descent (for 5-point or when analytic solver fails)
  let vars = makeInitialXy(numpoints, abHorizontal, perim);
  let lr = 0.05;
  let bestCost = residualCost(
    numpoints,
    vars,
    abHorizontal,
    height,
    constraints,
  );
  const eps = 0.001;
  const iterations = maxIterations || 1200;

  for (let iter = 0; iter < iterations; iter++) {
    // Compute numerical gradient
    const grad = new Array(vars.length).fill(0);
    for (let i = 0; i < vars.length; i++) {
      const oldVal = vars[i];
      vars[i] = oldVal + eps;
      const c1 = residualCost(
        numpoints,
        vars,
        abHorizontal,
        height,
        constraints,
      );
      vars[i] = oldVal - eps;
      const c2 = residualCost(
        numpoints,
        vars,
        abHorizontal,
        height,
        constraints,
      );
      vars[i] = oldVal;
      grad[i] = (c1 - c2) / (2 * eps);
    }

    // Take a step in the negative gradient direction
    const candidate = vars.slice();
    for (let i = 0; i < candidate.length; i++) {
      candidate[i] -= lr * grad[i];
    }

    const candidateCost = residualCost(
      numpoints,
      candidate,
      abHorizontal,
      height,
      constraints,
    );
    if (candidateCost < bestCost) {
      vars = candidate;
      bestCost = candidateCost;
      lr *= 1.05; // boost learning rate on success
    } else {
      lr *= 0.5; // reduce learning rate on failure
      if (lr < 0.000001) {
        break;
      }
    }
  }

  return {
    vars: vars,
    abHorizontal: abHorizontal,
    constraints: constraints,
    cost: bestCost,
  };
}

// ============================================================
// RESIDUAL FIT COMPUTATION
// ============================================================

/**
 * Computes the residual-fit results from raw measurement arrays.
 *
 * @param {number} numpoints
 * @param {number[]} perim
 * @param {number[]} diag
 * @param {number[]} height
 * @param {number} [maxIterations=1200]
 * @returns {{ rms: number, max: Object, worstThree: Object[] } | null}
 */
function computeResidualFitFromMeasurements(
  numpoints,
  perim,
  diag,
  height,
  maxIterations,
) {
  // Validate inputs
  if (
    perim.some(function (v) {
      return isNaN(v);
    }) ||
    diag.some(function (v) {
      return isNaN(v);
    }) ||
    height.some(function (v) {
      return isNaN(v);
    })
  ) {
    return null;
  }

  const fit = optimizeDistanceFit(
    numpoints,
    perim,
    diag,
    height,
    maxIterations,
  );
  if (!fit) {
    return null;
  }

  // Compute per-constraint residuals
  const residuals = [];
  for (let k = 0; k < fit.constraints.length; k++) {
    const c = fit.constraints[k];
    const p1 = getXyForPoint(c.i, fit.vars, fit.abHorizontal);
    const p2 = getXyForPoint(c.j, fit.vars, fit.abHorizontal);
    const dz = height[c.i] - height[c.j];
    const modeled = Math.sqrt(
      (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + dz ** 2,
    );
    const residual = modeled - c.d;
    residuals.push({
      label: c.label,
      residual: residual,
      absResidual: Math.abs(residual),
    });
  }

  // Compute RMS
  const sumSquares = residuals.reduce(function (acc, r) {
    return acc + r.residual ** 2;
  }, 0);
  const rms = Math.sqrt(sumSquares / residuals.length);

  // Sort by absolute residual descending
  residuals.sort(function (a, b) {
    return b.absResidual - a.absResidual;
  });

  return { rms: rms, max: residuals[0], worstThree: residuals.slice(0, 3) };
}

/**
 * Convenience wrapper that reads measurements from the DOM and computes
 * the residual fit.
 * @returns {Object|null}
 */
function computeResidualFit() {
  const numpoints = numberofpoints();
  if (numpoints !== 4 && numpoints !== 5 && numpoints !== 6) {
    return null;
  }
  const [perim, diag, height] = array_meas();
  return computeResidualFitFromMeasurements(
    numpoints,
    perim,
    diag,
    height,
    1200,
  );
}

// ============================================================
// COMBINED RECOMMENDATION SCORE
// ============================================================

/**
 * Combines angle-error and RMS mismatch into a single score (lower is better).
 * Both are normalized to their respective pass thresholds.
 *
 * @param {number} angleError - The angle-closure percent error (may be NaN)
 * @param {number} rmsMismatch - The RMS residual in mm
 * @returns {number}
 */
function combinedRecommendationScore(angleError, rmsMismatch) {
  const normalizedAngle = isNaN(angleError)
    ? null
    : angleError / ERROR_PASS_THRESHOLD;
  const normalizedRms = rmsMismatch / RMS_PASS_THRESHOLD;

  if (normalizedAngle === null) {
    return normalizedRms;
  }

  const totalWeight = RECOMMENDER_ERROR_WEIGHT + RECOMMENDER_RMS_WEIGHT;
  if (totalWeight <= 0) {
    return normalizedRms;
  }

  return (
    (RECOMMENDER_ERROR_WEIGHT * normalizedAngle +
      RECOMMENDER_RMS_WEIGHT * normalizedRms) /
    totalWeight
  );
}

// ============================================================
// STATUS / LABELING HELPERS
// ============================================================

/**
 * Returns a { label, color } status object based on angle error value.
 * @param {number} error
 * @returns {{ label: string, color: string }}
 */
function getStatusFromError(error) {
  if (error <= 0.4) {
    return { label: "PASS", color: "green" };
  }
  if (error <= 0.7) {
    return { label: "MARGINAL", color: "#b59a00" };
  }
  return { label: "FAIL", color: "red" };
}

/**
 * Clones the three measurement arrays (shallow copy).
 * @param {number[]} perim
 * @param {number[]} diag
 * @param {number[]} height
 * @returns {number[][]}
 */
function cloneMeasurementArrays(perim, diag, height) {
  return [perim.slice(), diag.slice(), height.slice()];
}

/**
 * Returns metadata about each measurement field for a given point count.
 * Used by the recommendation engine to iterate over all measurements.
 *
 * @param {number} numpoints
 * @returns {Array<{label: string, group: string, index: number}>}
 */
function measurementMetadata(numpoints) {
  if (numpoints === 4) {
    return [
      { label: fourpoint[0], group: "perim", index: 0 },
      { label: fourpoint[1], group: "perim", index: 1 },
      { label: fourpoint[2], group: "perim", index: 2 },
      { label: fourpoint[3], group: "perim", index: 3 },
      { label: fourpoint[4], group: "diag", index: 0 },
      { label: fourpoint[5], group: "diag", index: 1 },
      { label: fourpoint[6], group: "height", index: 0 },
      { label: fourpoint[7], group: "height", index: 1 },
      { label: fourpoint[8], group: "height", index: 2 },
      { label: fourpoint[9], group: "height", index: 3 },
    ];
  }
  if (numpoints === 5) {
    return [
      { label: fivepoint[0], group: "perim", index: 0 },
      { label: fivepoint[1], group: "perim", index: 1 },
      { label: fivepoint[2], group: "perim", index: 2 },
      { label: fivepoint[3], group: "perim", index: 3 },
      { label: fivepoint[4], group: "perim", index: 4 },
      { label: fivepoint[5], group: "diag", index: 0 },
      { label: fivepoint[6], group: "diag", index: 1 },
      { label: fivepoint[7], group: "diag", index: 2 },
      { label: fivepoint[8], group: "diag", index: 3 },
      { label: fivepoint[9], group: "diag", index: 4 },
      { label: fivepoint[10], group: "height", index: 0 },
      { label: fivepoint[11], group: "height", index: 1 },
      { label: fivepoint[12], group: "height", index: 2 },
      { label: fivepoint[13], group: "height", index: 3 },
      { label: fivepoint[14], group: "height", index: 4 },
    ];
  }
  // 6-point
  return [
    { label: sixpoint[0], group: "perim", index: 0 },
    { label: sixpoint[1], group: "perim", index: 1 },
    { label: sixpoint[2], group: "perim", index: 2 },
    { label: sixpoint[3], group: "perim", index: 3 },
    { label: sixpoint[4], group: "perim", index: 4 },
    { label: sixpoint[5], group: "perim", index: 5 },
    { label: sixpoint[6], group: "diag", index: 0 },
    { label: sixpoint[7], group: "diag", index: 1 },
    { label: sixpoint[8], group: "diag", index: 2 },
    { label: sixpoint[9], group: "diag", index: 3 },
    { label: sixpoint[10], group: "diag", index: 4 },
    { label: sixpoint[11], group: "diag", index: 5 },
    { label: sixpoint[12], group: "diag", index: 6 },
    { label: sixpoint[13], group: "diag", index: 7 },
    { label: sixpoint[14], group: "diag", index: 8 },
    { label: sixpoint[15], group: "height", index: 0 },
    { label: sixpoint[16], group: "height", index: 1 },
    { label: sixpoint[17], group: "height", index: 2 },
    { label: sixpoint[18], group: "height", index: 3 },
    { label: sixpoint[19], group: "height", index: 4 },
    { label: sixpoint[20], group: "height", index: 5 },
  ];
}

/**
 * Applies a delta adjustment to one of the measurement arrays at the
 * index specified by the measure metadata.
 *
 * @param {number[]} perim
 * @param {number[]} diag
 * @param {number[]} height
 * @param {{ group: string, index: number }} measure
 * @param {number} delta
 */
function applyDeltaToArrays(perim, diag, height, measure, delta) {
  if (measure.group === "perim") {
    perim[measure.index] += delta;
  } else if (measure.group === "diag") {
    diag[measure.index] += delta;
  } else {
    height[measure.index] += delta;
  }
}

// ============================================================
// RECOMMENDATION ENGINE
// ============================================================

/**
 * Searches for adjustments to individual measurements that improve the
 * combined score (angle error + RMS mismatch). Returns up to three
 * recommendations sorted by effectiveness.
 *
 * @returns {Array<{ label: string, delta: number, newError: number, newRms: number, newScore: number, improvement: number }>}
 */
function recommendAdjustments() {
  const numpoints = numberofpoints();
  if (numpoints !== 4 && numpoints !== 5 && numpoints !== 6) {
    return [];
  }

  const [basePerim, baseDiag, baseHeight] = array_meas();
  const baseError = errorFind(
    basePerim.slice(),
    baseDiag.slice(),
    baseHeight.slice(),
  );
  const baseResidualFit = computeResidualFitFromMeasurements(
    numpoints,
    basePerim,
    baseDiag,
    baseHeight,
    300,
  );

  if (!baseResidualFit) {
    return [];
  }

  const baseScore = combinedRecommendationScore(baseError, baseResidualFit.rms);
  const angleErrorInvalid = isNaN(baseError);
  const measures = measurementMetadata(numpoints);
  const step = 5;
  const maxDelta = 80;

  // For each measurement, find the single delta that gives the best improvement
  const allCandidates = [];
  for (let m = 0; m < measures.length; m++) {
    const measure = measures[m];
    let bestForMeasure = null;

    for (let delta = -maxDelta; delta <= maxDelta; delta += step) {
      if (delta === 0) {
        continue;
      }

      const [perim, diag, height] = cloneMeasurementArrays(
        basePerim,
        baseDiag,
        baseHeight,
      );
      applyDeltaToArrays(perim, diag, height, measure, delta);

      const newError = errorFind(perim, diag, height);
      const newResidualFit = computeResidualFitFromMeasurements(
        numpoints,
        perim,
        diag,
        height,
        180,
      );
      if (!newResidualFit) {
        continue;
      }

      const newScore = combinedRecommendationScore(
        newError,
        newResidualFit.rms,
      );
      const improvement = baseScore - newScore;

      const isBetter =
        !bestForMeasure ||
        improvement > bestForMeasure.improvement ||
        (improvement === bestForMeasure.improvement &&
          newScore < bestForMeasure.newScore);

      if (isBetter) {
        bestForMeasure = {
          label: measure.label,
          delta: delta,
          newError: newError,
          newRms: newResidualFit.rms,
          newScore: newScore,
          improvement: improvement,
        };
      }
    }

    if (bestForMeasure) {
      allCandidates.push(bestForMeasure);
    }
  }

  // Filter to only candidates that actually improve the score
  const improvedCandidates = allCandidates
    .filter(function (c) {
      return c.improvement > 0;
    })
    .sort(function (a, b) {
      return b.improvement - a.improvement;
    });

  // If we have at least 3 improvers, use them directly
  if (improvedCandidates.length >= 3) {
    return improvedCandidates.slice(0, 3);
  }

  // Otherwise sort all candidates by best score (ascending)
  allCandidates.sort(function (a, b) {
    if (a.newScore === b.newScore) {
      return b.improvement - a.improvement;
    }
    return a.newScore - b.newScore;
  });

  // Merge: prefer improved candidates, then fill remaining slots with best-score
  const merged = [];
  const seen = {};

  for (let i = 0; i < improvedCandidates.length; i++) {
    const key = improvedCandidates[i].label + ":" + improvedCandidates[i].delta;
    seen[key] = true;
    merged.push(improvedCandidates[i]);
    if (merged.length >= 3) {
      return merged;
    }
  }

  for (let i = 0; i < allCandidates.length && merged.length < 3; i++) {
    const key = allCandidates[i].label + ":" + allCandidates[i].delta;
    if (seen[key]) {
      continue;
    }
    merged.push(allCandidates[i]);
    seen[key] = true;
  }

  if (merged.length > 0) {
    return merged.slice(0, 3);
  }

  // Final fallback: return best-score candidates even without improvement
  if (angleErrorInvalid) {
    return allCandidates.slice(0, 3);
  }

  return [];
}

// ============================================================
// RESIDUAL FIT RENDERING
// ============================================================

/**
 * Renders the residual-fit RMS display and combined error/RMS explanation.
 * @param {number} angleError
 * @param {string[]} nanReasons
 */
function renderResidualFit(angleError, nanReasons) {
  const target = document.getElementById("residualFit");
  if (!target) {
    return;
  }

  const result = computeResidualFit();
  if (!result) {
    target.innerHTML = "";
    return;
  }

  // Determine pass/fail status
  let residualStatus = { label: "FAIL", color: "red" };
  if (result.rms <= RMS_PASS_THRESHOLD) {
    residualStatus = { label: "PASS", color: "green" };
  } else if (result.rms <= RMS_MARGINAL_THRESHOLD) {
    residualStatus = { label: "MARGINAL", color: "#b59a00" };
  }

  let html =
    '<table border="1" cellpadding="4" align="center"><tr><th>Residual Fit</th></tr>';
  html +=
    "<tr><td><b style='color:" +
    residualStatus.color +
    ";'>" +
    residualStatus.label +
    "</b> | RMS " +
    result.rms.toFixed(1) +
    " mm | Max " +
    result.max.absResidual.toFixed(1) +
    " mm (" +
    result.max.label +
    ")</td></tr>";

  const comparisonText = explainErrorVsRms(
    angleError,
    result,
    nanReasons || [],
  );
  if (comparisonText) {
    html += "<tr><td>" + comparisonText + "</td></tr>";
  }

  html += "</table>";
  target.innerHTML = html;
}

// ============================================================
// NAN ERROR DIAGNOSTICS (why angle % error might fail)
// ============================================================

/**
 * Returns the height-pair labels that apply to a given diagonal index.
 * @param {number} numpoints
 * @param {number} diagIndex
 * @returns {{ h1: string, h2: string }}
 */
function diagHeightPairInfo(numpoints, diagIndex) {
  if (numpoints === 4) {
    return diagIndex === 0 ? { h1: "Ah", h2: "Ch" } : { h1: "Bh", h2: "Dh" };
  }
  if (numpoints === 5) {
    const pairs = [
      { h1: "Ah", h2: "Ch" },
      { h1: "Ah", h2: "Dh" },
      { h1: "Bh", h2: "Dh" },
      { h1: "Bh", h2: "Eh" },
      { h1: "Ch", h2: "Eh" },
    ];
    return pairs[diagIndex] || { h1: "?", h2: "?" };
  }
  // 6-point
  const pairs = [
    { h1: "Ah", h2: "Ch" },
    { h1: "Ah", h2: "Dh" },
    { h1: "Ah", h2: "Eh" },
    { h1: "Bh", h2: "Dh" },
    { h1: "Bh", h2: "Eh" },
    { h1: "Bh", h2: "Fh" },
    { h1: "Ch", h2: "Eh" },
    { h1: "Ch", h2: "Fh" },
    { h1: "Dh", h2: "Fh" },
  ];
  return pairs[diagIndex] || { h1: "?", h2: "?" };
}

/**
 * Diagnoses why the angle-error calculation returned NaN, producing
 * human-readable reasons.
 *
 * @param {number[]} perim
 * @param {number[]} diag
 * @param {number[]} height
 * @param {number} numpoints
 * @returns {string[]} - Up to 4 diagnostic messages
 */
function diagnoseAngleErrorNan(perim, diag, height, numpoints) {
  const reasons = [];
  const labels =
    numpoints === 4 ? fourpoint : numpoints === 5 ? fivepoint : sixpoint;

  // Check for invalid (non-finite) values
  for (let i = 0; i < perim.length; i++) {
    if (!isFinite(perim[i])) {
      reasons.push("Invalid side value at " + labels[i] + ".");
    }
  }
  for (let i = 0; i < diag.length; i++) {
    const labelIndex =
      numpoints === 4 ? 4 + i : numpoints === 5 ? 5 + i : 6 + i;
    if (!isFinite(diag[i])) {
      reasons.push("Invalid diagonal value at " + labels[labelIndex] + ".");
    }
  }
  for (let i = 0; i < height.length; i++) {
    const labelIndex =
      numpoints === 4 ? 6 + i : numpoints === 5 ? 10 + i : 15 + i;
    if (!isFinite(height[i])) {
      reasons.push("Invalid height value at " + labels[labelIndex] + ".");
    }
  }

  // Check if perimeter is shorter than height difference (imaginary horizontal length)
  const hCycle = height.slice();
  hCycle.push(height[0]);
  for (let i = 0; i < perim.length; i++) {
    const rad = perim[i] ** 2 - (hCycle[i] - hCycle[i + 1]) ** 2;
    if (rad < 0) {
      reasons.push(
        "Side " +
          labels[i] +
          " is shorter than height difference between adjacent corners, so horizontal length becomes imaginary.",
      );
    }
  }

  // Check if diagonal is shorter than height difference
  for (let i = 0; i < diag.length; i++) {
    let hA, hB;
    if (numpoints === 4) {
      hA = height[i === 0 ? 0 : 1];
      hB = height[i === 0 ? 2 : 3];
    } else if (numpoints === 5) {
      if (i < 2) {
        hA = height[0];
        hB = height[i + 2];
      } else if (i < 4) {
        hA = height[1];
        hB = height[i + 1];
      } else {
        hA = height[2];
        hB = height[i];
      }
    } else {
      // 6-point
      if (i < 3) {
        hA = height[0];
        hB = height[i + 2];
      } else if (i < 6) {
        hA = height[1];
        hB = height[i];
      } else if (i < 8) {
        hA = height[2];
        hB = height[i - 2];
      } else {
        hA = height[3];
        hB = height[i - 3];
      }
    }
    const rad = diag[i] ** 2 - (hA - hB) ** 2;
    if (rad < 0) {
      const info = diagHeightPairInfo(numpoints, i);
      const labelIndex =
        numpoints === 4 ? 4 + i : numpoints === 5 ? 5 + i : 6 + i;
      reasons.push(
        "Diagonal " +
          labels[labelIndex] +
          " is shorter than vertical difference (" +
          info.h1 +
          " vs " +
          info.h2 +
          "), so horizontal diagonal is invalid.",
      );
    }
  }

  // Check cosine-rule angle validity (ratio in [-1, 1])
  const [perimNorm, diagNorm] = normalised(
    perim.slice(),
    diag.slice(),
    height.slice(),
  );
  const invalidAngles = [];

  if (numpoints === 4 && perimNorm.length === 4 && diagNorm.length === 2) {
    let j = 1;
    for (let i = 0; i < 4; i++) {
      const aSide = i === 0 ? perimNorm[3] : perimNorm[i - 1];
      const bSide = perimNorm[i];
      const cSide = diagNorm[j];
      const denom = 2 * aSide * bSide;
      const ratio =
        denom === 0 ? NaN : (aSide ** 2 + bSide ** 2 - cSide ** 2) / denom;
      if (!isFinite(ratio) || ratio < -1 || ratio > 1) {
        invalidAngles.push(labels[i] + " corner (cos ratio out of range)");
      }
      j = j === 0 ? 1 : 0;
    }
  } else if (
    numpoints === 5 &&
    perimNorm.length === 5 &&
    diagNorm.length === 5
  ) {
    const order = [3, 0, 2, 4, 1];
    for (let i = 0; i < 5; i++) {
      const aSide = i === 0 ? perimNorm[4] : perimNorm[i - 1];
      const bSide = perimNorm[i];
      const cSide = diagNorm[order[i]];
      const denom = 2 * aSide * bSide;
      const ratio =
        denom === 0 ? NaN : (aSide ** 2 + bSide ** 2 - cSide ** 2) / denom;
      if (!isFinite(ratio) || ratio < -1 || ratio > 1) {
        invalidAngles.push(
          labels[i] +
            " corner (likely reflex/internal or inconsistent lengths)",
        );
      }
    }
  } else if (
    numpoints === 6 &&
    perimNorm.length === 6 &&
    diagNorm.length === 9
  ) {
    const order = [5, 0, 3, 6, 8, 2];
    for (let i = 0; i < 6; i++) {
      const aSide = i === 0 ? perimNorm[5] : perimNorm[i - 1];
      const bSide = perimNorm[i];
      const cSide = diagNorm[order[i]];
      const denom = 2 * aSide * bSide;
      const ratio =
        denom === 0 ? NaN : (aSide ** 2 + bSide ** 2 - cSide ** 2) / denom;
      if (!isFinite(ratio) || ratio < -1 || ratio > 1) {
        invalidAngles.push(
          labels[i] +
            " corner (likely reflex/internal or inconsistent lengths)",
        );
      }
    }
  }

  if (invalidAngles.length > 0) {
    reasons.push(
      "Cosine-rule angle calculation failed at: " +
        invalidAngles.join(", ") +
        ".",
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "Inputs are likely non-convex (internal/reflex corner) so angle-sum % error is not valid.",
    );
  }

  return reasons.slice(0, 4);
}

// ============================================================
// EXPLANATION TEXT HELPERS (Error vs RMS)
// ============================================================

/**
 * Generates explanatory text for when angle-error is NaN but RMS is available.
 * @param {string[]} reasons
 * @param {Object|null} residualFitResult
 * @returns {string}
 */
function explainNanVsRms(reasons, residualFitResult) {
  if (!residualFitResult) {
    return "";
  }

  if (residualFitResult.rms > RMS_PASS_THRESHOLD) {
    return "Both checks are struggling: angle-based % error failed and RMS is also above PASS threshold.";
  }

  const likelyConcave = reasons.some(function (r) {
    return (
      r.toLowerCase().includes("reflex") ||
      r.toLowerCase().includes("internal") ||
      r.toLowerCase().includes("cosine-rule angle")
    );
  });

  if (likelyConcave) {
    return (
      "RMS is passing because distance fitting can handle concave/internal-corner layouts, " +
      "while % error fails because the angle-sum method assumes convex corner behavior."
    );
  }

  return (
    "RMS is passing because distances are still broadly consistent, " +
    "but % error failed due to an angle-method limitation or invalid intermediate angle step."
  );
}

/**
 * Generates a short explanation comparing angle-error and RMS results.
 * @param {number} angleError
 * @param {Object|null} residualFitResult
 * @param {string[]} reasons
 * @returns {string}
 */
function explainErrorVsRms(angleError, residualFitResult, reasons) {
  if (!residualFitResult) {
    return "";
  }

  if (isNaN(angleError)) {
    return explainNanVsRms(reasons || [], residualFitResult);
  }

  const anglePass = angleError <= ERROR_PASS_THRESHOLD;
  const rmsPass = residualFitResult.rms <= RMS_PASS_THRESHOLD;

  if (anglePass && rmsPass) {
    return "Both metrics pass: angle-closure and distance-fit checks agree.";
  }
  if (!anglePass && !rmsPass) {
    return "Both metrics fail: measurements are likely inconsistent and should be rechecked.";
  }
  if (anglePass && !rmsPass) {
    return "Angle % error passes but RMS fails: corner-angle closure is acceptable, but pairwise distances still disagree.";
  }
  return "RMS passes but angle % error fails: distances fit well, but angle-sum assumptions may not match this layout.";
}

// ============================================================
// CORE MATH: NORMALISATION & ANGLE COMPUTATION
// ============================================================

/**
 * Computes horizontal (flattened) perimeter and diagonal lengths by
 * subtracting the vertical (height-difference) component via Pythagoras.
 *
 * NOTE: Temporarily appends a copy of height[0] to the height array to
 * simplify cyclical height-difference indexing; the extra element is
 * removed before returning.
 *
 * @param {number[]} perim - Side lengths
 * @param {number[]} diag  - Diagonal lengths
 * @param {number[]} height - Corner heights (will be mutated then restored)
 * @returns {[number[], number[]]} - [normalisedPerim, normalisedDiag]
 */
function normalised(perim, diag, height) {
  const perimNorm = [];
  const diagNorm = [];

  // Append first height to simplify cyclical reference
  height.push(height[0]);

  function normPerim(i) {
    return Math.sqrt(perim[i] ** 2 - (height[i] - height[i + 1]) ** 2);
  }

  if (perim.length === 4) {
    for (let i = 0; i < perim.length; i++) {
      perimNorm.push(normPerim(i));
      if (i < diag.length) {
        diagNorm.push(
          Math.sqrt(diag[i] ** 2 - (height[i] - height[i + 2]) ** 2),
        );
      }
    }
  } else if (perim.length === 5) {
    for (let i = 0; i < perim.length; i++) {
      perimNorm.push(normPerim(i));
      if (i < 2) {
        diagNorm.push(
          Math.sqrt(diag[i] ** 2 - (height[0] - height[i + 2]) ** 2),
        );
      } else if (i < 4) {
        diagNorm.push(
          Math.sqrt(diag[i] ** 2 - (height[1] - height[i + 1]) ** 2),
        );
      } else {
        diagNorm.push(Math.sqrt(diag[i] ** 2 - (height[2] - height[i]) ** 2));
      }
    }
  } else if (perim.length === 6) {
    // 6-point: 6 perimeters + 9 diagonals (more diagonals than perimeters)
    for (let i = 0; i < perim.length; i++) {
      perimNorm.push(normPerim(i));
    }
    // Compute all 9 diagonal normalisations
    for (let i = 0; i < diag.length; i++) {
      var dh;
      if (i < 3) {
        // A-C (0): h0-h2, A-D (1): h0-h3, A-E (2): h0-h4
        dh = height[0] - height[i + 2];
      } else if (i < 6) {
        // B-D (3): h1-h3, B-E (4): h1-h4, B-F (5): h1-h5
        dh = height[1] - height[i];
      } else if (i < 8) {
        // C-E (6): h2-h4, C-F (7): h2-h5
        dh = height[2] - height[i - 2];
      } else {
        // D-F (8): h3-h5
        dh = height[3] - height[i - 3];
      }
      diagNorm.push(Math.sqrt(diag[i] ** 2 - dh ** 2));
    }
  } else {
    alert("error with normalising");
  }

  height.pop(); // restore original height array length
  return [perimNorm, diagNorm];
}

/**
 * Computes the angle opposite side 'c' in a triangle with sides a, b, c
 * using the cosine rule. Returns angle in degrees.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @returns {number} - Angle in degrees
 */
function findAngle(a, b, c) {
  const x = Math.acos((a ** 2 + b ** 2 - c ** 2) / (2 * b * a));
  return (x * 180) / Math.PI;
}

/**
 * Computes the angle-closure percent error for the given measurements.
 * Uses normalised (horizontal) lengths and the cosine rule to find each
 * interior corner angle, sums them, and compares to the expected sum.
 *
 * Expected sum = (numpoints - 2) * 180 degrees.
 *
 * @param {number[]} perim
 * @param {number[]} diag
 * @param {number[]} height
 * @returns {number} - Percent error (NaN if geometry is invalid)
 */
function errorFind(perim, diag, height) {
  const numpoints = numberofpoints();
  const [perimNorm, diagNorm] = normalised(perim, diag, height);
  const sum = [];

  if (numpoints === 4) {
    let j = 1;
    for (let i = 0; i < numpoints; i++) {
      const aSide = i === 0 ? perimNorm[3] : perimNorm[i - 1];
      const bSide = perimNorm[i];
      const cSide = diagNorm[j];
      sum.push(findAngle(aSide, bSide, cSide));
      j = j === 0 ? 1 : 0;
    }
  } else if (numpoints === 5) {
    const order = [3, 0, 2, 4, 1];
    for (let i = 0; i < numpoints; i++) {
      const aSide = i === 0 ? perimNorm[4] : perimNorm[i - 1];
      const bSide = perimNorm[i];
      const cSide = diagNorm[order[i]];
      sum.push(findAngle(aSide, bSide, cSide));
    }
  } else if (numpoints === 6) {
    const order = [5, 0, 3, 6, 8, 2];
    for (let i = 0; i < numpoints; i++) {
      const aSide = i === 0 ? perimNorm[5] : perimNorm[i - 1];
      const bSide = perimNorm[i];
      const cSide = diagNorm[order[i]];
      sum.push(findAngle(aSide, bSide, cSide));
    }
  }

  const totalSum = sum.reduce(function (acc, curr) {
    return acc + curr;
  }, 0);

  const expectedSum = (numpoints - 2) * 180;
  const error = (Math.abs(totalSum - expectedSum) / expectedSum) * 100;
  return error;
}

/**
 * Convenience wrapper: reads from DOM and computes error as a fixed-3-decimal string.
 * @returns {string}
 */
function errorcheck() {
  const [perim, diag, height] = array_meas();
  const error = errorFind(perim, diag, height);
  return error.toFixed(3);
}

// ============================================================
// ERROR SWEEP TABLE
// ============================================================

/**
 * Generates a single clickable cell for the error-sweep table.
 * @param {number} error
 * @param {string} label
 * @param {number} delta
 * @returns {string} - HTML for the cell
 */
function makeSweepCellHtml(error, label, delta) {
  const deltaText = (delta >= 0 ? "+" : "") + delta + " mm";
  const clickAttr =
    ' class="sweep-clickable" onclick="applySweepAdjustment(\'' +
    label +
    "'," +
    delta +
    ')" title="Click to adjust by ' +
    deltaText +
    '"';
  const errorText = error.toFixed(3);

  if (error < 0.3) {
    return (
      '<td class="sweep-green"><span class="sweep-cell"' +
      clickAttr +
      ">" +
      errorText +
      "</span></td>"
    );
  }
  if (error < 0.6) {
    return (
      '<td class="sweep-yellow"><span class="sweep-cell"' +
      clickAttr +
      ">" +
      errorText +
      "</span></td>"
    );
  }
  return (
    '<td><span class="sweep-cell"' +
    clickAttr +
    ">" +
    errorText +
    "</span></td>"
  );
}

/**
 * Cycles through all measurement fields and builds the sweep table HTML.
 * For each measurement, adjusts it by -5*size to +5*size in steps of size,
 * and reports the resulting angle error.
 *
 * @param {number} size - Adjustment step in mm
 * @returns {string} - Full table HTML (header rows + body rows)
 */
function errorCycle(size) {
  const numpoints = numberofpoints();
  const [perim, diag, height] = array_meas();

  let errorPerim = "";
  let errorDiag = "";
  let errorHeight = "";
  let errorHead = "";

  // Sweep perimeters
  for (let i = 0; i < perim.length; i++) {
    const temp = perim[i];
    const label =
      numpoints === 4
        ? fourpoint[i]
        : numpoints === 5
          ? fivepoint[i]
          : sixpoint[i];
    errorPerim += '<tr><td class="sweep-label">' + label + "</td>";
    for (let j = -5; j < 6; j++) {
      if (i === 0) {
        errorHead += "<th>" + (j * size).toFixed(2) + "</th>";
      }
      perim[i] += j * size;
      const err = errorFind(perim, diag, height);
      errorPerim += makeSweepCellHtml(err, label, j * size);
      perim[i] = temp; // restore
    }
    errorPerim += "</tr>";
  }

  // Sweep diagonals
  for (let i = 0; i < diag.length; i++) {
    const temp = diag[i];
    const label =
      numpoints === 4
        ? fourpoint[i + numpoints]
        : numpoints === 5
          ? fivepoint[i + numpoints]
          : sixpoint[i + 6];
    errorDiag += '<tr><td class="sweep-label">' + label + "</td>";
    for (let j = -5; j < 6; j++) {
      diag[i] += j * size;
      const err = errorFind(perim, diag, height);
      errorDiag += makeSweepCellHtml(err, label, j * size);
      diag[i] = temp;
    }
    errorDiag += "</tr>";
  }

  // Sweep heights
  for (let i = 0; i < height.length; i++) {
    const temp = height[i];
    const label =
      numpoints === 4
        ? fourpoint[i + numpoints + 2]
        : numpoints === 5
          ? fivepoint[i + numpoints + 5]
          : sixpoint[i + 15];
    errorHeight += '<tr><td class="sweep-label">' + label + "</td>";
    for (let j = -5; j < 6; j++) {
      height[i] += j * size;
      const err = errorFind(perim, diag, height);
      errorHeight += makeSweepCellHtml(err, label, j * size);
      height[i] = temp;
    }
    errorHeight += "</tr>";
  }

  return errorHead + errorPerim + errorDiag + errorHeight;
}

/**
 * Renders the full error-sweep table into the DOM.
 * @param {number} size
 */
function error_sweep(size) {
  let html =
    '<table class="sweep-table" align="center"><tr><th>Measurment</th>';
  html += errorCycle(size);
  html += "</table>";
  document.getElementById("errorcheck").innerHTML = html;
}

// ============================================================
// SWEEP TABLE: CLICK-TO-ADJUST
// ============================================================

/**
 * Applies a delta adjustment from the sweep table to a measurement field
 * and re-runs the error calculation and sweep table.
 * @param {string} label - The measurement field ID
 * @param {number} delta - Adjustment in mm
 */
function applySweepAdjustment(label, delta) {
  const input = document.getElementById(label);
  if (!input) {
    return;
  }

  const currentValue = parseFloat(input.value);
  if (isNaN(currentValue)) {
    return;
  }

  input.value = currentValue + delta;

  // Recalculate error and recommendations
  disp_error();

  // Re-render the sweep table if a size value is set
  const sizeInput = document.getElementById("size");
  if (sizeInput) {
    const sizeValue = parseFloat(sizeInput.value);
    if (!isNaN(sizeValue)) {
      error_sweep(sizeValue);
    }
  }
}

// ============================================================
// SNAPSHOT / CHANGE HISTORY
// ============================================================

/**
 * Takes a snapshot of the current measurement field values for change tracking.
 * @returns {Object|null} - Map of id -> value, or null if not applicable
 */
function snapshotMeasurements() {
  const numpoints = numberofpoints();
  if (numpoints !== 4 && numpoints !== 5 && numpoints !== 6) {
    return null;
  }

  const ids =
    numpoints === 4 ? fourpoint : numpoints === 5 ? fivepoint : sixpoint;
  const snap = {};
  for (let i = 0; i < ids.length; i++) {
    const input = document.getElementById(ids[i]);
    if (input) {
      snap[ids[i]] = input.value;
    }
  }
  return snap;
}

// ============================================================
// CLEAR ALL
// ============================================================

/**
 * Clears all measurement input fields and resets result displays.
 */
function clear_all() {
  if (
    !confirm("Are you sure you want to clear all measurements and results?")
  ) {
    return;
  }

  const numpoints = numberofpoints();

  let ids;
  if (numpoints === 4 || numpoints === 5 || numpoints === 6) {
    ids = numpoints === 4 ? fourpoint : numpoints === 5 ? fivepoint : sixpoint;
  } else {
    // If no valid config, try all known IDs
    ids = fourpoint.concat(fivepoint).concat(sixpoint);
  }

  for (let i = 0; i < ids.length; i++) {
    const input = document.getElementById(ids[i]);
    if (input) {
      input.value = "";
    }
  }

  // Clear result displays
  document.getElementById("Error").innerHTML = "";
  document.getElementById("residualFit").innerHTML = "";
  document.getElementById("recommendations").innerHTML = "";
  document.getElementById("errorcheck").innerHTML = "";
}

// ============================================================
// MAIN DISPLAY FUNCTION
// ============================================================

/**
 * The primary "Calculate Error" entry point. Reads measurements, computes
 * angle error and residual fit, renders recommendations, and tracks change history.
 */
function disp_error() {
  // Arm auto-update on first use
  if (!autoErrorPrimed) {
    autoErrorPrimed = true;
    autoErrorUpdateEnabled = true;
    setAutoUpdateUi();
  }

  // --- Change history tracking ---
  const currentSnapshot = snapshotMeasurements();
  if (lastSnapshot && currentSnapshot) {
    const changes = [];
    const ids = Object.keys(currentSnapshot);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const oldVal = lastSnapshot[id];
      const newVal = currentSnapshot[id];
      if (oldVal !== newVal) {
        changes.push({ id: id, from: oldVal, to: newVal });
      }
    }

    if (changes.length > 0) {
      let currError = "?";
      try {
        currError = errorcheck();
      } catch (e) {
        // ignore
      }
      changeHistory.push({
        changes: changes,
        error: currError,
        time: new Date(),
      });

      // Keep only the 20 most recent entries
      if (changeHistory.length > 20) {
        changeHistory = changeHistory.slice(-20);
      }
    }
  }
  lastSnapshot = currentSnapshot;

  // --- Compute and display error ---
  const error = errorcheck();
  const errorNum = parseFloat(error);

  // Choose table border color based on error level
  let borderColor;
  if (isNaN(errorNum)) {
    borderColor = "#666666";
  } else if (errorNum > 0.4) {
    borderColor = "red";
  } else {
    borderColor = "green";
  }

  let html =
    '<table border="5" bordercolor="' +
    borderColor +
    '" cellpadding="3" align="center"><tr><th>Error</th></tr>';
  html += "<tr><td>" + error + "</td></tr>";

  // If NaN, provide diagnostic information
  let nanReasons = [];
  if (isNaN(errorNum)) {
    const [perim, diag, height] = array_meas();
    const reasons = diagnoseAngleErrorNan(
      perim,
      diag,
      height,
      numberofpoints(),
    );
    nanReasons = reasons;

    const residualResult = computeResidualFitFromMeasurements(
      numberofpoints(),
      perim,
      diag,
      height,
      300,
    );
    const contrastExplanation = explainNanVsRms(reasons, residualResult);

    html +=
      "<tr><td><b>Why NaN:</b><br/>- " + reasons.join("<br/>- ") + "</td></tr>";
    if (contrastExplanation) {
      html +=
        "<tr><td><b>Why RMS can still pass:</b><br/>" +
        contrastExplanation +
        "</td></tr>";
    }
  }
  html += "</table>";

  document.getElementById("Error").innerHTML = html;

  // Render recommendations and residual fit
  renderRecommendations(errorNum);
  renderResidualFit(errorNum, nanReasons);
  renderChangeHistory();
}

// ============================================================
// RECOMMENDATIONS RENDERING
// ============================================================

/**
 * Renders the recommendations table, showing suggested adjustments
 * for each measurement to improve the combined error/RMS score.
 * @param {number} currentError
 */
function renderRecommendations(currentError) {
  const target = document.getElementById("recommendations");
  if (!target) {
    return;
  }

  const status = isNaN(currentError)
    ? { label: "N/A", color: "#666666" }
    : getStatusFromError(currentError);

  const recommendations = recommendAdjustments();
  currentRecommendations = recommendations;

  let html = '<div class="rec-table-wrap">';
  html += '<table border="1" cellpadding="6" align="center">';
  html += '<tr><th colspan="6">Recommendations (Combined Score)</th></tr>';
  html +=
    '<tr><td colspan="6"><b style="color:' +
    status.color +
    ';">Status: ' +
    status.label +
    "</b> | Error: " +
    (isNaN(currentError) ? "N/A" : currentError.toFixed(3) + "%") +
    "</td></tr>";

  if (recommendations.length === 0) {
    html +=
      '<tr><td colspan="6">No improvement suggestions available for combined-score search range.</td></tr>';
  } else {
    html +=
      "<tr><th>Measurement</th><th>Adjust</th><th>Est. Error</th><th>Est. RMS</th><th>Combined Score</th><th>Action</th></tr>";
    for (let i = 0; i < recommendations.length; i++) {
      const r = recommendations[i];
      const deltaText = (r.delta > 0 ? "+" : "") + r.delta + " mm";
      html += "<tr>";
      html += "<td>" + r.label + "</td>";
      html += "<td>" + deltaText + "</td>";
      html +=
        "<td>" +
        (isNaN(r.newError) ? "N/A" : r.newError.toFixed(3) + "%") +
        "</td>";
      html += "<td>" + r.newRms.toFixed(1) + " mm</td>";
      html += "<td>" + r.newScore.toFixed(3) + "</td>";
      html +=
        '<td><input type="button" value="Apply" onclick="applyRecommendation(' +
        i +
        ');" /></td>';
      html += "</tr>";
    }

    // Show Undo button if there is something to undo
    if (lastUndo) {
      html +=
        '<tr><td colspan="6"><input class="undo-btn" type="button" value="↩ Undo last change" onclick="undoRecommendation();" /></td></tr>';
    }
  }

  html += "</table>";
  html += "</div>";
  target.innerHTML = html;
}

// ============================================================
// RECOMMENDATION ACTIONS
// ============================================================

/**
 * Applies a recommendation by adjusting the measurement field value
 * and recalculating errors.
 * @param {number} index - Index into currentRecommendations array
 */
function applyRecommendation(index) {
  const recommendation = currentRecommendations[index];
  if (!recommendation) {
    alert("Recommendation is not available");
    return;
  }

  const input = document.getElementById(recommendation.label);
  if (!input) {
    alert("Measurement input was not found");
    return;
  }

  const currentValue = parseFloat(input.value);
  if (isNaN(currentValue)) {
    alert("Measurement value is not a valid number");
    return;
  }

  // Save undo info before changing
  lastUndo = {
    id: recommendation.label,
    previousValue: currentValue,
    newValue: currentValue + recommendation.delta,
  };

  input.value = currentValue + recommendation.delta;
  disp_error();
}

/**
 * Reverts the last applied recommendation.
 */
function undoRecommendation() {
  if (!lastUndo) {
    return;
  }

  const input = document.getElementById(lastUndo.id);
  if (!input) {
    lastUndo = null;
    return;
  }

  input.value = lastUndo.previousValue;
  lastUndo = null;
  disp_error();
}

// ============================================================
// CHANGE HISTORY RENDERING
// ============================================================

/**
 * Renders the change history log beneath the recommendations section.
 */
function renderChangeHistory() {
  const target = document.getElementById("recommendations");
  if (!target) {
    return;
  }

  // Find or create the change log container
  let existingLog = document.getElementById("changeLog");
  if (!existingLog) {
    existingLog = document.createElement("div");
    existingLog.id = "changeLog";
    target.parentNode.appendChild(existingLog);
  }

  if (changeHistory.length === 0) {
    existingLog.innerHTML = "";
    return;
  }

  // Build the history in reverse order (newest first)
  let html = "<details>";
  html +=
    "<summary>📋 Change history (" +
    changeHistory.length +
    " entry" +
    (changeHistory.length !== 1 ? "s" : "") +
    ")</summary>";

  for (let h = changeHistory.length - 1; h >= 0; h--) {
    const entry = changeHistory[h];
    if (!entry.changes || entry.changes.length === 0) {
      continue;
    }

    html +=
      '<div style="margin-top: 8px; border-top: 1px solid #d9dee5; padding-top: 6px;">';
    for (let i = 0; i < entry.changes.length; i++) {
      const c = entry.changes[i];
      html += "• <b>" + c.id + "</b>: " + c.from + " → " + c.to + "<br/>";
    }
    if (entry.error !== "?") {
      html += "📊 Error: <b>" + entry.error + "%</b>";
    }
    html += "</div>";
  }

  html += "</details>";
  existingLog.innerHTML = html;
}

// ============================================================
// COORDINATE COMPUTATION (for 3D drawing)
// ============================================================

/**
 * Computes 3D coordinates for each corner of the shade sail based on
 * the normalised (horizontal) lengths and heights.
 *
 * Uses cosine-rule to find the angle needed to position each point
 * relative to the baseline A-B.
 *
 * @returns {Array<[number, number, number]>} - Array of [x, y, z] tuples
 */
function find_coord() {
  const [perim, diag, height] = array_meas();
  const [perimNorm, diagNorm] = normalised(perim, diag, height);
  const numpoints = numberofpoints();

  // Anchor points A and B
  const a = [0, 0, height[0]];
  const b = [0, perimNorm[0], height[1]];

  function placePoint(sideFromA, sideBetween) {
    let angle = findAngle(sideFromA, perimNorm[0], sideBetween);
    angle = angle < 90 ? 90 - angle : angle * -1 + 90;
    return [
      sideFromA * Math.cos((angle * Math.PI) / 180),
      sideFromA * Math.sin((angle * Math.PI) / 180),
    ];
  }

  if (numpoints === 4) {
    // Point C: using diagonal A-C and sides A-B, B-C
    var pos = placePoint(diagNorm[0], perimNorm[1]);
    const c = [pos[0], pos[1], height[2]];
    // Point D: using diagonal B-D and sides A-B, D-A
    pos = placePoint(perimNorm[3], diagNorm[1]);
    const d = [pos[0], pos[1], height[3]];
    return [a, b, c, d];
  }

  if (numpoints === 5) {
    // Point C: using diagonal A-C
    var pos = placePoint(diagNorm[0], perimNorm[1]);
    const c = [pos[0], pos[1], height[2]];
    // Point D: using diagonals A-D and B-D
    pos = placePoint(diagNorm[1], diagNorm[2]);
    const d = [pos[0], pos[1], height[3]];
    // Point E: using diagonal B-E and sides E-A, A-B
    pos = placePoint(perimNorm[4], diagNorm[3]);
    const e = [pos[0], pos[1], height[4]];
    return [a, b, c, d, e];
  }

  // 6-point
  var pos = placePoint(diagNorm[0], perimNorm[1]);
  const c = [pos[0], pos[1], height[2]];
  pos = placePoint(diagNorm[1], diagNorm[3]);
  const d = [pos[0], pos[1], height[3]];
  pos = placePoint(diagNorm[2], diagNorm[4]);
  const e = [pos[0], pos[1], height[4]];
  pos = placePoint(perimNorm[5], diagNorm[5]);
  const f = [pos[0], pos[1], height[5]];
  return [a, b, c, d, e, f];
}

// ============================================================
// 3D DRAWING (Plotly)
// ============================================================

/**
 * Renders a 3D plot of the shade sail using Plotly.
 * Shows corner markers and a semi-transparent mesh surface.
 */
function draw() {
  const numpoints = numberofpoints();
  if (numpoints !== 4 && numpoints !== 5 && numpoints !== 6) {
    alert("nothing to draw");
    return;
  }

  const error = errorcheck();
  if (isNaN(error)) {
    alert("can't draw if measurements don't make sense");
    return;
  }

  const coords = find_coord();
  const labels = ["A", "B", "C", "D", "E", "F"];
  const xs = coords.map(function (p) {
    return p[0];
  });
  const ys = coords.map(function (p) {
    return p[1];
  });
  const zs = coords.map(function (p) {
    return p[2];
  });

  const data = [
    {
      x: xs,
      y: ys,
      z: zs,
      mode: "markers+text",
      type: "scatter3d",
      text: labels.slice(0, numpoints),
      marker: { color: "rgb(255, 0, 0)", size: 3 },
      hoverinfo: "none",
    },
    {
      alphahull: -1,
      opacity: 0.4,
      color: "rgb(255,128,0)",
      type: "mesh3d",
      x: xs,
      y: ys,
      z: zs,
      hoverinfo: "none",
    },
  ];

  const drawContainer = document.getElementById("drawing");
  const containerWidth = drawContainer ? drawContainer.clientWidth || 800 : 800;
  const isMobile = window.innerWidth < 768;
  const drawHeight = isMobile ? Math.min(400, containerWidth * 0.75) : 640;

  const layout = {
    autosize: true,
    height: drawHeight,
    scene: {
      aspectratio: { x: 1, y: 1, z: 1 },
      aspectmode: "data",
      camera: {
        center: { x: 0, y: 0, z: 0 },
        eye: { x: 2, y: 2, z: 2 },
        up: { x: 0, y: 0, z: 1 },
      },
      xaxis: { type: "linear", zeroline: false },
      yaxis: { type: "linear", zeroline: false },
      zaxis: { type: "linear", zeroline: false },
    },
    title: "rough shade sail model",
    width: containerWidth,
  };

  Plotly.newPlot("drawing", data, layout);
}
