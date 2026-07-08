#!/usr/bin/env bash
set -euo pipefail

for dir in "${HOME}/bin" "${HOME}/google-cloud-sdk/bin"; do
  if [[ -d "${dir}" ]]; then
    PATH="${dir}:${PATH}"
  fi
done
export PATH

NAMESPACE="${NAMESPACE:-endian-platform}"
DEPLOYMENT="${DEPLOYMENT:-platform}"
CONTAINER="${CONTAINER:-platform}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required" >&2
  exit 1
fi

echo "Running Better Auth migrations in ${NAMESPACE}/${DEPLOYMENT} (${CONTAINER})"
kubectl exec -n "${NAMESPACE}" "deploy/${DEPLOYMENT}" -c "${CONTAINER}" -- node --input-type=module -e "
import { getMigrations } from 'better-auth/db/migration';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const config = {
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
};
const { runMigrations } = await getMigrations(config);
await runMigrations();
console.log('Better Auth migrations complete');
await pool.end();
"
