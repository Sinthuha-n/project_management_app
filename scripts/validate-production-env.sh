#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env.production}"
FRONTEND_ORIGIN="${PLANORA_FRONTEND_ORIGIN:-https://planora-pma.netlify.app}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing production env file: $ENV_FILE" >&2
  exit 1
fi

get_env_value() {
  key="$1"
  line="$(
    awk -v key="$key" '
      /^[[:space:]]*#/ { next }
      /^[[:space:]]*$/ { next }
      index($0, key "=") == 1 { value = substr($0, length(key) + 2) }
      END { print value }
    ' "$ENV_FILE"
  )"

  line="${line#\"}"
  line="${line%\"}"
  line="${line#\'}"
  line="${line%\'}"
  printf '%s' "$line"
}

require_equals() {
  key="$1"
  expected="$2"
  actual="$(get_env_value "$key")"

  if [ "$actual" != "$expected" ]; then
    echo "$key must be set to $expected in $ENV_FILE; found '${actual:-<missing>}'." >&2
    exit 1
  fi
}

require_contains_origin() {
  key="$1"
  origin="$2"
  actual="$(get_env_value "$key")"

  case ",$actual," in
    *",$origin,"*) ;;
    *)
      echo "$key must include $origin in $ENV_FILE; found '${actual:-<missing>}'." >&2
      exit 1
      ;;
  esac
}

profile="$(get_env_value SPRING_PROFILES_ACTIVE)"
case ",$profile," in
  *,prod,*|*,production,*) ;;
  *)
    echo "SPRING_PROFILES_ACTIVE must include prod or production in $ENV_FILE; found '${profile:-<missing>}'." >&2
    exit 1
    ;;
esac

require_equals APP_FRONTEND_BASE_URL "$FRONTEND_ORIGIN"
require_contains_origin CORS_ALLOWED_ORIGINS "$FRONTEND_ORIGIN"
require_contains_origin WEBSOCKET_ALLOWED_ORIGINS "$FRONTEND_ORIGIN"

echo "Production env preflight passed for $ENV_FILE."
