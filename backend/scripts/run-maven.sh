#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
WRAPPER="${BACKEND_DIR}/mvnw"
MAX_ATTEMPTS=${MAVEN_WRAPPER_BOOTSTRAP_ATTEMPTS:-3}

case "${MAX_ATTEMPTS}" in
  ''|*[!0-9]*|0)
    echo "MAVEN_WRAPPER_BOOTSTRAP_ATTEMPTS must be a positive integer." >&2
    exit 2
    ;;
esac

cd "${BACKEND_DIR}"

attempt=1
while [ "${attempt}" -le "${MAX_ATTEMPTS}" ]; do
  echo "Bootstrapping Maven wrapper (attempt ${attempt}/${MAX_ATTEMPTS})..." >&2
  if "${WRAPPER}" -B --version >&2; then
    exec "${WRAPPER}" "$@"
  fi

  if [ "${attempt}" -lt "${MAX_ATTEMPTS}" ]; then
    sleep_seconds=$((attempt * 5))
    echo "Maven wrapper bootstrap failed; retrying in ${sleep_seconds}s." >&2
    sleep "${sleep_seconds}"
  fi
  attempt=$((attempt + 1))
done

if ! command -v mvn >/dev/null 2>&1; then
  echo "Maven wrapper bootstrap failed and no system Maven fallback is available." >&2
  exit 1
fi

echo "Maven wrapper bootstrap failed; using the system Maven fallback." >&2
mvn -B --version >&2
exec mvn "$@"
