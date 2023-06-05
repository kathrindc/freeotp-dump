"use client";

import { useCallback, useState } from "react";
import { type DropEvent, useDropzone } from "react-dropzone";
import { type MFARawCollection, type MFAToken, loadCollection, decrypt } from "~/utils/file-util";
import QRCode from "react-qr-code";

interface AreaState {
    rawCollection?: MFARawCollection;
    passphrase: string;
    error?: Error;
    stage: number;
    tokens: MFAToken[];
}

const DefaultState: AreaState = {
    passphrase: '',
    stage: 0,
    tokens: [],
};

const toUri = (token: MFAToken) => {
    const params = new URLSearchParams({ });

    params.set("secret", token.key);
    params.set("issuer", token.issuerInt || token.issuerExt);

    return 'otpauth://totp/' + encodeURIComponent(token.label) + '?' + params.toString();
};

export const InteractiveArea = () => {
    const [state, setState] = useState<AreaState>(DefaultState);

    const onDrop = useCallback(async (accepted: File[], _event: DropEvent) => {
        for (let file of accepted) {
            const rawCollection = await loadCollection(file);

            setState((state: AreaState) => ({ ...state, rawCollection, stage: 1 }));
        }
    }, []);

    const onClickDecrypt = useCallback(async () => {
        if (!state.rawCollection || !state.passphrase) {
            return;
        }

        try {
            const tokens = await decrypt(state.rawCollection, state.passphrase);
    
            setState((state: AreaState) => ({ ...state, tokens, stage: 2 }));
        } catch (error) {
            console.error(error);
        }
    }, [state]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDropAccepted: onDrop,
        multiple: false,
        accept: {
            "application/xml": [".xml"]
        }
    });

    if (state.stage < 0 || state.stage > 2) {
        setState(DefaultState);
    }

    return (
        <div {...getRootProps()} className={`w-full text-center flex-grow flex flex-col items-center justify-center ${state.rawCollection ? "" : "cursor-pointer"}`}>
            {state.stage == 0 ? (
                <>
                    <input {...getInputProps()} />
                    <p className="text-xl">{isDragActive ? 'Drop' : 'Drag'} your FreeOTP export here, or click to select the file.</p>
                </>
            ) : <></>}
            {state.stage == 1 ? (
                <>
                    <p className="mb-2">We need your passphrase to decrypt your tokens:</p>
                    <input type="password" className="border-emerald-600 border rounded p-2 mb-3" placeholder="Passphrase" onChange={event => setState((state) => ({ ...state, passphrase: event.target.value }))} value={state.passphrase} />
                    <button type="button" className="bg-emerald-600 text-white font-bold px-3 py-1.5 hover:bg-emerald-500 rounded transition-all" onClick={onClickDecrypt}>Decrypt</button>
                </>
            ) : <></>}
            {state.stage == 2 ? (
                <>
                    <h2 className="text-2xl text-emerald-600 mb-1">There you go.</h2>
                    {state.tokens ? (
                        <>
                            <p className="mb-4">Converted {state.tokens.length} tokens.</p>
                            {state.tokens.map((token, index) => (
                                <div key={'token-qr-' + index} className="mb-3">
                                    <p className="text-l mb-1">{token.label}</p>
                                    <QRCode value={toUri(token)} />
                                </div>
                            ))}
                        </>
                    ) : <></>}
                </>
            ) : <></>}
        </div>
    );
};
