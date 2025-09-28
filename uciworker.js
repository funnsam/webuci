import * as uwasi from "https://cdn.jsdelivr.net/npm/uwasi@1.4.1/+esm";

let input, inputLen, end = false;

const wasi = new uwasi.WASI({
    args: ["./engine"],
    features: [
        uwasi.useArgs,
        uwasi.useClock,
        uwasi.useRandom,
        uwasi.useProc,
        uwasi.useStdio({
            stdin: () => {
                if (Atomics.load(inputLen, 0) === 0 && end) {
                    end = false;
                    return "";
                }

                while (Atomics.load(inputLen, 0) === 0) {
                    Atomics.wait(inputLen, 0, 0);
                }

                const len = Atomics.load(inputLen, 0);
                const slice = input.slice(0, len);

                end = true;
                Atomics.store(inputLen, 0, 0);
                return slice;
            },
            stdout: str => {
                postMessage({
                    type: "stdout",
                    content: str,
                });
            },
            stderr: str => {
                postMessage({
                    type: "debug",
                    content: str,
                });
            }
        }),
    ],
});

const imports = {
    wasi_snapshot_preview1: wasi.wasiImport
};

onmessage = e => {
    input = new Uint8Array(e.data.input);
    inputLen = new Int32Array(e.data.inputLen);

    const engine = WebAssembly.instantiateStreaming(fetch(e.data.engineUrl), imports);

    engine.then(engine => {
        const exitCode = wasi.start(engine.instance);
        postMessage({
            type: "debug",
            content: `\n(webuci): engine exited with exit code ${exitCode}\n`,
        });
    });
};
