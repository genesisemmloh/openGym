#!/usr/bin/env bash
# Deploys this fork of openGym to Azure Container Apps: one app, two containers (web + api) sharing
# localhost, the api's /data on an Azure Files share, one replica (the JSON-file storage is
# single-writer), HTTPS on the environment's own *.azurecontainerapps.io name.
#
#   bash deploy/azure/deploy.sh                 # build, push and roll out a new revision
#   SKIP_BUILD=1 TAG=<tag> bash deploy/azure/deploy.sh   # roll out images already in the registry
#   INVITE_ONLY=0 SKIP_BUILD=1 TAG=<tag> bash deploy/azure/deploy.sh   # open sign-up (fresh instance only)
#
# Needs: az (logged in), docker. The app is written with `az rest` against the ARM API directly,
# so an old containerapp CLI extension does not matter. Every name can be overridden by env var.
set -euo pipefail

# Your names live in deploy/azure/azure.env (git-ignored; copy azure.env.example). Nothing about
# your subscription or resources is kept in the repository.
ENV_FILE="$(dirname "$0")/azure.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
: "${SUB:?set SUB (subscription name or id) in deploy/azure/azure.env}"
: "${RG:?set RG (resource group)}"
: "${ACR:?set ACR (container registry name)}"
: "${ENV_NAME:?set ENV_NAME (Container Apps environment)}"
: "${APP:?set APP (container app name)}"
LOC="${LOC:-westeurope}"
TAG="${TAG:-$(date +%Y%m%d%H%M)}"
# Sign-up: the first profile became the admin; from then on new profiles need an invite code.
# INVITE_ONLY=0 opens sign-up again (only for an empty instance that still needs its admin).
INVITE_ONLY="${INVITE_ONLY:-1}"
API="2024-03-01"

cd "$(dirname "$0")/../.."
REG="$ACR.azurecr.io"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  az acr login -n "$ACR" --subscription "$SUB" >/dev/null
  docker compose build
  for i in api web; do
    docker tag "ghcr.io/duartesantos8/opengym-$i:latest" "$REG/opengym-$i:$TAG"
    docker push "$REG/opengym-$i:$TAG"
  done
fi

SUB_ID=$(az account show --subscription "$SUB" --query id -o tsv)
ENV_ID="/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.App/managedEnvironments/$ENV_NAME"
DOMAIN=$(az rest --method get --url "https://management.azure.com$ENV_ID?api-version=$API" --query properties.defaultDomain -o tsv)
FQDN="$APP.$DOMAIN"
ACR_PASS=$(az acr credential show -n "$ACR" --subscription "$SUB" --query "passwords[0].value" -o tsv)

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT
cat > "$BODY" <<EOF
{
  "location": "$LOC",
  "properties": {
    "environmentId": "$ENV_ID",
    "workloadProfileName": "Consumption",
    "configuration": {
      "activeRevisionsMode": "Single",
      "ingress": { "external": true, "targetPort": 8080, "transport": "auto", "allowInsecure": false },
      "registries": [ { "server": "$REG", "username": "$ACR", "passwordSecretRef": "acr-pass" } ],
      "secrets": [ { "name": "acr-pass", "value": "$ACR_PASS" } ]
    },
    "template": {
      "containers": [
        {
          "name": "api",
          "image": "$REG/opengym-api:$TAG",
          "resources": { "cpu": 0.5, "memory": "1Gi" },
          "env": [
            { "name": "PORT", "value": "3000" },
            { "name": "DATA_DIR", "value": "/data" },
            { "name": "RP_ID", "value": "$FQDN" },
            { "name": "RP_NAME", "value": "openGym" },
            { "name": "ORIGIN", "value": "https://$FQDN" },
            { "name": "TRUST_PROXY", "value": "1" },
            { "name": "FIRST_USER_ADMIN", "value": "1" },
            { "name": "ALLOW_GUEST", "value": "0" },
            { "name": "PASSWORD_LOGIN", "value": "1" },
            { "name": "INVITE_ONLY", "value": "$INVITE_ONLY" }
          ],
          "volumeMounts": [ { "volumeName": "data", "mountPath": "/data" } ]
        },
        {
          "name": "web",
          "image": "$REG/opengym-web:$TAG",
          "resources": { "cpu": 0.25, "memory": "0.5Gi" },
          "env": [
            { "name": "NGINX_PORT", "value": "8080" },
            { "name": "BACKEND", "value": "127.0.0.1" },
            { "name": "PORT", "value": "3000" }
          ]
        }
      ],
      "scale": { "minReplicas": 1, "maxReplicas": 1 },
      "volumes": [
        { "name": "data", "storageType": "AzureFile", "storageName": "opengymdata",
          "mountOptions": "dir_mode=0777,file_mode=0777,mfsymlinks,nobrl,cache=strict" }
      ]
    }
  }
}
EOF

az rest --method put --url "https://management.azure.com/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.App/containerApps/$APP?api-version=$API" \
  --body "@$BODY" --query "properties.provisioningState" -o tsv
echo "https://$FQDN"
