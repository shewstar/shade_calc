const fourpoint = ["A-B", "B-C", "C-D", "D-A", "A-C", "B-D", "Ah", "Bh", "Ch", "Dh"];
const fivepoint = ["A-B", "B-C", "C-D", "D-E", "E-A", "A-C", "A-D", "B-D", "B-E", "C-E", "Ah", "Bh", "Ch", "Dh", "Eh"];
const STORAGE_KEY = "shadeCalcMeasurementsV1";
const ERROR_PASS_THRESHOLD = 0.4;
const RMS_PASS_THRESHOLD = 15;
const RMS_MARGINAL_THRESHOLD = 25;
const RECOMMENDER_ERROR_WEIGHT = 0.5;
const RECOMMENDER_RMS_WEIGHT = 0.5;
let currentRecommendations = [];
let autoErrorUpdateEnabled = false;
let autoErrorPrimed = false;
var test4 = [3, 4, 3, 4, 5, 5, 2, 2, 2, 2];
var test5 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
function example5() {
    test5 = [3200, 3620, 4850, 6920, 3810, 5650, 7440, 6000, 5620, 7750, 2500, 4400, 2500, 2800, 2500];
    document.getElementById("numpoints").value = 5;
    measurements(5);
}
function measurements(numpoints) {
    var text = '<table border="1" cellpadding="6" align="center"><tr><th>Perimeters</th></tr>';
    if (numpoints == 4) {
        for (i = 0; i < fourpoint.length + 2; i++) {
            if (i < 4) {
                text += "<tr><td>" + fourpoint[i] + " " + '<input type="number" value="' + test4[i] + '" id="' + fourpoint[i] + '" size="6"/></td></tr>';
            } else if (i == 4) {
                text += "<tr><th>Diagonals</th></tr>";
            } else if (i < 7) {
                text += "<tr><td>" + fourpoint[i - 1] + " " + '<input type="number" value="' + test4[i - 1] + '" id="' + fourpoint[i - 1] + '" size="6"/></td></tr>';
            } else if (i == 7) {
                text += "<tr><th>Heights</th></tr>";
            } else {
                text += "<tr><td>" + fourpoint[i - 2] + " " + '<input type="number" value="' + test4[i - 2] + '" id="' + fourpoint[i - 2] + '" size="6"/></td></tr>';
            }
        }
    } else if (numpoints == 5) {
        for (i = 0; i < fivepoint.length + 2; i++) {
            if (i < 5) {
                text += "<tr><td>" + fivepoint[i] + " " + '<input type="number" value="' + test5[i] + '" id="' + fivepoint[i] + '" size="6"/></td></tr>';
            } else if (i == 5) {
                text += "<tr><th>Diagonals</th></tr>";
            } else if (i < 11) {
                text += "<tr><td>" + fivepoint[i - 1] + " " + '<input type="number" value="' + test5[i - 1] + '" id="' + fivepoint[i - 1] + '" size="6"/></td></tr>';
            } else if (i == 11) {
                text += "<tr><th>Heights</th></tr>";
            } else {
                text += "<tr><td>" + fivepoint[i - 2] + " " + '<input type="number" value="' + test5[i - 2] + '" id="' + fivepoint[i - 2] + '" size="6"/></td></tr>';
            }
        }
    } else {
        alert("Invalid number of points");
        return false;
    }
    text += "</table>";

    var showRecordId = document.getElementById("measurements");
    showRecordId.innerHTML = text;
    wire_auto_error_inputs(numpoints);
}
function numberofpoints() {
    return parseInt(document.getElementById("numpoints").value);
}
function wire_auto_error_inputs(numpoints) {
    const ids = numpoints === 4 ? fourpoint : numpoints === 5 ? fivepoint : [];
    for (let i = 0; i < ids.length; i++) {
        const input = document.getElementById(ids[i]);
        if (!input) {
            continue;
        }
        if (input.dataset.autoErrorWired === "1") {
            continue;
        }
        input.addEventListener("input", function () {
            if (autoErrorPrimed && autoErrorUpdateEnabled) {
                disp_error();
            }
        });
        input.dataset.autoErrorWired = "1";
    }
}
function set_auto_update_ui() {
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
function get_saved_collection() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return { sets: {} };
    }
    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        return { sets: {} };
    }
    // Backward compatibility with old single-save payload.
    if (parsed && !parsed.sets && (parsed.numpoints === 4 || parsed.numpoints === 5) && Array.isArray(parsed.values)) {
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
    if (!parsed || typeof parsed !== "object" || !parsed.sets || typeof parsed.sets !== "object") {
        return { sets: {} };
    }
    return parsed;
}
function set_saved_collection(collection) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}
function refresh_saved_sets_dropdown(selectedName) {
    const select = document.getElementById("savedSets");
    if (!select) {
        return;
    }
    const collection = get_saved_collection();
    const names = Object.keys(collection.sets).sort();
    let html = '<option value="">Select saved set</option>';
    for (let i = 0; i < names.length; i++) {
        const selectedAttr = selectedName === names[i] ? ' selected="selected"' : "";
        html += '<option value="' + names[i] + '"' + selectedAttr + ">" + names[i] + "</option>";
    }
    select.innerHTML = html;
}
function get_selected_save_name() {
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
function read_measurement_values(ids) {
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
function write_measurement_values(ids, values) {
    for (let i = 0; i < ids.length; i++) {
        const input = document.getElementById(ids[i]);
        if (!input) {
            continue;
        }
        input.value = values[i] ?? "";
    }
}
function save_measurements() {
    const numpoints = numberofpoints();
    if (numpoints !== 4 && numpoints !== 5) {
        alert("Generate a 4 or 5 point measurement form first");
        return;
    }
    const ids = numpoints === 4 ? fourpoint : fivepoint;
    const values = read_measurement_values(ids);
    if (!values) {
        alert("Measurement inputs were not found");
        return;
    }
    const saveName = get_selected_save_name();
    if (!saveName) {
        alert("Enter a save name or choose an existing saved set");
        return;
    }
    const collection = get_saved_collection();
    const payload = {
        numpoints: numpoints,
        values: values,
        savedAt: new Date().toISOString(),
    };
    collection.sets[saveName] = payload;
    set_saved_collection(collection);
    if (document.getElementById("saveName")) {
        document.getElementById("saveName").value = saveName;
    }
    refresh_saved_sets_dropdown(saveName);
    alert('Measurements saved as "' + saveName + '"');
}
function load_measurements() {
    const saveName = get_selected_save_name();
    if (!saveName) {
        alert("Enter or select a saved set name to load");
        return;
    }
    const collection = get_saved_collection();
    const payload = collection.sets[saveName];
    if (!payload) {
        alert('No saved set found named "' + saveName + '"');
        refresh_saved_sets_dropdown("");
        return;
    }
    const ids = payload.numpoints === 4 ? fourpoint : fivepoint;
    if (payload.values.length !== ids.length) {
        alert("Saved measurements do not match required fields");
        return;
    }
    document.getElementById("numpoints").value = payload.numpoints;
    measurements(payload.numpoints);
    write_measurement_values(ids, payload.values);
    if (document.getElementById("saveName")) {
        document.getElementById("saveName").value = saveName;
    }
    refresh_saved_sets_dropdown(saveName);
    alert('Loaded measurements from "' + saveName + '"');
}
window.addEventListener("DOMContentLoaded", function () {
    refresh_saved_sets_dropdown("");
    const savedSetsSelect = document.getElementById("savedSets");
    const saveNameInput = document.getElementById("saveName");
    const autoUpdateToggle = document.getElementById("autoUpdateToggle");
    const sizeInput = document.getElementById("size");
    set_auto_update_ui();
    if (savedSetsSelect && saveNameInput) {
        savedSetsSelect.addEventListener("change", function () {
            saveNameInput.value = savedSetsSelect.value;
        });
    }
    if (autoUpdateToggle) {
        autoUpdateToggle.addEventListener("change", function () {
            if (!autoErrorPrimed) {
                autoUpdateToggle.checked = false;
                return;
            }
            autoErrorUpdateEnabled = autoUpdateToggle.checked;
            set_auto_update_ui();
        });
    }
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
function array_meas() {
    numpoints = numberofpoints();
    const perim = [];
    const diag = [];
    const height = [];
    if (numpoints == 4) {
        for (i = 0; i < fourpoint.length; i++) {
            if (i < 4) {
                perim.push(parseFloat(document.getElementById(fourpoint[i]).value));
            } else if (i < 6) {
                diag.push(parseFloat(document.getElementById(fourpoint[i]).value));
            } else {
                height.push(parseFloat(document.getElementById(fourpoint[i]).value));
            }
        }
    } else if (numpoints == 5) {
        for (i = 0; i < fivepoint.length; i++) {
            if (i < 5) {
                perim.push(parseFloat(document.getElementById(fivepoint[i]).value));
            } else if (i < 10) {
                diag.push(parseFloat(document.getElementById(fivepoint[i]).value));
            } else {
                height.push(parseFloat(document.getElementById(fivepoint[i]).value));
            }
        }
    }
    return [perim, diag, height];
}
function build_distance_constraints(numpoints, perim, diag) {
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
function make_initial_xy(numpoints, abHorizontal, perim) {
    const vars = [];
    const avgRadius = perim.reduce(function (acc, v) {
        return acc + Math.abs(v);
    }, 0) / perim.length;
    for (let p = 2; p < numpoints; p++) {
        const angle = (2 * Math.PI * p) / numpoints;
        const xGuess = abHorizontal * 0.5 + avgRadius * Math.cos(angle);
        const yGuess = avgRadius * Math.sin(angle);
        vars.push(xGuess, yGuess);
    }
    return vars;
}
function get_xy_for_point(pointIdx, vars, abHorizontal) {
    if (pointIdx === 0) {
        return [0, 0];
    }
    if (pointIdx === 1) {
        return [abHorizontal, 0];
    }
    const offset = 2 * (pointIdx - 2);
    return [vars[offset], vars[offset + 1]];
}
function residual_cost(numpoints, vars, abHorizontal, heights, constraints) {
    let sumSquares = 0;
    for (let k = 0; k < constraints.length; k++) {
        const c = constraints[k];
        const p1 = get_xy_for_point(c.i, vars, abHorizontal);
        const p2 = get_xy_for_point(c.j, vars, abHorizontal);
        const dz = heights[c.i] - heights[c.j];
        const modeled = Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + dz ** 2);
        const residual = modeled - c.d;
        sumSquares += residual ** 2;
    }
    return sumSquares;
}
function optimize_distance_fit(numpoints, perim, diag, height, maxIterations) {
    const abSq = perim[0] ** 2 - (height[0] - height[1]) ** 2;
    if (abSq <= 0) {
        return null;
    }
    const abHorizontal = Math.sqrt(abSq);
    const constraints = build_distance_constraints(numpoints, perim, diag);
    let vars = make_initial_xy(numpoints, abHorizontal, perim);
    let lr = 0.05;
    let bestCost = residual_cost(numpoints, vars, abHorizontal, height, constraints);
    const eps = 0.001;
    const iterations = maxIterations || 1200;
    for (let iter = 0; iter < iterations; iter++) {
        const grad = new Array(vars.length).fill(0);
        for (let i = 0; i < vars.length; i++) {
            const oldVal = vars[i];
            vars[i] = oldVal + eps;
            const c1 = residual_cost(numpoints, vars, abHorizontal, height, constraints);
            vars[i] = oldVal - eps;
            const c2 = residual_cost(numpoints, vars, abHorizontal, height, constraints);
            vars[i] = oldVal;
            grad[i] = (c1 - c2) / (2 * eps);
        }
        const candidate = vars.slice();
        for (let i = 0; i < candidate.length; i++) {
            candidate[i] -= lr * grad[i];
        }
        const candidateCost = residual_cost(numpoints, candidate, abHorizontal, height, constraints);
        if (candidateCost < bestCost) {
            vars = candidate;
            bestCost = candidateCost;
            lr *= 1.05;
        } else {
            lr *= 0.5;
            if (lr < 0.000001) {
                break;
            }
        }
    }
    return { vars: vars, abHorizontal: abHorizontal, constraints: constraints, cost: bestCost };
}
function compute_residual_fit_from_measurements(numpoints, perim, diag, height, maxIterations) {
    if (
        perim.some(function (v) { return isNaN(v); }) ||
        diag.some(function (v) { return isNaN(v); }) ||
        height.some(function (v) { return isNaN(v); })
    ) {
        return null;
    }
    const fit = optimize_distance_fit(numpoints, perim, diag, height, maxIterations);
    if (!fit) {
        return null;
    }
    const residuals = [];
    for (let k = 0; k < fit.constraints.length; k++) {
        const c = fit.constraints[k];
        const p1 = get_xy_for_point(c.i, fit.vars, fit.abHorizontal);
        const p2 = get_xy_for_point(c.j, fit.vars, fit.abHorizontal);
        const dz = height[c.i] - height[c.j];
        const modeled = Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + dz ** 2);
        const residual = modeled - c.d;
        residuals.push({ label: c.label, residual: residual, absResidual: Math.abs(residual) });
    }
    const rms = Math.sqrt(
        residuals.reduce(function (acc, r) {
            return acc + r.residual ** 2;
        }, 0) / residuals.length
    );
    residuals.sort(function (a, b) {
        return b.absResidual - a.absResidual;
    });
    return { rms: rms, max: residuals[0], worstThree: residuals.slice(0, 3) };
}
function compute_residual_fit() {
    const numpoints = numberofpoints();
    if (numpoints !== 4 && numpoints !== 5) {
        return null;
    }
    const [perim, diag, height] = array_meas();
    return compute_residual_fit_from_measurements(numpoints, perim, diag, height, 1200);
}
function combined_recommendation_score(angleError, rmsMismatch) {
    const normalizedAngle = isNaN(angleError) ? null : angleError / ERROR_PASS_THRESHOLD;
    const normalizedRms = rmsMismatch / RMS_PASS_THRESHOLD;
    if (normalizedAngle === null) {
        return normalizedRms;
    }
    const totalWeight = RECOMMENDER_ERROR_WEIGHT + RECOMMENDER_RMS_WEIGHT;
    if (totalWeight <= 0) {
        return normalizedRms;
    }
    return (RECOMMENDER_ERROR_WEIGHT * normalizedAngle + RECOMMENDER_RMS_WEIGHT * normalizedRms) / totalWeight;
}
function render_residual_fit(angleError, nanReasons) {
    const target = document.getElementById("residualFit");
    if (!target) {
        return;
    }
    const result = compute_residual_fit();
    if (!result) {
        target.innerHTML = "";
        return;
    }
    let residualStatus = { label: "FAIL", color: "red" };
    if (result.rms <= RMS_PASS_THRESHOLD) {
        residualStatus = { label: "PASS", color: "green" };
    } else if (result.rms <= RMS_MARGINAL_THRESHOLD) {
        residualStatus = { label: "MARGINAL", color: "#b59a00" };
    }
    let html = '<table border="1" cellpadding="4" align="center"><tr><th>Residual Fit</th></tr>';
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
    const comparisonText = explain_error_vs_rms(angleError, result, nanReasons || []);
    if (comparisonText) {
        html += "<tr><td>" + comparisonText + "</td></tr>";
    }
    html += "</table>";
    target.innerHTML = html;
}
function get_status_from_error(error) {
    if (error <= 0.4) {
        return { label: "PASS", color: "green" };
    }
    if (error <= 0.7) {
        return { label: "MARGINAL", color: "#b59a00" };
    }
    return { label: "FAIL", color: "red" };
}
function clone_measurement_arrays(perim, diag, height) {
    return [perim.slice(), diag.slice(), height.slice()];
}
function measurement_metadata(numpoints) {
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
function apply_delta_to_arrays(perim, diag, height, measure, delta) {
    if (measure.group === "perim") {
        perim[measure.index] += delta;
    } else if (measure.group === "diag") {
        diag[measure.index] += delta;
    } else {
        height[measure.index] += delta;
    }
}
function recommend_adjustments() {
    const numpoints = numberofpoints();
    if (numpoints !== 4 && numpoints !== 5) {
        return [];
    }
    const [basePerim, baseDiag, baseHeight] = array_meas();
    const baseError = error_find(basePerim.slice(), baseDiag.slice(), baseHeight.slice());
    const baseResidualFit = compute_residual_fit_from_measurements(numpoints, basePerim, baseDiag, baseHeight, 300);
    if (!baseResidualFit) {
        return [];
    }
    const baseScore = combined_recommendation_score(baseError, baseResidualFit.rms);
    const angleErrorInvalid = isNaN(baseError);
    const measures = measurement_metadata(numpoints);
    const step = 5;
    const maxDelta = 80;
    const allCandidates = [];
    for (let m = 0; m < measures.length; m++) {
        const measure = measures[m];
        let bestForMeasure = null;
        for (let delta = -maxDelta; delta <= maxDelta; delta += step) {
            if (delta === 0) {
                continue;
            }
            const [perim, diag, height] = clone_measurement_arrays(basePerim, baseDiag, baseHeight);
            apply_delta_to_arrays(perim, diag, height, measure, delta);
            const newError = error_find(perim, diag, height);
            const newResidualFit = compute_residual_fit_from_measurements(numpoints, perim, diag, height, 180);
            if (!newResidualFit) {
                continue;
            }
            const newScore = combined_recommendation_score(newError, newResidualFit.rms);
            const improvement = baseScore - newScore;
            const isBetterCandidate =
                !bestForMeasure ||
                improvement > bestForMeasure.improvement ||
                (improvement === bestForMeasure.improvement && newScore < bestForMeasure.newScore);
            if (isBetterCandidate) {
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
    const improvedCandidates = allCandidates
        .filter(function (c) {
            return c.improvement > 0;
        })
        .sort(function (a, b) {
            return b.improvement - a.improvement;
        });
    if (improvedCandidates.length >= 3) {
        return improvedCandidates.slice(0, 3);
    }
    allCandidates.sort(function (a, b) {
        if (a.newScore === b.newScore) {
            return b.improvement - a.improvement;
        }
        return a.newScore - b.newScore;
    });
    // Always top-up with best-score candidates so Marginal/near-flat cases still show guidance.
    const merged = [];
    const seen = {};
    for (let i = 0; i < improvedCandidates.length; i++) {
        const key = improvedCandidates[i].label + ":" + improvedCandidates[i].delta;
        seen[key] = true;
        merged.push(improvedCandidates[i]);
        if (merged.length >= 3) {
            break;
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
    // Preserve previous NaN behavior as final fallback.
    if (angleErrorInvalid) {
        return allCandidates.slice(0, 3);
    }
    return [];
}
function render_recommendations(currentError) {
    const recommendationsDiv = document.getElementById("recommendations");
    if (!recommendationsDiv) {
        return;
    }
    const status = isNaN(currentError) ? { label: "N/A", color: "#666666" } : get_status_from_error(currentError);
    const recommendations = recommend_adjustments();
    currentRecommendations = recommendations;
    let text = '<table border="1" cellpadding="6" align="center">';
    text += '<tr><th colspan="6">Recommendations (Combined Score)</th></tr>';
    text +=
        '<tr><td colspan="6"><b style="color:' +
        status.color +
        ';">Status: ' +
        status.label +
        "</b> | Error: " +
        (isNaN(currentError) ? "N/A" : currentError.toFixed(3) + "%") +
        "</td></tr>";
    if (recommendations.length === 0) {
        text += '<tr><td colspan="6">No improvement suggestions available for combined-score search range.</td></tr>';
    } else {
        text += "<tr><th>Measurement</th><th>Adjust</th><th>Est. Error</th><th>Est. RMS</th><th>Combined Score</th><th>Action</th></tr>";
        for (let i = 0; i < recommendations.length; i++) {
            const r = recommendations[i];
            const deltaText = (r.delta > 0 ? "+" : "") + r.delta + " mm";
            text += "<tr>";
            text += "<td>" + r.label + "</td>";
            text += "<td>" + deltaText + "</td>";
            text += "<td>" + (isNaN(r.newError) ? "N/A" : r.newError.toFixed(3) + "%") + "</td>";
            text += "<td>" + r.newRms.toFixed(1) + " mm</td>";
            text += "<td>" + r.newScore.toFixed(3) + "</td>";
            text += '<td><input type="button" value="Apply" onclick="apply_recommendation(' + i + ');" /></td>';
            text += "</tr>";
        }
    }
    text += "</table>";
    recommendationsDiv.innerHTML = text;
}
function apply_recommendation(index) {
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
    input.value = currentValue + recommendation.delta;
    disp_error();
}
function normalised(perim, diag, height) {
    const perim_norm = [];
    const diag_norm = [];
    height.push(height[0]);
    if (perim.length == 4) {
        for (i = 0; i < perim.length; i++) {
            perim_norm.push(Math.sqrt(perim[i] ** 2 - (height[i] - height[i + 1]) ** 2));
            if (i < diag.length) {
                diag_norm.push(Math.sqrt(diag[i] ** 2 - (height[i] - height[i + 2]) ** 2));
            }
        }
    } else if (perim.length == 5) {
        for (i = 0; i < perim.length; i++) {
            perim_norm.push(Math.sqrt(perim[i] ** 2 - (height[i] - height[i + 1]) ** 2));
            if (i < 2) {
                diag_norm.push(Math.sqrt(diag[i] ** 2 - (height[0] - height[i + 2]) ** 2));
            } else if (i < 4) {
                diag_norm.push(Math.sqrt(diag[i] ** 2 - (height[1] - height[i + 1]) ** 2));
            } else {
                diag_norm.push(Math.sqrt(diag[i] ** 2 - (height[2] - height[i]) ** 2));
            }
        }
    } else {
        alert("error with normalising");
    }
    height.pop();
    return [perim_norm, diag_norm];
}
function diag_height_pair_info(numpoints, diagIndex) {
    if (numpoints === 4) {
        if (diagIndex === 0) {
            return { h1: "Ah", h2: "Ch" };
        }
        return { h1: "Bh", h2: "Dh" };
    }
    if (diagIndex === 0) {
        return { h1: "Ah", h2: "Ch" };
    }
    if (diagIndex === 1) {
        return { h1: "Ah", h2: "Dh" };
    }
    if (diagIndex === 2) {
        return { h1: "Bh", h2: "Dh" };
    }
    if (diagIndex === 3) {
        return { h1: "Bh", h2: "Eh" };
    }
    return { h1: "Ch", h2: "Eh" };
}
function diagnose_angle_error_nan(perim, diag, height, numpoints) {
    const reasons = [];
    const labels = numpoints === 4 ? fourpoint : fivepoint;
    for (let i = 0; i < perim.length; i++) {
        if (!isFinite(perim[i])) {
            reasons.push("Invalid side value at " + labels[i] + ".");
        }
    }
    for (let i = 0; i < diag.length; i++) {
        const labelIndex = numpoints === 4 ? 4 + i : 5 + i;
        if (!isFinite(diag[i])) {
            reasons.push("Invalid diagonal value at " + labels[labelIndex] + ".");
        }
    }
    for (let i = 0; i < height.length; i++) {
        const labelIndex = numpoints === 4 ? 6 + i : 10 + i;
        if (!isFinite(height[i])) {
            reasons.push("Invalid height value at " + labels[labelIndex] + ".");
        }
    }
    const hCycle = height.slice();
    hCycle.push(height[0]);
    for (let i = 0; i < perim.length; i++) {
        const rad = perim[i] ** 2 - (hCycle[i] - hCycle[i + 1]) ** 2;
        if (rad < 0) {
            reasons.push(
                "Side " +
                    labels[i] +
                    " is shorter than height difference between adjacent corners, so horizontal length becomes imaginary."
            );
        }
    }
    for (let i = 0; i < diag.length; i++) {
        let hA = 0;
        let hB = 0;
        if (numpoints === 4) {
            if (i === 0) {
                hA = height[0];
                hB = height[2];
            } else {
                hA = height[1];
                hB = height[3];
            }
        } else if (i < 2) {
            hA = height[0];
            hB = height[i + 2];
        } else if (i < 4) {
            hA = height[1];
            hB = height[i + 1];
        } else {
            hA = height[2];
            hB = height[i];
        }
        const rad = diag[i] ** 2 - (hA - hB) ** 2;
        if (rad < 0) {
            const info = diag_height_pair_info(numpoints, i);
            const labelIndex = numpoints === 4 ? 4 + i : 5 + i;
            reasons.push(
                "Diagonal " +
                    labels[labelIndex] +
                    " is shorter than vertical difference (" +
                    info.h1 +
                    " vs " +
                    info.h2 +
                    "), so horizontal diagonal is invalid."
            );
        }
    }
    const [perimNorm, diagNorm] = normalised(perim.slice(), diag.slice(), height.slice());
    const invalidAngles = [];
    if (numpoints === 4 && perimNorm.length === 4 && diagNorm.length === 2) {
        let j = 1;
        for (let i = 0; i < 4; i++) {
            const a = i === 0 ? perimNorm[3] : perimNorm[i - 1];
            const b = perimNorm[i];
            const c = diagNorm[j];
            const denom = 2 * a * b;
            const ratio = denom === 0 ? NaN : (a ** 2 + b ** 2 - c ** 2) / denom;
            if (!isFinite(ratio) || ratio < -1 || ratio > 1) {
                invalidAngles.push(labels[i] + " corner (cos ratio out of range)");
            }
            j = j === 0 ? 1 : 0;
        }
    } else if (numpoints === 5 && perimNorm.length === 5 && diagNorm.length === 5) {
        const order = [3, 0, 2, 4, 1];
        for (let i = 0; i < 5; i++) {
            const a = i === 0 ? perimNorm[4] : perimNorm[i - 1];
            const b = perimNorm[i];
            const c = diagNorm[order[i]];
            const denom = 2 * a * b;
            const ratio = denom === 0 ? NaN : (a ** 2 + b ** 2 - c ** 2) / denom;
            if (!isFinite(ratio) || ratio < -1 || ratio > 1) {
                invalidAngles.push(labels[i] + " corner (likely reflex/internal or inconsistent lengths)");
            }
        }
    }
    if (invalidAngles.length > 0) {
        reasons.push("Cosine-rule angle calculation failed at: " + invalidAngles.join(", ") + ".");
    }
    if (reasons.length === 0) {
        reasons.push("Inputs are likely non-convex (internal/reflex corner) so angle-sum % error is not valid.");
    }
    return reasons.slice(0, 4);
}
function explain_nan_vs_rms(reasons, residualFitResult) {
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
function explain_error_vs_rms(angleError, residualFitResult, reasons) {
    if (!residualFitResult) {
        return "";
    }
    if (isNaN(angleError)) {
        return explain_nan_vs_rms(reasons || [], residualFitResult);
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
function errorcheck() {
    var [perim, diag, height] = array_meas();
    var error = error_find(perim, diag, height);
    return error.toFixed(3);
}
function find_angle(a, b, c) {
    try {
        var x = Math.acos((a ** 2 + b ** 2 - c ** 2) / (2 * b * a));
        var z = (x * 180) / Math.PI;
    } catch {
        alert("cosine rule didn't work");
    }
    return z;
}
function error_find(perim, diag, height) {
    var j = 1;
    var sum = [];
    var numpoints = numberofpoints();
    [perim, diag] = normalised(perim, diag, height);
    if (numpoints == 4) {
        var i = 0;
        for (i = 0; i < numpoints; i++) {
            if (i == 0) {
                sum.push(find_angle(perim[3], perim[i], diag[j]));
            } else {
                sum.push(find_angle(perim[i - 1], perim[i], diag[j]));
            }
            if (j == 0) {
                j = 1;
            } else {
                j = 0;
            }
        }
    } else if (numpoints == 5) {
        var i = 0;
        var order = [3, 0, 2, 4, 1];
        for (i = 0; i < numpoints; i++) {
            if (i == 0) {
                sum.push(find_angle(perim[4], perim[i], diag[order[i]]));
            } else {
                sum.push(find_angle(perim[i - 1], perim[i], diag[order[i]]));
            }
        }
    }
    reducer = (accumulator, curr) => accumulator + curr;
    var total_sum = sum.reduce(reducer);
    error = (Math.abs(total_sum - (numpoints - 2) * 180) / ((numpoints - 2) * 180)) * 100;
    return error;
}
function error_cycle(size) {
    var numpoints = numberofpoints();
    var error = 0;
    var error_perim = "";
    var error_diag = "";
    var error_height = "";
    var error_text = "";
    var error_head = "";
    var [perim, diag, height] = array_meas();
    var temp = 0;

    var i = 0;
    for (i = 0; i < perim.length; i++) {
        temp = perim[i];
        if (numpoints == 4) {
            error_perim += "<tr><td>" + fourpoint[i] + "</td>";
        } else if (numpoints == 5) {
            error_perim += "<tr><td>" + fivepoint[i] + "</td>";
        }
        for (j = -5; j < 6; j++) {
            if (i == 0) {
                error_head += "<th>" + (j * size).toFixed(2) + "</th>";
            }
            perim[i] += j * size;
            error = error_find(perim, diag, height);
            if (error < 0.3) {
                error_perim += '<td bgcolor="#006600"><table border="0" cellpadding="4" cellspacing="0" align="center"><tr><td bgcolor="#ffffff">' + error.toFixed(3) + "</td></tr></table></td>";
            } else if (error < 0.6) {
                error_perim += '<td bgcolor="#f0eb0c"><table border="0" cellpadding="4" cellspacing="0" align="center"><tr><td bgcolor="#ffffff">' + error.toFixed(3) + "</td></tr></table></td>";
            } else {
                error_perim += "<td>" + error.toFixed(3) + "</td>";
            }
            perim[i] = temp;
        }
        error_perim += "</tr>";
    }
    var i = 0;
    for (i = 0; i < diag.length; i++) {
        temp = diag[i];
        if (numpoints == 4) {
            error_diag += "<tr><td>" + fourpoint[i + numpoints] + "</td>";
        } else if (numpoints == 5) {
            error_diag += "<tr><td>" + fivepoint[i + numpoints] + "</td>";
        }
        for (j = -5; j < 6; j++) {
            diag[i] += j * size;
            error = error_find(perim, diag, height);
            if (error < 0.3) {
                error_diag += '<td bgcolor="#006600"><table border="0" cellpadding="4" cellspacing="0" align="center"><tr><td bgcolor="#ffffff">' + error.toFixed(3) + "</td></tr></table></td>";
            } else if (error < 0.6) {
                error_diag += '<td bgcolor="#f0eb0c"><table border="0" cellpadding="4" cellspacing="0" align="center"><tr><td bgcolor="#ffffff">' + error.toFixed(3) + "</td></tr></table></td>";
            } else {
                error_diag += "<td>" + error.toFixed(3) + "</td>";
            }
            diag[i] = temp;
        }

        error_diag += "</tr>";
    }
    var i = 0;
    for (i = 0; i < height.length; i++) {
        temp = height[i];
        if (numpoints == 4) {
            error_height += "<tr><td>" + fourpoint[i + numpoints + 2] + "</td>";
        } else if (numpoints == 5) {
            error_height += "<tr><td>" + fivepoint[i + numpoints + 5] + "</td>";
        }
        for (j = -5; j < 6; j++) {
            height[i] += j * size;
            error = error_find(perim, diag, height);
            if (error < 0.3) {
                error_height += '<td bgcolor="#006600"><table border="0" cellpadding="4" cellspacing="0" align="center"><tr><td bgcolor="#ffffff">' + error.toFixed(3) + "</td></tr></table></td>";
            } else if (error < 0.6) {
                error_height += '<td bgcolor="#f0eb0c"><table border="0" cellpadding="4" cellspacing="0" align="center"><tr><td bgcolor="#ffffff">' + error.toFixed(3) + "</td></tr></table></td>";
            } else {
                error_height += "<td>" + error.toFixed(3) + "</td>";
            }
            height[i] = temp;
        }
        error_height += "</tr>";
    }
    error_text = error_perim + error_diag + error_height;
    return error_head + error_text;
}
function error_sweep(size) {
    text = '<table border="5" cellpadding="3" align="center"><tr><th>Measurment</th>';
    text += error_cycle(size);
    text += "</table>";
    var showRecordId = document.getElementById("errorcheck");
    showRecordId.innerHTML = text;
}
function disp_error() {
    if (!autoErrorPrimed) {
        autoErrorPrimed = true;
        autoErrorUpdateEnabled = true;
        set_auto_update_ui();
    }
    var error = errorcheck();
    var errorNum = parseFloat(error);
    var text = "";
    if (isNaN(errorNum)) {
        text += '<table border="5" bordercolor="#666666" cellpadding="3" align="center"><tr><th>Error</th></tr>';
    } else if (errorNum > 0.4) {
        text += '<table border="5" bordercolor="red"cellpadding="3" align="center"><tr><th>Error</th></tr>';
    } else {
        text += '<table border="5" bordercolor="green"cellpadding="3" align="center"><tr><th>Error</th></tr>';
    }
    text += "<tr><td>" + error + "</td></tr>";
    let nanReasons = [];
    if (isNaN(errorNum)) {
        const [perim, diag, height] = array_meas();
        const reasons = diagnose_angle_error_nan(perim, diag, height, numberofpoints());
        nanReasons = reasons;
        const residualResult = compute_residual_fit_from_measurements(numberofpoints(), perim, diag, height, 300);
        const contrastExplanation = explain_nan_vs_rms(reasons, residualResult);
        text += "<tr><td><b>Why NaN:</b><br/>- " + reasons.join("<br/>- ") + "</td></tr>";
        if (contrastExplanation) {
            text += "<tr><td><b>Why RMS can still pass:</b><br/>" + contrastExplanation + "</td></tr>";
        }
    }
    text += "</table>";
    var showRecordId = document.getElementById("Error");
    showRecordId.innerHTML = text;
    render_recommendations(errorNum);
    render_residual_fit(errorNum, nanReasons);
}
function find_coord() {
    var [perim, diag, height] = array_meas();
    var [perim_norm, diag_norm] = normalised(perim, diag, height);
    var numpoints = numberofpoints();
    var [a, b, c, d, e] = [0, 0, 0];
    var angle = 0;
    a = [0, 0, height[0]];
    b = [0, perim_norm[0], height[1]];
    if (numpoints == 4) {
        angle = find_angle(diag_norm[0], perim_norm[0], perim_norm[1]);
        if (angle < 90) {
            angle = 90 - angle;
        } else {
            angle = angle * -1 + 90;
        }
        c = [diag_norm[0] * Math.cos((angle * Math.PI) / 180), diag_norm[0] * Math.sin((angle * Math.PI) / 180), height[2]];
        angle = find_angle(perim_norm[3], perim_norm[0], diag_norm[1]);
        if (angle < 90) {
            angle = 90 - angle;
        } else {
            angle = angle * -1 + 90;
        }
        d = [perim_norm[3] * Math.cos((angle * Math.PI) / 180), perim_norm[3] * Math.sin((angle * Math.PI) / 180), height[3]];

        return [a, b, c, d];
    } else if (numpoints == 5) {
        angle = find_angle(diag_norm[0], perim_norm[0], perim_norm[1]);
        if (angle < 90) {
            angle = 90 - angle;
        } else {
            angle = angle * -1 + 90;
        }
        c = [diag_norm[0] * Math.cos((angle * Math.PI) / 180), diag_norm[0] * Math.sin((angle * Math.PI) / 180), height[2]];
        angle = find_angle(diag_norm[1], perim_norm[0], diag_norm[2]);
        if (angle < 90) {
            angle = 90 - angle;
        } else {
            angle = angle * -1 + 90;
        }
        d = [diag_norm[1] * Math.cos((angle * Math.PI) / 180), diag_norm[1] * Math.sin((angle * Math.PI) / 180), height[3]];
        angle = find_angle(perim_norm[4], perim_norm[0], diag_norm[3]);
        if (angle < 90) {
            angle = 90 - angle;
        } else {
            angle = angle * -1 + 90;
        }
        e = [perim_norm[4] * Math.cos((angle * Math.PI) / 180), perim_norm[4] * Math.sin((angle * Math.PI) / 180), height[4]];
        return [a, b, c, d, e];
    }
}
function draw() {
    var numpoints = numberofpoints();
    if (numpoints != 4 && numpoints != 5) {
        alert("nothing to draw, idiot");
        return;
    }
    var error = errorcheck();
    if (isNaN(error)) {
        alert("can't draw if measurements don't make sense");
        return;
    }
    if (numpoints == 4) {
        const [a, b, c, d] = find_coord();
        var data = [
            {
                x: [a[0], b[0], c[0], d[0]],
                y: [a[1], b[1], c[1], d[1]],
                z: [a[2], b[2], c[2], d[2]],
                mode: "markers+text",
                type: "scatter3d",
                text: ["A", "B", "C", "D"],
                marker: {
                    color: "rgb(255, 0, 0)",
                    size: 3,
                },
                hoverinfo: "none",
            },
            {
                alphahull: -1,
                opacity: 0.4,
                color: "rgb(255,128,0)",
                type: "mesh3d",
                x: [a[0], b[0], c[0], d[0]],
                y: [a[1], b[1], c[1], d[1]],
                z: [a[2], b[2], c[2], d[2]],
                hoverinfo: "none",
            },
        ];
    } else if (numpoints == 5) {
        const [a, b, c, d, e] = find_coord();
        var data = [
            {
                x: [a[0], b[0], c[0], d[0], e[0]],
                y: [a[1], b[1], c[1], d[1], e[1]],
                z: [a[2], b[2], c[2], d[2], e[2]],
                mode: "markers+text",
                type: "scatter3d",
                text: ["A", "B", "C", "D", "E"],
                marker: {
                    color: "rgb(255, 0, 0)",
                    size: 3,
                },
                hoverinfo: "none",
            },
            {
                alphahull: -1,
                opacity: 0.4,
                color: "rgb(255,128,0)",
                type: "mesh3d",
                x: [a[0], b[0], c[0], d[0], e[0]],
                y: [a[1], b[1], c[1], d[1], e[1]],
                z: [a[2], b[2], c[2], d[2], e[2]],
                hoverinfo: "none",
            },
        ];
    }

    var layout = {
        autosize: true,
        height: 640,
        scene: {
            aspectratio: {
                x: 1,
                y: 1,
                z: 1,
            },
            aspectmode: "data",
            camera: {
                center: { x: 0, y: 0, z: 0 },
                eye: { x: 2, y: 2, z: 2 },
                up: { x: 0, y: 0, z: 1 },
            },
            xaxis: {
                type: "linear",
                zeroline: false,
            },
            yaxis: {
                type: "linear",
                zeroline: false,
            },
            zaxis: {
                type: "linear",
                zeroline: false,
            },
        },
        title: "rough shade sail model",
        width: 1000,
    };

    Plotly.newPlot("drawing", data, layout);
}
