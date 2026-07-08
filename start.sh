#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# RegulaOne — Platform Launcher
# Opens every backend and frontend in its own Terminal tab.
#
# Port map:
#   RegulaOne   backend :8080   frontend :3000
#   KSeFFlow    backend :8081   frontend :3001
#   SafeVoice   backend :8087   frontend :3007
#   WasteSync   backend :8083   frontend :3003
#   SafeWork    backend :8082   frontend :3002
#   WorkPulse   backend :8085   frontend :3005
#   PrivacyPilot backend :8086  frontend :3006
# ─────────────────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── helpers ──────────────────────────────────────────────────────────────────

# Open a new Terminal window and run a command in it.
#
# We used to press Cmd+T via "System Events" to make a new TAB, but that
# needs special "Accessibility" permission. Without it macOS blocks the
# keystroke and NOTHING opens. So instead we use Terminal's own
# "do script" command, which opens a brand new window on its own and
# does NOT need any extra permission. This is much more reliable.
#
# Note: we no longer hide errors. If something goes wrong you will see it.
open_tab() {
  local label="$1"
  local cmd="$2"
  # We set the window/tab title using a printf escape code, then run the command.
  osascript \
    -e 'tell application "Terminal"' \
    -e '  activate' \
    -e "  do script \"printf '\\\\033]0;${label}\\\\007' ; ${cmd}\"" \
    -e 'end tell' \
    > /dev/null
}

# Start a backend if the directory exists.
# Some backends are Java/Spring Boot (have a pom.xml) and some are
# Node.js (have a package.json). We look at the files inside the folder
# and pick the right way to start each one.
start_backend() {
  local module="$1"   # e.g. RegulaOne
  local port="$2"
  local dir="${ROOT}/${module}/backend"

  if [ ! -d "$dir" ]; then
    echo "  [skip] ${module} backend — directory not found"
    return
  fi

  local run_cmd
  if [ -f "${dir}/pom.xml" ]; then
    # This is a Java / Spring Boot project. Use the Maven wrapper if it
    # exists, otherwise fall back to a globally installed "mvn".
    local mvn_cmd
    if [ -f "${dir}/mvnw" ]; then
      mvn_cmd="./mvnw"
    else
      mvn_cmd="mvn"
    fi
    run_cmd="${mvn_cmd} spring-boot:run -Dspring-boot.run.arguments=--server.port=${port}"
  elif [ -f "${dir}/package.json" ]; then
    # This is a Node.js project. We pass the port through the PORT env var
    # (the app should read process.env.PORT). We prefer "npm run dev" if a
    # dev script exists, otherwise fall back to "npm start".
    if grep -q '"dev"' "${dir}/package.json"; then
      run_cmd="PORT=${port} npm run dev"
    else
      run_cmd="PORT=${port} npm start"
    fi
  else
    echo "  [skip] ${module} backend — no pom.xml or package.json"
    return
  fi

  local cmd="cd '${dir}' && echo '▶ Starting ${module} backend on :${port}' && ${run_cmd} ; exec \$SHELL"
  open_tab "${module} Backend :${port}" "$cmd"
  echo "  [✓] ${module} backend  → http://localhost:${port}"
}

# Start an npm-based frontend if the directory exists
start_frontend() {
  local module="$1"
  local port="$2"
  local dir="${ROOT}/${module}/frontend"

  if [ ! -d "$dir" ]; then
    echo "  [skip] ${module} frontend — directory not found"
    return
  fi

  if [ ! -f "${dir}/package.json" ]; then
    echo "  [skip] ${module} frontend — no package.json"
    return
  fi

  # Pass PORT env var; Vite reads it, Express/tsx server reads it too
  local cmd="cd '${dir}' && echo '▶ Starting ${module} frontend on :${port}' && PORT=${port} npm run dev ; exec \$SHELL"
  open_tab "${module} Frontend :${port}" "$cmd"
  echo "  [✓] ${module} frontend → http://localhost:${port}"
}

# ── main ─────────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        RegulaOne Platform Launcher           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── RegulaOne (Auth gateway + shared platform) ──────────────────────────────
echo "► RegulaOne"
start_backend  "RegulaOne" 8080
start_frontend "RegulaOne" 3000
sleep 0.4

# ── KSeFFlow (E-invoicing) ───────────────────────────────────────────────────
echo "► KSeFFlow"
start_backend  "KSeFFlow" 8081
start_frontend "KSeFFlow" 3001
sleep 0.4

# ── SafeVoice (Whistleblower) ────────────────────────────────────────────────
echo "► SafeVoice"
start_backend  "SafeVoice" 8087
start_frontend "SafeVoice" 3007
sleep 0.4

# ── WasteSync (BDO waste reporting) ─────────────────────────────────────────
echo "► WasteSync"
start_backend  "WasteSync" 8083
start_frontend "WasteSync" 3003
sleep 0.4

# ── SafeWork (HR / BHP compliance) ──────────────────────────────────────────
echo "► SafeWork"
start_backend  "SafeWork" 8082
start_frontend "SafeWork" 3002
sleep 0.4

# ── WorkPulse (Time tracking) ────────────────────────────────────────────────
echo "► WorkPulse"
start_backend  "WorkPulse" 8085
start_frontend "WorkPulse" 3005
sleep 0.4

# ── PrivacyPilot (GDPR/RODO) ────────────────────────────────────────────────
echo "► PrivacyPilot"
start_backend  "PrivacyPilot" 8086
start_frontend "PrivacyPilot" 3006
sleep 0.4

echo ""
echo "All available services launched."
echo ""
echo "  Platform Hub  → http://localhost:3000"
echo "  KSeFFlow      → http://localhost:3001"
echo "  SafeVoice     → http://localhost:3007"
echo "  WasteSync     → http://localhost:3003"
echo "  SafeWork      → http://localhost:3002"
echo "  WorkPulse     → http://localhost:3005"
echo "  PrivacyPilot  → http://localhost:3006"
echo ""
