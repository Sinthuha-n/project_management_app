#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env.production}"
FRONTEND_ORIGIN="${PLANORA_FRONTEND_ORIGIN:-https://planora-pma.netlify.app}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing production env file: $ENV_FILE" >&2
  exit 1
fi

set_env_value() {
  key="$1"
  value="$2"
  tmp_file="${ENV_FILE}.tmp"

  if grep -q "^${key}=" "$ENV_FILE"; then
    awk -v key="$key" -v value="$value" '
      index($0, key "=") == 1 { print key "=" value; next }
      { print }
    ' "$ENV_FILE" > "$tmp_file"
  else
    cp "$ENV_FILE" "$tmp_file"
    printf '\n%s=%s\n' "$key" "$value" >> "$tmp_file"
  fi

  mv "$tmp_file" "$ENV_FILE"
}

set_env_value SPRING_PROFILES_ACTIVE prod
set_env_value APP_FRONTEND_BASE_URL "$FRONTEND_ORIGIN"
set_env_value CORS_ALLOWED_ORIGINS "$FRONTEND_ORIGIN"
set_env_value WEBSOCKET_ALLOWED_ORIGINS "$FRONTEND_ORIGIN"

echo "Repaired production frontend origin settings in $ENV_FILE."
