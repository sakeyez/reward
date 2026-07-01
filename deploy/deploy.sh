#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/reward}"
REPO_URL="${REPO_URL:-https://github.com/sakeyez/reward.git}"
SERVICE_NAME="${SERVICE_NAME:-reward-api}"
NGINX_SITE="${NGINX_SITE:-reward}"
SERVER_NAME="${SERVER_NAME:-_}"

if [ "$(id -u)" -eq 0 ]; then
  echo "Please run this script as a normal sudo-capable user, not root."
  exit 1
fi

sudo apt update
sudo apt install -y git nginx python3 python3-venv python3-pip nodejs npm

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  sudo mkdir -p "$(dirname "$APP_DIR")"
  sudo chown -R "$USER:$USER" "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  SECRET_KEY="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  cat > .env <<EOF
APP_ENV=production
DATABASE_URL=sqlite+aiosqlite:///$APP_DIR/reward.db
UPLOAD_DIR=$APP_DIR/backend/uploads
CORS_ORIGINS=http://$SERVER_NAME
OPENAI_API_KEY=
AI_CONFIG_ENCRYPTION_KEY=
SECRET_KEY=$SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES=1440
JWT_ALGORITHM=HS256
EOF
  echo "Created $APP_DIR/.env"
fi

python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r backend/requirements.txt
./.venv/bin/python -m alembic -c backend/alembic.ini upgrade head
./.venv/bin/python backend/seed.py

cd "$APP_DIR/frontend"
npm install
npm run build

cd "$APP_DIR"
sudo cp deploy/reward-api.service "/etc/systemd/system/$SERVICE_NAME.service"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

TMP_NGINX="$(mktemp)"
sed "s/server_name _;/server_name $SERVER_NAME;/" deploy/nginx.reward.conf > "$TMP_NGINX"
sudo cp "$TMP_NGINX" "/etc/nginx/sites-available/$NGINX_SITE"
rm "$TMP_NGINX"
sudo ln -sfn "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"
sudo nginx -t
sudo systemctl reload nginx

echo "Deployment finished."
echo "Open: http://$SERVER_NAME"
