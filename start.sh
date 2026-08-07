#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# RegulaOne — Platform Launcher
# Opens every backend and frontend in its own Terminal tab.
#
# Port map:
#   RegulaOne   backend :8080   frontend :3000
#   KSeFFlow    backend :8081   frontend :3001
#   SafeVoice   backend :9003   frontend :1003
#   WasteSync   backend :8083   frontend :3003
#   SafeWork    backend :8082   frontend :3002
#   WorkPulse   backend :8085   frontend :3005
#   PrivacyPilot backend :9004  frontend :3006
# ─────────────────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── helpers ──────────────────────────────────────────────────────────────────

# Find the machine's current LAN address. REGULAONE_LAN_IP can be set explicitly
# when a machine has several active network adapters and a specific one is
# required for tester access.
detect_lan_ip() {
  local default_interface=""
  local detected_ip=""

  if command -v route >/dev/null 2>&1 && command -v ipconfig >/dev/null 2>&1; then
    default_interface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
    if [ -n "$default_interface" ]; then
      detected_ip="$(ipconfig getifaddr "$default_interface" 2>/dev/null)"
    fi
  fi

  if [ -z "$detected_ip" ] && command -v hostname >/dev/null 2>&1; then
    detected_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  if [ -z "$detected_ip" ] && command -v ifconfig >/dev/null 2>&1; then
    detected_ip="$(
      ifconfig 2>/dev/null |
        awk '
          /^[[:alnum:]][[:alnum:]_.-]*:/ {
            interface_name=$1
            sub(/:$/, "", interface_name)
          }
          $1 == "inet" &&
          $2 != "127.0.0.1" &&
          $2 !~ /^169\.254\./ &&
          interface_name !~ /^(lo|utun|awdl|llw|bridge)/ {
            print $2
            exit
          }
        '
    )"
  fi

  printf '%s' "$detected_ip"
}

