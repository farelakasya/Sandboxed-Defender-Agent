/**
 * SERVER-ONLY. Never import this from a client component.
 *
 * Signs a POST request to an AWS Lambda Function URL with SigV4 and sends it.
 * The Lambda Function URL uses AWS_IAM auth, so every request must be signed
 * with backend-only AWS credentials — which is exactly why this lives on the
 * server and the browser only ever talks to /api/redteam/scan.
 *
 * Deps: @smithy/signature-v4 @smithy/protocol-http
 *       @aws-sdk/credential-provider-node @aws-crypto/sha256-js
 */
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Sha256 } from "@aws-crypto/sha256-js";

export async function signAndSendLambdaFunctionUrl(input: {
  url: string;
  region: string;
  body: unknown;
  timeoutMs?: number;
}): Promise<Response> {
  const { url, region, body, timeoutMs = 300_000 } = input;
  const u = new URL(url);
  const payload = JSON.stringify(body ?? {});

  const signer = new SignatureV4({
    service: "lambda", // Function URLs are signed as the "lambda" service
    region,
    // Reads AWS_ACCESS_KEY_ID / SECRET_ACCESS_KEY / SESSION_TOKEN from the
    // server env (and other standard provider sources). Never logged.
    credentials: defaultProvider(),
    sha256: Sha256,
  });

  const request = new HttpRequest({
    protocol: u.protocol,
    hostname: u.hostname,
    path: u.pathname || "/",
    method: "POST",
    headers: {
      host: u.hostname, // required for a valid SigV4 signature
      "content-type": "application/json",
    },
    body: payload,
  });

  const signed = await signer.sign(request);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: signed.headers as Record<string, string>,
      body: payload,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
