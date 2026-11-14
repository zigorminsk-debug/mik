#!/usr/bin/env python3
"""Генерация постоянного ключа подписи Android-приложения.

Ключ — PKCS12 (поддерживается apksigner/AGP), RSA-2048, срок 100 лет.
Результат кладём в android/keystore/mik-release.p12 и .b64 (оба вне git),
пароль и base64 храним в секретах GitHub-репозитория.
"""
import base64, datetime, os, secrets, string, sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "android", "keystore")
P12 = os.path.join(OUT_DIR, "mik-release.p12")
P12_B64 = os.path.join(OUT_DIR, "mik-release.p12.b64")
ALIAS = "mikacademy"


def random_password(n=28):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    password = random_password()
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "BY"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "MikroTik Academy"),
        x509.NameAttribute(NameOID.COMMON_NAME, "MikroTik Academy Release"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=36500))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False,
                          data_encipherment=False, key_agreement=False, key_cert_sign=True,
                          crl_sign=True, encipher_only=False, decipher_only=False),
            critical=True,
        )
        .sign(key, hashes.SHA256())
    )

    bundle = pkcs12.serialize_key_and_certificates(
        name=ALIAS.encode(),
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(password.encode()),
    )
    with open(P12, "wb") as fh:
        fh.write(bundle)
    os.chmod(P12, 0o600)

    with open(P12, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode()
    with open(P12_B64, "w") as fh:
        fh.write(b64)

    creds = os.path.join(ROOT, ".secrets", "keystore.txt")
    os.makedirs(os.path.dirname(creds), exist_ok=True)
    with open(creds, "w") as fh:
        fh.write(f"alias={ALIAS}\n")
        fh.write(f"password={password}\n")
        fh.write(f"file={os.path.relpath(P12, ROOT)}\n")
        fh.write(f"base64_file={os.path.relpath(P12_B64, ROOT)}\n")
    os.chmod(creds, 0o600)

    print(f"Ключ создан: {os.path.relpath(P12, ROOT)}")
    print(f"base64:      {os.path.relpath(P12_B64, ROOT)} ({len(b64)} символов)")
    print(f"alias:       {ALIAS}")
    print(f"пароль:      {password}")
    print(f"реквизиты:   {os.path.relpath(creds, ROOT)} (вне git)")


if __name__ == "__main__":
    main()
