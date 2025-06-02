#!/usr/bin/env bash
# =====================================================================
# Dacroq LDPC API smoke-test / coverage script
# ---------------------------------------------------------------------
# • Hits every /ldpc/* endpoint at least once
# • Works against https://api.dacroq.net or any other base URL
# • Times out or skips hardware routes when the Teensy isn’t present
# =====================================================================

set -euo pipefail

# ---------- CLI -------------------------------------------------------
BASE="${1:-${BASE_URL:-http://127.0.0.1:8000}}"
NO_HW=false
if [[ "${2:-}" == "--no-hw" ]]; then NO_HW=true; fi

command -v jq >/dev/null || { echo "❌  jq required"; exit 1; }

echo "🔗  Target API: $BASE"
$NO_HW && echo "🙈  Hardware routes will be skipped (--no-hw)"

# ---------- helpers ---------------------------------------------------
# hw_curl runs curl with a 10-second timeout and never aborts the script
hw_curl() {
  if $NO_HW; then
    echo "🚫  Skipping hardware call $1"
    return
  fi
  if curl --max-time 10 -sS "$@"; then
    echo
  else
    echo "⚠️  Hardware call failed or timed out"
  fi
}

json() { jq -r "$1" 2>/dev/null || true; }   # silent jq helper

# ---------- 1) /ldpc/generate -----------------------------------------
curl -sSf -X POST "$BASE/ldpc/generate" -H 'Content-Type: application/json' -d @- <<'EOF'
{ "num_vectors": 100, "snr_points": ["3dB","6dB"], "types": ["SOFT_INFO","HARD_INFO"] }
EOF
echo "✅  /ldpc/generate"

# ---------- 2) /ldpc/deploy -------------------------------------------
hw_curl -X POST "$BASE/ldpc/deploy" -H 'Content-Type: application/json' -d @- <<'EOF'
{ "snr_runs": { "6dB": 5, "3dB": 5 }, "info_type": "SOFT_INFO", "mode": "run" }
EOF
echo "✅  /ldpc/deploy (attempt)"

# ---------- 3) /ldpc/command ------------------------------------------
hw_curl -X POST "$BASE/ldpc/command" -H 'Content-Type: application/json' \
        -d '{"command":"status"}'
echo "✅  /ldpc/command (attempt)"

# ---------- 4) POST /ldpc/jobs (hardware test) ------------------------
JOB_JSON=$(hw_curl -X POST "$BASE/ldpc/jobs" -H 'Content-Type: application/json' -d @- <<'EOF'
{ "name":"LDPC Smoke-Test", "algorithm_type":"analog_hardware",
  "test_mode":"ber_test", "snr_db":6.0, "num_vectors":10 }
EOF
) || true
JOB_ID=$(echo "$JOB_JSON" | json '.job_id // empty')
[[ -n "$JOB_JSON" ]] && echo "$JOB_JSON" | jq .

# ---------- 5) GET /ldpc/jobs -----------------------------------------
curl -sSf "$BASE/ldpc/jobs" | jq .
echo "✅  GET /ldpc/jobs"

# ---------- 6) GET /ldpc/jobs/<id> ------------------------------------
if [[ -n "$JOB_ID" ]]; then
  curl -sSf "$BASE/ldpc/jobs/$JOB_ID" | jq .
  echo "✅  GET /ldpc/jobs/$JOB_ID"
fi

# ---------- 7) DELETE /ldpc/jobs/<id> ---------------------------------
if [[ -n "$JOB_ID" ]]; then
  curl -sSf -X DELETE "$BASE/ldpc/jobs/$JOB_ID" | jq .
  echo "✅  DELETE /ldpc/jobs/$JOB_ID"
fi

# ---------- 8) POST /ldpc/process -------------------------------------
hw_curl -X POST "$BASE/ldpc/process" -H 'Content-Type: application/json' -d @- <<'EOF'
{ "num_vectors":10, "snr_points":["7dB","4dB"], "type":"SOFT_INFO" }
EOF
echo "✅  /ldpc/process (attempt)"

# ---------- 9) Negative-path test -------------------------------------
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/ldpc/deploy" \
             -H 'Content-Type: application/json' -d '{"snr_runs":{}}')
[[ "$HTTP_CODE" == "400" ]] && echo "✅  /ldpc/deploy 400-error branch" \
                            || echo "⚠️  Expected 400, got $HTTP_CODE"

echo -e "\n🎉  LDPC API coverage run complete"
