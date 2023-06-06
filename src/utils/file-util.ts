import { JavaReader } from "./java";
import base32Encode from "base32-encode";

export interface EncryptedKey {
  mCipher: string;
  mCipherText: number[];
  mParameters: number[];
  mToken: string;
}

export interface MFARawToken {
  id: string;
  issuerExt: string;
  issuerInt: string;
  label: string;
  type: "TOTP";
  key: EncryptedKey;
}

export interface MFAMasterKey {
  mAlgorithm: string;
  mEncryptedKey: EncryptedKey;
  mIterations: number;
  mSalt: number[];
}

export interface MFARawCollection {
  master: MFAMasterKey;
  tokens: MFARawToken[];
}

export interface MFAToken {
  id: string;
  issuerExt: string;
  issuerInt: string;
  label: string;
  type: "TOTP";
  key: string;
}

const read = (file: File) => {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();

    reader.onabort = () => reject(new Error("FileReader aborted"));
    reader.onerror = () => reject(new Error("FileReader encountered an error"));

    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;

      resolve(buffer);
    };

    reader.readAsArrayBuffer(file);
  });
};

const explode = (buffer: ArrayBuffer) => {
  const map = new JavaReader(buffer).collect();
  const uuidFormat =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const collection: MFARawCollection = {
    master: map["masterKey"] as MFAMasterKey,
    tokens: [],
  };
  const ids = Object.keys(map).filter((key) => key.match(uuidFormat));

  for (const id of ids) {
    const keyObject = map[id] as { key: string };

    if (!keyObject || !keyObject.key) {
      throw new Error(`No key present for token "${id}"`);
    }

    const key = JSON.parse(keyObject.key) as EncryptedKey;
    const token = { ...map[`${id}-token`], key } as MFARawToken;

    collection.tokens.push(token);
  }

  return collection;
};

const getPassKey = async (
  passphrase: string,
  saltArray: number[],
  iterations: number,
  hashAlgo: AlgorithmIdentifier
) => {
  const salt = new Int8Array(saltArray);
  const pbkdf2: Pbkdf2Params = {
    name: "PBKDF2",
    hash: hashAlgo,
    salt: salt,
    iterations: iterations,
  };
  const passBuffer = new TextEncoder().encode(passphrase);
  const passCrypt = await crypto.subtle.importKey(
    "raw",
    passBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const passKeyBytes = await crypto.subtle.deriveBits(
    pbkdf2,
    passCrypt,
    saltArray.length * 8
  );
  const aesGcm: AesGcmParams = {
    name: "AES-GCM",
    iv: new ArrayBuffer(12),
  };

  return await crypto.subtle.importKey("raw", passKeyBytes, aesGcm, false, [
    "decrypt",
  ]);
};

const getMasterKey = async (master: MFAMasterKey, passphrase: string) => {
  const ivView = new Uint8Array(master.mEncryptedKey.mParameters.slice(4, 16));
  const passKey = await getPassKey(
    passphrase,
    master.mSalt,
    master.mIterations,
    "SHA-512"
  );
  const tokenBuffer = new TextEncoder().encode(master.mEncryptedKey.mToken);
  const encryptedData = new Uint8Array(master.mEncryptedKey.mCipherText);
  const masterAesGcm: AesGcmParams = {
    name: "AES-GCM",
    iv: ivView,
    additionalData: tokenBuffer,
  };
  const masterKeyBytes = await crypto.subtle.decrypt(
    masterAesGcm,
    passKey,
    encryptedData
  );
  const importAesGcm: AesGcmParams = {
    name: "AES-GCM",
    iv: new ArrayBuffer(12),
  };

  return await crypto.subtle.importKey(
    "raw",
    masterKeyBytes,
    importAesGcm,
    false,
    ["decrypt"]
  );
};

export const decrypt = async (raw: MFARawCollection, passphrase: string) => {
  const tokens: MFAToken[] = [];
  const masterKey = await getMasterKey(raw.master, passphrase);

  for (const rawToken of raw.tokens) {
    const tokenBuffer = new TextEncoder().encode(rawToken.key.mToken);
    const ivView = new Uint8Array(rawToken.key.mParameters.slice(4, 16));
    const aesGcm: AesGcmParams = {
      name: "AES-GCM",
      iv: ivView,
      additionalData: tokenBuffer,
    };
    const encryptedBuffer = new Uint8Array(rawToken.key.mCipherText);
    const keyData = await crypto.subtle.decrypt(
      aesGcm,
      masterKey,
      encryptedBuffer
    );
    const result: MFAToken = {
      id: rawToken.id,
      issuerExt: rawToken.issuerExt,
      issuerInt: rawToken.issuerInt,
      label: rawToken.label,
      type: rawToken.type,
      key: base32Encode(keyData, "RFC3548", { padding: false }),
    };

    tokens.push(result);
  }

  return tokens;
};

export const loadCollection = async (file: File) => {
  const buffer = await read(file);

  return explode(buffer);
};
