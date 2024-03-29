const fourpoint = ["A-B", "B-C", "C-D", "D-A", "A-C", "B-D", "Ah", "Bh", "Ch", "Dh"];
const fivepoint = ["A-B", "B-C", "C-D", "D-E", "E-A", "A-C", "A-D", "B-D", "B-E", "C-E", "Ah", "Bh", "Ch", "Dh", "Eh"];
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
}
function numberofpoints() {
    return parseInt(document.getElementById("numpoints").value);
}
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
    var error = errorcheck();
    var text = "";
    if (error > 0.4) {
        text += '<table border="5" bordercolor="red"cellpadding="3" align="center"><tr><th>Error</th></tr>';
    } else {
        text += '<table border="5" bordercolor="green"cellpadding="3" align="center"><tr><th>Error</th></tr>';
    }
    text += "<tr><td>" + error + "</td></tr>";
    text += "</table>";
    var showRecordId = document.getElementById("Error");
    showRecordId.innerHTML = text;
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