LAN_IP="${REGULAONE_LAN_IP:-$(detect_lan_ip)}"
if [ -n "$LAN_IP" ] && ! [[ "$LAN_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  echo "  [warn] Ignoring invalid REGULAONE_LAN_IP value: ${LAN_IP}"
  LAN_IP=""
fi

# Build an explicit CORS allowlist for one or more local frontend ports.
#
# WHY THIS EXISTS: a browser only lets a page call an API on a different address
# when the API says "this address is allowed" (CORS). Testers open the apps by this
# computer's network address (for example http://192.168.x.y:3000), which is a
# DIFFERENT address than http://localhost:3000 — so that address must be on the
# list too, or every request is refused.
#
# The list is built fresh on every launch from the address detected above, so when
# the Wi-Fi hands this machine a new address nothing has to be edited by hand.
# Credentials (the shared login cookie) are used by the platform, so a wildcard
# origin would be insecure and is deliberately not used.
#
# Usage: local_frontend_origins 3000 3001 1003
local_frontend_origins() {
  local origins=""
  local port

  for port in "$@"; do
    origins="${origins:+${origins},}http://localhost:${port},http://127.0.0.1:${port}"
    if [ -n "$LAN_IP" ]; then
      origins="${origins},http://${LAN_IP}:${port}"
    fi
  done

  printf '%s' "$origins"
}

# Free a port before we use it.
# Sometimes an old server from a previous run is still alive and is still
# holding the port. If we try to start a new server on the same port, it
# crashes with "EADDRINUSE: address already in use". To avoid this, we find
# any process listening on the port and stop it first. This makes the
# launcher safe to run again and again without leftover servers piling up.
free_port() {
  local port="$1"
  # lsof lists the process IDs (PIDs) listening on this TCP port.
  # If we find any, we send them a kill signal so the port becomes free.
  local pids
  pids="$(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null)"
  if [ -n "$pids" ]; then
    echo "  [port] freeing :${port} (stopping old process ${pids})"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null
    sleep 0.5
    # If something refused to stop, force it so the new server can start.
    pids="$(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null)"
    if [ -n "$pids" ]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null
    fi
  fi
}

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
# Arguments:
#   $1 module name        e.g. RegulaOne
#   $2 backend port       e.g. 8080
#   $3 directory name     folder under the repo root (defaults to the module name)
#   $4 CORS variable name the name this backend reads its allowlist from
#                         (Spring: CORS_ALLOWED_ORIGINS · Node: CORS_ORIGIN)
#   $5 CORS origins       the allowlist itself, built by local_frontend_origins
start_backend() {
  local module="$1"   # e.g. RegulaOne
  local port="$2"
  local directory_name="${3:-$module}"
  local cors_variable="${4:-}"
  local cors_origins="${5:-}"
  local dir="${ROOT}/${directory_name}/backend"

  if [ ! -d "$dir" ]; then
    echo "  [skip] ${module} backend — directory not found"
    return
  fi

  local cmd

  # The allowlist of browser addresses that may call this API, passed in as an
  # environment variable. Both kinds of backend read it from their environment, so
  # the current network address is applied at launch and no file needs editing when
  # that address changes.
  local cors_env=""
  if [ -n "$cors_variable" ] && [ -n "$cors_origins" ]; then
    cors_env="${cors_variable}=${cors_origins}"
  fi

  if [ -f "${dir}/pom.xml" ] || [ -f "${dir}/mvnw" ]; then
    # This is a Spring Boot (Java/Maven) backend.
    # Use the project's own Maven wrapper if it has one, else the system mvn.
    # Maven passes its own environment down to the server it starts, so the CORS
    # allowlist set here reaches the running application.
    local mvn_cmd="mvn"
    [ -f "${dir}/mvnw" ] && mvn_cmd="./mvnw"
    cmd="cd '${dir}' && echo '▶ Starting ${module} backend on :${port}' && ${cors_env} ${mvn_cmd} spring-boot:run -Dspring-boot.run.arguments=--server.port=${port} ; exec \$SHELL"

  elif [ -f "${dir}/package.json" ]; then
    # This is a Node.js backend (for example SafeWork).
    # If the dependencies were never installed, install them first so the
    # server does not crash with "command not found". Then start the server.
    # We pass PORT and BIND_HOST so the Node app listens on the assigned port
    # on every local network interface.
    local runtime_env="BIND_HOST=0.0.0.0 PORT=${port}"
    if [ -n "$cors_env" ]; then
      runtime_env="${runtime_env} ${cors_env}"
    fi
    cmd="cd '${dir}' && echo '▶ Starting ${module} backend on :${port}' && { [ -d node_modules ] || npm install ; } && ${runtime_env} npm start ; exec \$SHELL"

  else
    echo "  [skip] ${module} backend — no pom.xml or package.json"
    return
  fi

  # Stop any old server still holding this port before we start a new one.
  free_port "${port}"
  open_tab "${module} Backend :${port}" "$cmd"
  echo "  [✓] ${module} backend  → http://localhost:${port}"
}

# Start an npm-based frontend if the directory exists
start_frontend() {
  local module="$1"
  local port="$2"
  local directory_name="${3:-$module}"
  local dir="${ROOT}/${directory_name}/frontend"

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
  #
  # REGULAONE_LAN_IP is passed on as well. The dev servers find this computer's
  # network address by themselves, so this is only an override for the case where
  # the machine has several networks and a specific one must be used.
  local runtime_env="PORT=${port}"
  if [ -n "$LAN_IP" ]; then
    runtime_env="${runtime_env} REGULAONE_LAN_IP=${LAN_IP}"
  fi
  local cmd="cd '${dir}' && echo '▶ Starting ${module} frontend on :${port}' && { [ -d node_modules ] || npm install ; } && ${runtime_env} npm run dev ; exec \$SHELL"
  # Stop any old dev server still holding this port before we start a new one.
  free_port "${port}"
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
# RegulaOne handles the login for EVERY module, so its allowlist must contain the
# address of every module's frontend — otherwise signing in from that module fails.
echo "► RegulaOne"
start_backend  "RegulaOne" 8080 "RegulaOne" "CORS_ALLOWED_ORIGINS" \
  "$(local_frontend_origins 3000 3001 3002 3003 3004 3005 3006 1003 1004)"
start_frontend "RegulaOne" 3000
sleep 0.4

# ── KSeFFlow (E-invoicing) ───────────────────────────────────────────────────
echo "► KSeFFlow"
start_backend  "KSeFFlow" 8081 "KSeFFlow" "CORS_ALLOWED_ORIGINS" "$(local_frontend_origins 3001)"
start_frontend "KSeFFlow" 3001
sleep 0.4

# ── SafeVoice (Whistleblower) ────────────────────────────────────────────────
echo "► SafeVoice"
start_backend  "SafeVoice" 9003 "SafeVoice" "CORS_ALLOWED_ORIGINS" "$(local_frontend_origins 1003)"
start_frontend "SafeVoice" 1003
sleep 0.4

# ── WasteSync (BDO waste reporting) ─────────────────────────────────────────
echo "► WasteSync"
start_backend  "WasteSync" 8083 "WasteSync" "CORS_ORIGIN" "$(local_frontend_origins 3003)"
start_frontend "WasteSync" 3003
sleep 0.4

# ── SafeWork (HR / BHP compliance) ──────────────────────────────────────────
echo "► SafeWork"
start_backend  "SafeWork" 8082 "safeWork" "CORS_ORIGIN" "$(local_frontend_origins 3002)"
start_frontend "SafeWork" 3002 "safeWork"
sleep 0.4

# ── WorkPulse (Time tracking) ────────────────────────────────────────────────
echo "► WorkPulse"
start_backend  "WorkPulse" 8085 "WorkPulse" "CORS_ORIGIN" "$(local_frontend_origins 3005)"
start_frontend "WorkPulse" 3005
sleep 0.4

# ── PrivacyPilot (GDPR/RODO) ────────────────────────────────────────────────
# PrivacyPilot reads its allowlist from its own variable name (see its
# application-dev.properties), which is why the name differs here.
echo "► PrivacyPilot"
start_backend  "PrivacyPilot" 9004 "PrivacyPilot" "PRIVACYPILOT_CORS_ORIGINS" \
  "$(local_frontend_origins 3006)"
start_frontend "PrivacyPilot" 3006
sleep 0.4

echo ""
echo "All available services launched."
echo ""
echo "  Platform Hub  → http://localhost:3000"
echo "  KSeFFlow      → http://localhost:3001"
echo "  SafeVoice     → http://localhost:1003"
echo "  WasteSync     → http://localhost:3003"
echo "  SafeWork      → http://localhost:3002"
echo "  WorkPulse     → http://localhost:3005"
echo "  PrivacyPilot  → http://localhost:3006"
echo ""

if [ -n "$LAN_IP" ]; then
  # Every app is reachable on this address: each backend was started with this
  # address on its allowlist, and each frontend asks the SAME address it was opened
  # on for its API. So a tester only needs one of the links below.
  echo "Tester access on this network (${LAN_IP}):"
  echo "  Platform Hub  → http://${LAN_IP}:3000  (API: http://${LAN_IP}:8080)"
  echo "  KSeFFlow      → http://${LAN_IP}:3001  (API: http://${LAN_IP}:8081)"
  echo "  SafeVoice     → http://${LAN_IP}:1003  (API: http://${LAN_IP}:9003)"
  echo "  WasteSync     → http://${LAN_IP}:3003  (API: http://${LAN_IP}:8083)"
  echo "  SafeWork      → http://${LAN_IP}:3002  (API: http://${LAN_IP}:8082)"
  echo "  WorkPulse     → http://${LAN_IP}:3005  (API: http://${LAN_IP}:8085)"
  echo "  PrivacyPilot  → http://${LAN_IP}:3006  (API: http://${LAN_IP}:9004)"
  echo ""
  echo "  Testers must sign in on the Platform Hub link above (NOT on localhost):"
  echo "  the login cookie is tied to the address it was issued for."
  echo ""
else
  echo "LAN IP was not detected. Set REGULAONE_LAN_IP before running start.sh"
  echo "to print and allow tester URLs for a specific network adapter."
  echo ""
fi
