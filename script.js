import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

import { Chessboard, INPUT_EVENT_TYPE } from "https://cdn.jsdelivr.net/npm/cm-chessboard@8.10.1/+esm";
import { Markers, MARKER_TYPE } from "https://cdn.jsdelivr.net/npm/cm-chessboard@8.10.1/src/extensions/markers/Markers.js";
import { PromotionDialog } from "https://cdn.jsdelivr.net/npm/cm-chessboard@8.10.1/src/extensions/promotion-dialog/PromotionDialog.js";
import { RightClickAnnotator } from "https://cdn.jsdelivr.net/npm/cm-chessboard@8.10.1/src/extensions/right-click-annotator/RightClickAnnotator.js";

const uciWorker = new Worker("uciworker.js", { type: "module" });
let uciInput = new SharedArrayBuffer(4096);
let uciInLen = new SharedArrayBuffer(4);
let uciOutput = "";
let thinking = false;

function writeUci(inp) {
    debugMsg.innerText += inp;

    const encoder = new TextEncoder();
    const utf8 = encoder.encode(inp);

    let uI = new Uint8Array(uciInput);
    let uL = new Int32Array(uciInLen);

    while (Atomics.load(uL, 0)) if (Atomics.pause) Atomics.pause();

    uI.set(utf8, 0);
    Atomics.store(uL, 0, utf8.length);
    Atomics.notify(uL, 0, 1);
}

let board;
let chess = new Chess();
let botColor, playerColor;

function inputHandler(event) {
    if (event.type === INPUT_EVENT_TYPE.movingOverSquare) return;

    if (event.type !== INPUT_EVENT_TYPE.moveInputFinished) {
        board.removeLegalMovesMarkers();
    }

    switch (event.type) {
        case INPUT_EVENT_TYPE.moveInputStarted:
            if (event.piece.charAt(0) !== playerColor) return false;

            board.removeArrows();
            board.removeMarkers();

            const moves = chess.moves({ square: event.squareFrom, verbose: true });
            board.addLegalMovesMarkers(moves);
            return moves.length > 0;

        case INPUT_EVENT_TYPE.moveInputStarted:
            board.removeArrows()
            board.removeMarkers()
            return;

        case INPUT_EVENT_TYPE.validateMoveInput:
            try {
                const toRank = event.squareTo.charAt(1);

                if ((toRank === "1" || toRank === "8") && event.piece.charAt(1) === "p") {
                    board.showPromotionDialog(event.squareTo, playerColor, r => {
                        if (r && r.piece) {
                            makeMove({
                                from: event.squareFrom,
                                to: event.squareTo,
                                promotion: r.piece.charAt(1),
                            });
                        } else {
                            board.setPosition(chess.fen(), true);
                        }
                    });
                } else {
                    makeMove({
                        from: event.squareFrom,
                        to: event.squareTo,
                        promotion: event.promotion,
                    });
                }

                return true;
            } catch {
                return false;
            }
    }
}

function makeMove(move) {
    chess.move(move);
    board.removeMarkers(MARKER_TYPE.circleDangerFilled);

    if (chess.isGameOver()) {
        message.innerText =
            chess.isCheckmate() ? "checkmate" :
            chess.isDrawByFiftyMoves() ? "50-move rule draw" :
            chess.isInsufficientMaterial() ? "draw by insufficient material" :
            chess.isStalemate() ? "stalemate" :
            "three-fold repetition draw";
    }

    board.state.moveInputProcess.then(() => {
        board.setPosition(chess.fen(), true);
    });

    if (chess.inCheck()) {
        board.addMarker(
            MARKER_TYPE.circleDangerFilled,
            chess.findPiece({ type: "k", color: chess.turn() })[0],
        );
    }

    if (chess.turn() == botColor) botThink();
}

function botThink() {
    writeUci(`\
position startpos moves ${chess.history({ verbose: true }).map(e => e.lan).join(" ")}\n\
go movetime ${movetime.value * 1000}\n`);
    thinking = true;
}

function restartGame(color) {
    botColor = color == "white" ? "b" : "w";
    playerColor = color == "white" ? "w" : "b";

    chess.reset();
    chess.setHeader(botColor == "w" ? "White" : "Black", "Bot");
    if (debugCollapse.open) chess.setHeader("Cheated", "yes");

    board.setPosition(chess.fen(), true);
    board.setOrientation(playerColor);

    if (chess.turn() == botColor) botThink();
}

function handleUciOut() {
    const lines = uciOutput.split(/\n+/);
    lines.forEach((line, i) => {
        if (i + 1 == lines.length) {
            uciOutput = line;
            return;
        }

        const tokens = line.split(/\s+/);
        console.log(tokens);

        tokens.forEach((cmd, j) => {
            switch (cmd) {
                case "bestmove": {
                    if (chess.turn() == botColor) {
                        makeMove(tokens[j + 1]);
                        thinking = false;
                    }
                    return;
                }
                case "id": {
                    if (tokens[j + 1] == "name") {
                        chess.setHeader(botColor == "w" ? "White" : "Black", tokens.slice(j + 2).join(" "));
                    }
                    return;
                }
                case "info": {
                    let score, depth, nodes;
                    for (let k = j + 1; k < tokens.length; k++) {
                        switch (tokens[k]) {
                            case "score": {
                                let value = tokens[k + 2] * (botColor == "w" ? 1 : -1);
                                score = (tokens[++k] == "cp") ? `${(value > 0 ? '+' : '') + (value / 100).toFixed(2)}` : `#${value}`;

                                k++;
                                break;
                            }
                            case "depth": {
                                depth = tokens[++k];
                                break;
                            }
                            case "nodes": {
                                nodes = tokens[++k];
                                break;
                            }
                        }
                    }

                    evalScore.innerText = score;
                    evalMsg.innerText = `Depth: ${depth} (${nodes} nodes)`;
                    return;
                }
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", function() {
    board = new Chessboard(chessboard, {
        position: chess.fen(),
        assetsUrl: "https://cdn.jsdelivr.net/npm/cm-chessboard@8.10.1/assets/",
        extensions: [
            {class: Markers},
            {class: PromotionDialog},
            {class: RightClickAnnotator},
        ],
    });
    board.enableMoveInput(inputHandler);

    restartGame("white");

    startW.onclick = () => !thinking ? restartGame("white") : 0;
    startB.onclick = () => !thinking ? restartGame("black") : 0;

    exportBtn.onclick = () => {
        message.innerText = `PGN:\n${chess.pgn()}\n\n`;
    };
    uploadBtn.onclick = () => {
        message.innerText = `Exporting...\n`;

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
    debugCollapse.ontoggle = () => {
        chess.setHeader("Cheated", "yes");
    };

    uciWorker.onmessage = e => {
        debugMsg.innerText += e.data.content;

        if (e.data.type == "stdout") {
            uciOutput += e.data.content;
            handleUciOut();
        }
    };
    uciWorker.postMessage({
        input: uciInput,
        inputLen: uciInLen,
        engineUrl: location.hash.slice(1),
    });
    writeUci("uci\nisready\n");
});
