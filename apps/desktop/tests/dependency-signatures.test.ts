import path from 'node:path';
import { createRequire } from 'node:module';
import { generateKeyPairSync } from 'node:crypto';

const loadModule = createRequire(path.join(__dirname, '../../backend/package.json'));
const forge = loadModule('node-forge');
const nativeKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
const keys = {
  privateKey: forge.pki.privateKeyFromPem(nativeKeys.privateKey),
  publicKey: forge.pki.publicKeyFromPem(nativeKeys.publicKey),
};
const digest = forge.md.sha256.create().update('example').digest().getBytes();

function signature(extraFields: number, withParameters = true): string {
  const { asn1, util, pki, jsbn } = forge;
  const fields = [
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.OID,
      false,
      asn1.oidToDer(pki.oids.sha256).getBytes()
    ),
  ];
  if (withParameters) {
    fields.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''));
  }
  for (let i = 0; i < extraFields; i++) {
    fields.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, 'example'));
  }
  const record = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, fields),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest),
  ]);
  const content = asn1.toDer(record).getBytes();
  const length = Math.ceil(keys.publicKey.n.bitLength() / 8);
  const encoded = `0001${'ff'.repeat(length - content.length - 3)}00${util.bytesToHex(content)}`;
  const value = new jsbn.BigInteger(encoded, 16);
  const signed = value.modPow(keys.privateKey.d, keys.privateKey.n).toString(16);
  return util.hexToBytes(signed.padStart(length * 2, '0'));
}

describe('dependency signature validation', () => {
  test.each([1, 2])('rejects a record with %i unexpected fields', (extraFields) => {
    expect(() => keys.publicKey.verify(digest, signature(extraFields))).toThrow('DigestInfo');
  });

  test.each([true, false])('accepts an ordinary record (parameters=%s)', (withParameters) => {
    expect(keys.publicKey.verify(digest, signature(0, withParameters))).toBe(true);
  });
});
