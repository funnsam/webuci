import * as uwasi from "https://cdn.jsdelivr.net/npm/uwasi@1.4.1/+esm";

let input = ["go"];

const wasi = new uwasi.WASI({
    args: ["./engine"],
    features: [
        uwasi.useArgs,
        uwasi.useClock,
        uwasi.useRandom,
        uwasi.useProc,
        uwasi.useStdio({
            stdin: () => {
                return input.shift() || "\n";
            },
            stdout: (str) => {
                postMessage({
                    type: "stdout",
                    content: str,
                });
            },
            stderr: (str) => {
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

const engine = WebAssembly.instantiateStreaming(fetch("random.wasm"), imports);

onmessage = e => {
    console.log(e.data);

    if (e.data == "__internal start") {
        engine.then(engine => {
            const exitCode = wasi.start(engine.instance);
            postMessage({
                type: "debug",
                content: `(webuci): engine exited with exit code ${exitCode}\n`,
            });
        });
    } else {
        input.push(e.data);
    }
};
