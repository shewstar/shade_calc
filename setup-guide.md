# Cloudflare + GCS Setup Guide for www.sailtracker.org

This guide walks you through putting **Cloudflare** in front of your Google Cloud Storage bucket so
the site is served over **HTTPS** with a free SSL certificate.

---

## Prerequisites

- [ ] You own the domain `sailtracker.org`
- [ ] You have access to the domain registrar's DNS settings
- [ ] The `gcloud-setup.sh` script has been run (or equivalent GCS config is in place)

---

## Step 1 — Sign up for Cloudflare

1. Go to [cloudflare.com](https://cloudflare.com) and create a **free** account.
2. Click **Add a Site** and enter `sailtracker.org`.
3. Select the **Free** plan.
4. Cloudflare will scan existing DNS records (there will be few or none).

---

## Step 2 — Add a DNS record

In the Cloudflare DNS dashboard, add this record:

| Type  | Name  | Target                     | Proxy      |
| ----- | ----- | -------------------------- | ---------- |
| CNAME | `www` | `c.storage.googleapis.com` | 🟠 Proxied |

- **Proxy status** must be **Proxied** (orange cloud) — this is what enables HTTPS.
- Do **NOT** use `storage.googleapis.com` directly; use `c.storage.googleapis.com`.

> **Why `c.storage.googleapis.com`?**  
> GCS requires the bucket name to match the domain being served. Since the bucket is
> `www.sailtracker.org`, the DNS CNAME targets `c.storage.googleapis.com` and GCS resolves
> the appropriate bucket from the `Host` header.

---

## Step 3 — Update nameservers at your registrar

Cloudflare will give you two nameservers (e.g., `dana.ns.cloudflare.com` and `amos.ns.cloudflare.com`).

1. Log into your domain registrar (e.g., Namecheap, GoDaddy, Google Domains).
2. Find the nameserver settings for `sailtracker.org`.
3. Replace the existing nameservers with the Cloudflare-provided ones.
4. Save.

DNS propagation can take anywhere from a few minutes to 48 hours (usually < 1 hour).

---

## Step 4 — Configure SSL/TLS

In the Cloudflare dashboard, go to **SSL/TLS → Overview**:

- Set to **Full** (not Flexible, not Off).

This ensures Cloudflare encrypts traffic all the way from its edge to Google Cloud Storage.

Optionally enable:

- **Always Use HTTPS** (under **Edge Certificates** tab) — redirects HTTP to HTTPS automatically.

---

## Step 5 — Root domain redirect (optional)

By default, `sailtracker.org` (no `www`) won't resolve to GCS. Add a **Page Rule** to redirect:

| Setting | Value                                         |
| ------- | --------------------------------------------- |
| URL     | `sailtracker.org/*`                           |
| Setting | **Forwarding URL** (301 — Permanent Redirect) |
| URL     | `https://www.sailtracker.org/$1`              |

Free Cloudflare accounts get 3 Page Rules.

---

## Step 6 — Test

After DNS propagation:

1. Visit `https://www.sailtracker.org` — you should see the Shade Calculator.
2. Visit `http://www.sailtracker.org` — you should be redirected to HTTPS.
3. Visit `sailtracker.org` (if you set up the Page Rule) — you should redirect to `www`.

---

## Troubleshooting

| Problem                    | Likely Fix                                                                 |
| -------------------------- | -------------------------------------------------------------------------- |
| **"404 Not Found"**        | GCS website config may not be set. Run `gcloud-setup.sh`.                  |
| **"400 Bad Request"**      | DNS record may point to wrong target, or bucket name doesn't match domain. |
| **"Too many redirects"**   | SSL/TLS mode is "Flexible" — change to **Full**.                           |
| **Certificate takes time** | Cloudflare provisions a cert after DNS propagates. Wait 5–15 min.          |
| **Bucket not accessible**  | Run `gsutil iam ch allUsers:objectViewer gs://www.sailtracker.org`         |

---

## If you ever want to switch away from Cloudflare

1. Set SSL/TLS to **Off** in Cloudflare (or pause Cloudflare).
2. Point DNS directly to `c.storage.googleapis.com` (unproxied).
3. Site will still work on HTTP (but not HTTPS).

---

## Resources

- [Cloudflare docs: Set up SSL](https://developers.cloudflare.com/ssl/get-started/)
- [Cloudflare Page Rules](https://support.cloudflare.com/hc/en-us/articles/218411427)
- [GCS static website docs](https://cloud.google.com/storage/docs/hosting-static-website)
