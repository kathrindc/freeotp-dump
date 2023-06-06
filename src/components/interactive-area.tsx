"use client";

import { useCallback, useState } from "react";
import { type DropEvent, useDropzone } from "react-dropzone";
import {
  type MFARawCollection,
  type MFAToken,
  loadCollection,
  decrypt,
} from "~/utils/file-util";
import QRCode from "react-qr-code";

interface AreaState {
  rawCollection?: MFARawCollection;
  passphrase: string;
  error?: Error;
  stage: number;
  tokens: MFAToken[];
}

const DefaultState: AreaState = {
  passphrase: "",
  stage: 0,
  tokens: [],
};

const toUri = (token: MFAToken) => {
  const params = new URLSearchParams({});

  params.set("secret", token.key);
  params.set("issuer", token.issuerInt || token.issuerExt);

  return (
    "otpauth://totp/" +
    encodeURIComponent(token.label) +
    "?" +
    params.toString()
  );
};

export const InteractiveArea = () => {
  const [state, setState] = useState<AreaState>(DefaultState);

  const onDrop = useCallback((accepted: File[], _event: DropEvent) => {
    if (!accepted[0]) {
      return;
    }

    loadCollection(accepted[0])
      .then((rawCollection: MFARawCollection) => {
        console.log("Export file parsed successfully.");

        setState((state: AreaState) => ({ ...state, rawCollection, stage: 1 }));
      })
      .catch((error: Error) => {
        console.error(`Parsing failed: ${error.message}`);
      });
  }, []);

  const onClickDecrypt = useCallback(() => {
    if (!state.rawCollection || !state.passphrase) {
      return;
    }

    decrypt(state.rawCollection, state.passphrase)
      .then((tokens: MFAToken[]) => {
        console.log("Tokens decrypted succesfully");

        setState((state: AreaState) => ({ ...state, tokens, stage: 2 }));
      })
      .catch((error: Error) => {
        console.error(error);
      });
  }, [state]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: onDrop,
    multiple: false,
    accept: {
      "application/xml": [".xml"],
    },
  });

  if (state.stage < 0 || state.stage > 2) {
    setState(DefaultState);
  }

  return (
    <div
      {...getRootProps()}
      className={`flex w-full flex-grow flex-col items-center justify-center text-center ${
        state.rawCollection ? "" : "cursor-pointer"
      }`}
    >
      {state.stage == 0 ? (
        <>
          <input {...getInputProps()} />
          <p className="text-xl">
            {isDragActive ? "Drop" : "Drag"} your FreeOTP export here, or click
            to select the file.
          </p>
          <p className="text-gray-400">
            All the work is done locally on your device to keep your tokens
            safe.
          </p>
        </>
      ) : (
        <></>
      )}
      {state.stage == 1 ? (
        <>
          <p className="mb-2">
            We need your passphrase to decrypt your tokens:
          </p>
          <input
            type="password"
            className="mb-3 rounded border border-emerald-600 p-2"
            placeholder="Passphrase"
            onChange={(event) =>
              setState((state) => ({
                ...state,
                passphrase: event.target.value,
              }))
            }
            value={state.passphrase}
          />
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1.5 font-bold text-white transition-all hover:bg-emerald-500"
            onClick={onClickDecrypt}
          >
            Decrypt
          </button>
        </>
      ) : (
        <></>
      )}
      {state.stage == 2 ? (
        <>
          <h2 className="mb-1 text-2xl text-emerald-600">There you go.</h2>
          {state.tokens ? (
            <>
              <p className="mb-4">Converted {state.tokens.length} tokens.</p>
              {state.tokens.map((token, index) => (
                <div key={`token-qr-${index}`} className="mb-3">
                  <p className="text-l mb-1">{token.label}</p>
                  <QRCode value={toUri(token)} fgColor="#047857" />
                </div>
              ))}
            </>
          ) : (
            <></>
          )}
        </>
      ) : (
        <></>
      )}
    </div>
  );
};
