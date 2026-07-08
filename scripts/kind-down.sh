#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${KIND_CLUSTER_NAME:-endian}"

command -v kind >/dev/null 2>&1 || {
  echo "kind is required" >&2
  exit 1
}

if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  echo "Deleting kind cluster '${CLUSTER_NAME}'..."
  kind delete cluster --name "${CLUSTER_NAME}"
else
  echo "No kind cluster named '${CLUSTER_NAME}'"
fi
