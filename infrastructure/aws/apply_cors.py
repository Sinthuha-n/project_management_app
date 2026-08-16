#!/usr/bin/env python3
"""
Planora - Apply S3 CORS Configuration using pure Python standard library (AWS SigV4).
Reads AWS credentials from .env and configures all 4 S3 buckets.
"""

import os
import sys
import hmac
import hashlib
import urllib.request
import urllib.error
from datetime import datetime, timezone

def load_env():
    env_vars = {}
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip().strip("'").strip('"')
    return env_vars

def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

def get_signature_key(key, date_stamp, region_name, service_name):
    k_date = sign(('AWS4' + key).encode('utf-8'), date_stamp)
    k_region = sign(k_date, region_name)
    k_service = sign(k_region, service_name)
    k_signing = sign(k_service, 'aws4_request')
    return k_signing

CORS_XML = """<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://planora-pma.netlify.app</AllowedOrigin>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedOrigin>http://localhost:3001</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-amz-request-id</ExposeHeader>
    <ExposeHeader>x-amz-id-2</ExposeHeader>
    <ExposeHeader>Content-Type</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>""".encode('utf-8')

def apply_cors_to_bucket(bucket_name, access_key, secret_key, region):
    host = f"{bucket_name}.s3.{region}.amazonaws.com"
    endpoint = f"https://{host}/?cors"
    now = datetime.now(timezone.utc)
    amz_date = now.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = now.strftime('%Y%m%d')

    payload_hash = hashlib.sha256(CORS_XML).hexdigest()
    content_md5 = urllib.request.base64.b64encode(hashlib.md5(CORS_XML).digest()).decode('utf-8')

    canonical_uri = '/'
    canonical_querystring = 'cors='
    canonical_headers = (
        f"content-md5:{content_md5}\n"
        f"content-type:application/xml\n"
        f"host:{host}\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = 'content-md5;content-type;host;x-amz-content-sha256;x-amz-date'

    canonical_request = (
        f"PUT\n"
        f"{canonical_uri}\n"
        f"{canonical_querystring}\n"
        f"{canonical_headers}\n"
        f"{signed_headers}\n"
        f"{payload_hash}"
    )

    algorithm = 'AWS4-HMAC-SHA256'
    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    string_to_sign = (
        f"{algorithm}\n"
        f"{amz_date}\n"
        f"{credential_scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    signing_key = get_signature_key(secret_key, date_stamp, region, 's3')
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

    auth_header = (
        f"{algorithm} "
        f"Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )

    headers = {
        'Host': host,
        'Content-Type': 'application/xml',
        'Content-MD5': content_md5,
        'x-amz-date': amz_date,
        'x-amz-content-sha256': payload_hash,
        'Authorization': auth_header,
        'Content-Length': str(len(CORS_XML))
    }

    req = urllib.request.Request(endpoint, data=CORS_XML, headers=headers, method='PUT')
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  ✓ {bucket_name}: SUCCESS (HTTP {resp.status})")
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        print(f"  ✗ {bucket_name}: FAILED (HTTP {e.code}) - {error_body}")
        return False
    except Exception as e:
        print(f"  ✗ {bucket_name}: ERROR - {e}")
        return False

def main():
    env = load_env()
    access_key = env.get('AWS_ACCESS_KEY') or env.get('AWS_ACCESS_KEY_ID')
    secret_key = env.get('AWS_SECRET_KEY') or env.get('AWS_SECRET_ACCESS_KEY')
    region = env.get('AWS_REGION', 'eu-north-1')

    if not access_key or not secret_key:
        print("ERROR: AWS_ACCESS_KEY or AWS_SECRET_KEY not found in .env")
        sys.exit(1)

    buckets = [
        env.get('AWS_S3_CHAT_BUCKET', env.get('AWS_CHAT_BUCKET', 'planora-prod-chat-attachments-657347292859-eu-north-1-an')),
        env.get('AWS_S3_DMS_BUCKET', env.get('AWS_DMS_BUCKET', 'planora-prod-dms-documents')),
        env.get('AWS_S3_PROFILE_BUCKET', env.get('AWS_PROFILE_PHOTOS_BUCKET', 'planora-prod-profile-photos-657347292859-eu-north-1-an')),
        env.get('AWS_S3_TASK_BUCKET', env.get('AWS_TASK_STORAGE_BUCKET', 'planora-prod-task-attachments-657347292859-eu-north-1-an'))
    ]

    print("==================================================")
    print("Applying S3 CORS to Planora Buckets via AWS SigV4")
    print(f"Region: {region}")
    print("==================================================")

    success_count = 0
    for b in buckets:
        if b:
            if apply_cors_to_bucket(b, access_key, secret_key, region):
                success_count += 1

    print("==================================================")
    print(f"Completed: {success_count}/{len(buckets)} buckets updated.")

if __name__ == '__main__':
    main()
