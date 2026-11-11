#!/usr/bin/env bash
# Build the site and publish it to team20 as a frontend-only deployment.
#   KUBECONFIG=/absolute/path/to/team20.yaml bash web/deploy/deploy.sh
set -euo pipefail
: "${KUBECONFIG:?Set KUBECONFIG to the absolute path of the team20 kubeconfig}"
cd "$(dirname "$0")/.."

npm run build

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tar czf "$work/site.tgz" -C out .
# A ConfigMap holds at most 1 MiB and binary data grows by a third, so stay well under that.
split -b 700k -d "$work/site.tgz" "$work/part-"
count=$(ls "$work"/part-* | wc -l | tr -d ' ')
if [ "$count" -gt 3 ]; then
  echo "Site needs $count chunks but deploy/site.yaml mounts 3. Add more sources there." >&2
  exit 1
fi

kubectl delete configmap -l klimatex=site-chunk --ignore-not-found
i=0
for part in "$work"/part-*; do
  name="klimatex-site-$i"
  kubectl create configmap "$name" --from-file="$(basename "$part")=$part"
  kubectl label configmap "$name" klimatex=site-chunk
  i=$((i + 1))
done

kubectl apply -f deploy/site.yaml
kubectl rollout restart deployment/app
kubectl rollout status deployment/app --timeout=180s
