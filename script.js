const uciWorker = new Worker("uciworker.js", { type: "module" });

const config = {
    draggable: true,
    position: "start",
    onDragStart,
    onDrop,
};

let board;
let position = new Chess();

function isWhitePiece (piece) { return /^w/.test(piece) }
function isBlackPiece (piece) { return /^b/.test(piece) }

function onDragStart(dragStartEvt) {
    if (position.game_over()) return false;

    if (position.turn() === 'w' && !isWhitePiece(dragStartEvt.piece)) return false;
    if (position.turn() === 'b' && !isBlackPiece(dragStartEvt.piece)) return false;

    const legalMoves = position.moves({
        square: dragStartEvt.square,
        verbose: true,
    });

    legalMoves.forEach((move) => board.addCircle(move.to));
}

function onDrop(dropEvt) {
    const move = position.move({
        from: dropEvt.source,
        to: dropEvt.target,
        promotion: "q",
    });

    board.clearCircles();

    if (move) {
        board.fen(position.fen(), () => {});
    } else {
        return "snapback";
    }
}

function restartGame(color) {
    position.reset();
    board.position(position.fen(), true);
    board.orientation(color);
}

document.addEventListener("DOMContentLoaded", function() {
    board = Chessboard2("chessboard", config);

    startW.onclick = () => restartGame("white");
    startB.onclick = () => restartGame("black");

    exportBtn.onclick = () => {
        message.innerText += `${position.pgn()}\n`;
    };
    uploadBtn.onclick = () => {
        message.innerText += `Exporting...\n`;

        fetch("https://dpaste.com/aspi/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "content=" + encodeURIComponent(position.pgn()),
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
        switch (e.data.type) {
            case "stdout":
            case "debug":
                debugMsg.innerText += e.data.content;
                break;
        }
    };
    uciWorker.postMessage("__internal start");
});
