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

# Open a new Terminal tab and run a command in it
open_tab() {
  local label="$1"
  local cmd="$2"
  osascript \
    -e 'tell application "Terminal"' \
    -e '  activate' \
    -e '  tell application "System Events" to keystroke "t" using command down' \
    -e "  delay 0.3" \
    -e "  do script \"printf '\\\\033]0;${label}\\\\007' ; ${cmd}\" in front window" \
    -e 'end tell' \
    > /dev/null 2>&1
}

# Start a backend if the directory exists.
# Some backends are Spring Boot (Java) and some are Node.js (like SafeWork).
# We look at the files inside the folder to figure out which kind it is,
# then run the correct command. This way one launcher handles both types.
start_backend() {
  local module="$1"   # e.g. RegulaOne
  local port="$2"
  local dir="${ROOT}/${module}/backend"

  if [ ! -d "$dir" ]; then
    echo "  [skip] ${module} backend — directory not found"
    return
  fi

  local cmd

  if [ -f "${dir}/pom.xml" ] || [ -f "${dir}/mvnw" ]; then
    # This is a Spring Boot (Java/Maven) backend.
    # Use the project's own Maven wrapper if it has one, else the system mvn.
    local mvn_cmd="mvn"
    [ -f "${dir}/mvnw" ] && mvn_cmd="./mvnw"
    cmd="cd '${dir}' && echo '▶ Starting ${module} backend on :${port}' && ${mvn_cmd} spring-boot:run -Dspring-boot.run.arguments=--server.port=${port} ; exec \$SHELL"

  elif [ -f "${dir}/package.json" ]; then
    # This is a Node.js backend (for example SafeWork).
    # If the dependencies were never installed, install them first so the
    # server does not crash with "command not found". Then start the server.
    # We pass PORT so the Node app listens on the right port.
    cmd="cd '${dir}' && echo '▶ Starting ${module} backend on :${port}' && { [ -d node_modules ] || npm install ; } && PORT=${port} npm start ; exec \$SHELL"

  else
    echo "  [skip] ${module} backend — no pom.xml or package.json"
    return
  fi

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

  # If the dependencies were never installed, install them first so that
  # "npm run dev" can find the vite command and start without crashing.
  # Pass PORT env var; Vite reads it, Express/tsx server reads it too.
  local cmd="cd '${dir}' && echo '▶ Starting ${module} frontend on :${port}' && { [ -d node_modules ] || npm install ; } && PORT=${port} npm run dev ; exec \$SHELL"
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
