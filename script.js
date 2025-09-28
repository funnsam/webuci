const uciWorker = new Worker("uciworker.js", { type: "module" });
let uciInput = new SharedArrayBuffer(4096);
let uciInLen = new SharedArrayBuffer(4);

function writeUci(inp) {
    const encoder = new TextEncoder();
    const utf8 = encoder.encode(inp);

    let uI = new Uint8Array(uciInput);
    let uL = new Int32Array(uciInLen);

    while (Atomics.load(uL, 0)) if (Atomics.pause) Atomics.pause();

    uI.set(utf8, 0);
    Atomics.store(uL, 0, utf8.length);
    console.log(Atomics.notify(uL, 0, 1));
}

const config = {
    draggable: true,
    position: "start",
    onDragStart,
    onDrop,
};

let board;
let chess = new Chess();

function isWhitePiece (piece) { return /^w/.test(piece) }
function isBlackPiece (piece) { return /^b/.test(piece) }

function onDragStart(dragStartEvt) {
    if (chess.game_over()) return false;

    if (chess.turn() === 'w' && !isWhitePiece(dragStartEvt.piece)) return false;
    if (chess.turn() === 'b' && !isBlackPiece(dragStartEvt.piece)) return false;

    const legalMoves = chess.moves({
        square: dragStartEvt.square,
        verbose: true,
    });

    legalMoves.forEach((move) => board.addCircle(move.to));
}

function onDrop(dropEvt) {
    const move = chess.move({
        from: dropEvt.source,
        to: dropEvt.target,
        promotion: "q",
    });

    board.clearCircles();

    if (move) {
        board.fen(chess.fen(), () => {});
        writeUci("go\n");
    } else {
        return "snapback";
    }
}

function restartGame(color) {
    chess.reset();
    // chess.setHeader(color == "white" ? "Black" : "White", "Bot");

    board.position(chess.fen(), true);
    board.orientation(color);
}

document.addEventListener("DOMContentLoaded", function() {
    board = Chessboard2("chessboard", config);

    startW.onclick = () => restartGame("white");
    startB.onclick = () => restartGame("black");

    exportBtn.onclick = () => {
        message.innerText += `PGN:\n${chess.pgn()}\n`;
    };
    uploadBtn.onclick = () => {
        message.innerText += `Exporting...\n`;

        fetch("https://dpaste.com/api/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "content=" + encodeURIComponent(chess.pgn()),
        })
            .then(resp => {
                if (!resp.ok) throw `POST response ${resp.status}`;
                return resp.text();
            })
            .then(text => {
                message.innerText += `Export link: ${text.trim()}\n`;
            })
            .catch(e => message.innerText += `Export failed: ${e}\n`);
    };

    uciWorker.onmessage = e => {
        console.log(e.data);
        switch (e.data.type) {
            case "stdout":
            case "debug":
                debugMsg.innerText += e.data.content;
                break;
        }
    };
    uciWorker.postMessage({
        input: uciInput,
        inputLen: uciInLen,
    });
    writeUci("go\n");
});
