#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="${KIND_CLUSTER_NAME:-endian}"
CONFIG="${ROOT_DIR}/infra/kind/cluster-config.yaml"

command -v kind >/dev/null 2>&1 || {
  echo "kind is required: https://kind.sigs.k8s.io/docs/user/quick-start/#installation" >&2
  exit 1
}

if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  echo "kind cluster '${CLUSTER_NAME}' already exists"
else
  echo "Creating kind cluster '${CLUSTER_NAME}'..."
  kind create cluster --name "${CLUSTER_NAME}" --config "${CONFIG}"
fi

echo "Installing ingress-nginx..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s

echo "Applying local kustomize overlay..."
kubectl apply -k "${ROOT_DIR}/infra/k8s/overlays/local"

echo ""
echo "kind cluster ready."
echo "  export KUBECONFIG=\$(kind get kubeconfig --name ${CLUSTER_NAME})"
echo "  Platform (after images): http://platform.localtest.me"
echo "  Preview pattern: {projectId}.preview.localtest.me"
