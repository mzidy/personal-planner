Test certificates for the Alexa request check (`tests/unit/alexa.test.ts`),
made with OpenSSL for these tests only and valid until October 2036:

- `root.pem`: a self-signed root, used as the only trust anchor.
- `chain.pem`: a leaf for `echo-api.amazon.com` and the intermediate that signed
  it, in the order Amazon serves its chain.
- `wrong-host-chain.pem`: the same chain with a leaf for `example.com`.
- `other-root.pem`: an unrelated root, to show a chain that ends nowhere.
- `body.json` / `body.sig`: a request body and its RSA-SHA256 signature by the
  `chain.pem` leaf, base64, as Alexa sends it in `Signature-256`.

The private keys were thrown away after signing; nothing here can sign anew.

`amazon-echo-api-cert-12.pem` is Amazon's own published signing chain
(https://s3.amazonaws.com/echo.api/echo-api-cert-12.pem), whose leaf expired in
December 2023. It shows the real chain anchors in Node's root list.
