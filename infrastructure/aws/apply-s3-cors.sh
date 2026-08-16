#!/usr/bin/env bash
# ==============================================================================
# Planora — Apply S3 Bucket CORS Configuration
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CORS_FILE="${SCRIPT_DIR}/s3-cors-policy.json"

if [ ! -f "$CORS_FILE" ]; then
    echo "ERROR: CORS configuration file not found at $CORS_FILE"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "========================================================"
    echo "AWS CLI is not installed on this machine."
    echo "Attempting to apply CORS via the backend Java S3 client..."
    echo "========================================================"
    cd "${ROOT_DIR}/backend"
    ./mvnw exec:java -Dexec.mainClass="com.planora.backend.tools.ApplyS3Cors" -q || true
    exit 0
fi

# Load bucket names from environment or fall back to production defaults
CHAT_BUCKET="${AWS_S3_CHAT_BUCKET:-${AWS_CHAT_BUCKET:-planora-prod-chat-attachments-657347292859-eu-north-1-an}}"
DMS_BUCKET="${AWS_S3_DMS_BUCKET:-${AWS_DMS_BUCKET:-planora-prod-dms-documents}}"
PROFILE_BUCKET="${AWS_S3_PROFILE_BUCKET:-${AWS_PROFILE_PHOTOS_BUCKET:-planora-prod-profile-photos-657347292859-eu-north-1-an}}"
TASK_BUCKET="${AWS_S3_TASK_BUCKET:-${AWS_TASK_STORAGE_BUCKET:-planora-prod-task-attachments-657347292859-eu-north-1-an}}"
AWS_REGION="${AWS_REGION:-eu-north-1}"

BUCKETS=("$CHAT_BUCKET" "$DMS_BUCKET" "$PROFILE_BUCKET" "$TASK_BUCKET")

echo "========================================================"
echo "Applying S3 CORS Policy to Planora Buckets via AWS CLI"
echo "Region: $AWS_REGION"
echo "========================================================"

for BUCKET in "${BUCKETS[@]}"; do
    if [ -z "$BUCKET" ]; then
        continue
    fi
    echo -n "Configuring CORS for bucket: $BUCKET ... "
    if aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://${CORS_FILE}" --region "$AWS_REGION"; then
        echo "SUCCESS"
    else
        echo "FAILED"
    fi
done

echo "========================================================"
echo "Done."
