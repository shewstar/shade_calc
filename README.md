@@ -0,0 +1,57 @@

# ASS Shade Calculator

A single-page web application for calculating angle-closure error and residual-distance fit
for shade sail layouts (4-point and 5-point configurations).

## Features

- **Measurement input** for perimeters, diagonals, and corner heights
- **Angle-closure percent error** calculation using cosine-rule corner angles
- **Residual distance fit** using gradient-descent optimization to find best-fit corner positions
- **Recommendations engine** that suggests measurement adjustments to improve the combined error/RMS score
- **Error sweep table** showing how adjusting each measurement changes the angle error
- **3D visualization** of the shade sail using Plotly
- **Save/Load** measurement sets via localStorage
- **Change history** tracking with undo support for recommendations

## Files

| File               | Description                                 |
| ------------------ | ------------------------------------------- |
| `index.html`       | Main HTML page (served by GCS as homepage)  |
| `404.html`         | Custom 404 error page                       |
| `shadecode.js`     | All application logic                       |
| `logo-150x150.png` | Application logo                            |
| `README.md`        | This file                                   |
| `gcloud-setup.sh`  | GCS bucket config script for static hosting |
| `setup-guide.md`   | Cloudflare + HTTPS setup guide              |

## Usage

1. Visit [https://www.sailtracker.org/](https://www.sailtracker.org/) or open `index.html` locally in a web browser (requires internet for CDN-hosted libraries).
2. Select **4 pointer** or **5 pointer** to generate the measurement input form.
3. Enter your measured distances:
   - **Perimeters**: lengths of the sail edges between adjacent corners
   - **Diagonals**: lengths between non-adjacent corners
   - **Heights**: height of each corner from a common reference plane
4. Click **Calculate Error** to see:
   - Angle-closure percent error (pass ≤ 0.4%, marginal ≤ 0.7%)
   - Residual fit RMS (pass ≤ 15mm, marginal ≤ 25mm)
   - Recommended adjustments (if any)
5. Optionally click **DRAW** for a 3D visualization of the sail.
6. Use the **Error Sweep Table** with a step size to see how adjustments affect the error.

## How the Error Checks Work

### Percent Error (Angle Closure)

All interior angles of a convex polygon sum to `(n-2) × 180°`. For a 4-point sail, the sum should be 360°;
for a 5-point sail, 540°. The app computes each corner angle using the cosine rule on normalised
(horizontal) lengths and reports the percent deviation from this expected sum.

### Residual Fit (Distance Consistency)

The app uses gradient descent to find the best-fit (x, y, z) positions for all corners that
minimise the difference between measured and modeled distances. The RMS of all residuals is
reported — lower means more self-consistent measurements.

## Technical Notes

- Heights are normalised out of perimeter/diagonal measurements using Pythagoras' theorem.
- The gradient descent optimizer uses adaptive learning rate (increases on success, decreases on failure).
- NaN angle errors are diagnosed with specific messages indicating which measurement causes the issue.

## HTTPS / Hosting

The site is hosted on **Google Cloud Storage** with **Cloudflare** in front for HTTPS.
See [`setup-guide.md`](setup-guide.md) for details on the Cloudflare setup.
