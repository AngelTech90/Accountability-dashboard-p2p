#!/usr/bin/env bash
# ============================================================
# God Analyzer UI — Setup, Build & Deploy
#
# FIRST TIME:
#   chmod +x setup.sh
#   ./setup.sh install    <- run this FIRST (not npm install start)
#   ./setup.sh dev        <- then this to run locally
#
# Commands:
#   ./setup.sh install    # install all npm dependencies
#   ./setup.sh dev        # start dev server at localhost:3000
#   ./setup.sh build      # production build -> ./build/
#   ./setup.sh deploy     # build + push to GitHub Pages
#   ./setup.sh clean      # remove node_modules and build
#   ./setup.sh git-init   # init git repo for first commit
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN="\033[0;32m"; BLUE="\033[0;34m"; AMBER="\033[0;33m"; RED="\033[0;31m"; RESET="\033[0m"
log()  { echo -e "${BLUE}[GOD]${RESET} $1"; }
ok()   { echo -e "${GREEN}[OK]${RESET} $1"; }
warn() { echo -e "${AMBER}[WARN]${RESET} $1"; }
err()  { echo -e "${RED}[ERR]${RESET} $1"; exit 1; }

check_node() {
  command -v node &>/dev/null || err "Node.js not found. Install from https://nodejs.org (v18+ recommended)"
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  [ "$NODE_VER" -lt 16 ] && err "Node.js v16+ required (found $(node -v))"
  ok "Node.js $(node -v) / npm $(npm -v)"
}

do_install() {
  check_node
  cd "$SCRIPT_DIR"
  log "Running: npm install --legacy-peer-deps"
  npm install --legacy-peer-deps
  # Fix for react-scripts 5 + Node 18/20/22 ajv peer-dep conflict
  log "Applying ajv compatibility fix..."
  npm install ajv@^8.0.0 --legacy-peer-deps 2>/dev/null || true
  ok "All dependencies installed"
}

do_dev() {
  check_node
  [ ! -d "$SCRIPT_DIR/node_modules/.bin/react-scripts" ] && \
  [ ! -f "$SCRIPT_DIR/node_modules/.bin/react-scripts" ] && do_install
  log "Starting dev server → http://localhost:3000"
  cd "$SCRIPT_DIR" && npm start
}

do_build() {
  check_node
  [ ! -f "$SCRIPT_DIR/node_modules/.bin/react-scripts" ] && do_install
  log "Building production bundle..."
  cd "$SCRIPT_DIR"
  GENERATE_SOURCEMAP=false npm run build
  ok "Build complete → ./build/"
  echo "  Serve locally: npx serve -s build"
  echo "  Deploy:        ./setup.sh deploy"
}

do_deploy() {
  check_node
  [ ! -f "$SCRIPT_DIR/node_modules/.bin/react-scripts" ] && do_install
  git -C "$SCRIPT_DIR" remote get-url origin &>/dev/null || {
    warn "No git remote 'origin'. Add it first:"
    warn "  git remote add origin https://github.com/YOUR_USER/REPO.git"
    exit 1
  }
  REMOTE=$(git -C "$SCRIPT_DIR" remote get-url origin)
  GH_USER=$(echo "$REMOTE" | sed -E 's|.*github\.com[:/]([^/]+)/.*|\1|')
  REPO=$(echo "$REMOTE" | sed -E 's|.*github\.com[:/][^/]+/([^/.]+).*|\1|')
  log "Deploying to https://${GH_USER}.github.io/${REPO}/"
  python3 -c "
import json
with open('$SCRIPT_DIR/package.json') as f: p=json.load(f)
p['homepage']='https://${GH_USER}.github.io/${REPO}'
with open('$SCRIPT_DIR/package.json','w') as f: json.dump(p,f,indent=2)
" 2>/dev/null || true
  cd "$SCRIPT_DIR"
  GENERATE_SOURCEMAP=false npm run build
  npm install --save-dev gh-pages --legacy-peer-deps 2>/dev/null || true
  npx gh-pages -d build
  ok "Live at https://${GH_USER}.github.io/${REPO}/ (takes ~1 min)"
}

do_clean() {
  rm -rf "$SCRIPT_DIR/node_modules" "$SCRIPT_DIR/build" "$SCRIPT_DIR/.cache"
  ok "Cleaned node_modules, build, .cache"
}

do_git_init() {
  cd "$SCRIPT_DIR"
  [ ! -d ".git" ] && git init && git add . && git commit -m "feat: God Analyzer UI"
  ok "Git repo ready. Add remote: git remote add origin https://github.com/USER/REPO.git"
}

CMD="${1:-help}"
echo -e "\n${GREEN}⬡ GOD ANALYZER UI${RESET} — ${BLUE}${CMD}${RESET}\n"

case "$CMD" in
  install)  do_install ;;
  dev)      do_dev ;;
  build)    do_build ;;
  deploy)   do_deploy ;;
  clean)    do_clean ;;
  git-init) do_git_init ;;
  *)
    echo "Usage: ./setup.sh [install|dev|build|deploy|clean|git-init]"
    echo ""
    echo "  install   — npm install (run this first)"
    echo "  dev       — start dev server at localhost:3000"
    echo "  build     — production build to ./build/"
    echo "  deploy    — build + GitHub Pages deploy"
    echo "  clean     — remove node_modules + build"
    echo "  git-init  — init git repo"
    ;;
esac
