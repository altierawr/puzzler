import type { Key } from "@lichess-org/chessground/types";
import { makeFen } from "chessops/fen";
import type { NormalMove } from "chessops/types";
import { parseSquare } from "chessops/util";

import { isPromotion } from "@/utils/chess";
import type { Puzzle } from "@/types";

import { BasePuzzleBoard } from "./base";

type TablebaseMove = {
  uci: string;
  san: string;
  checkmate: boolean;
  stalemate: boolean;
  category: "win" | "draw" | "loss";
};

type TablebaseResponse = {
  category: "win" | "draw" | "loss";
  moves: TablebaseMove[];
};

export class TablebasePuzzleBoard extends BasePuzzleBoard {
  private currentTablebaseData: TablebaseResponse | null = null;


  async loadPuzzle(puzzle: Puzzle, rootElement?: HTMLDivElement) {
    this.puzzleState = "findmove";
    this.isInVariation = false;
    this.isInWinningUserVariation = false;
    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
      this.moveTimeout = null;
    }

    this.initGround(rootElement, puzzle.fen);

    await this.fetchTablebase(puzzle.fen);
  }

  private async fetchTablebase(fen: string) {
    try {
      const resp = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`);
      if (resp.ok) {
        this.currentTablebaseData = await resp.json();
      } else {
        console.error("Failed to fetch tablebase data");
      }
    } catch (e) {
      console.error("Error fetching tablebase", e);
    }
  }

  showHint() {
    if (
      this.position.turn !== this.playerSide ||
      this.puzzleState !== "findmove" ||
      !this.currentTablebaseData ||
      this.currentTablebaseData.moves.length === 0
    ) {
      return;
    }

    const bestMove = this.currentTablebaseData.moves[0];
    const fromStr = bestMove.uci.substring(0, 2);
    
    this.ground.set({
      drawable: {
        shapes: [{ orig: fromStr as Key, brush: "green" }],
      },
    });
  }

  returnFromVariation() {
    // Variations are not supported in Tablebase mode
  }

  returnFromGoodOrBadMove() {
    // Good/Bad moves logic is not fully used in tablebase mode, but if wrong we just undo.
    this.position = this.startPos.clone();
    this.puzzleState = "findmove";
    this.updateGround();
    // We would need to replay history if we wanted to support undoing a deep tablebase puzzle, 
    // but typically failing a puzzle resets it. For now, reset to start.
    this.fetchTablebase(makeFen(this.position.toSetup()));
  }

  async handleBoardMove(orig: Key, dest: Key) {
    this.ground.cancelPremove();

    if (!this.currentTablebaseData) {
      this.updateGround();
      return;
    }

    const move: NormalMove = {
      from: parseSquare(orig)!,
      to: parseSquare(dest)!,
    };

    let isPromo = isPromotion(this.position, move);
    let uci = orig + dest;

    if (isPromo) {
      move.promotion = "queen";
      uci += "q";
    }

    const tbMove = this.currentTablebaseData.moves.find((m) => m.uci === uci);
    const revertPos = this.position.clone();
    this.playMove(move);

    if (!tbMove) {
      this.puzzleState = "wrong";
      this.handleWrongMove(revertPos);
      return;
    }

    const isLosing = tbMove.category === "win"; // Opponent wins = we lose
    const isDrawingWhenWinAvailable = this.currentTablebaseData.category === "win" && tbMove.category === "draw";

    if (isLosing || isDrawingWhenWinAvailable) {
      this.puzzleState = "wrong";
      this.handleWrongMove(revertPos);
      return;
    }

    // Move is correct
    this.puzzleState = "correct";

    if (this.isSolved(tbMove)) {
      this.puzzleState = "solved";
      return;
    }

    // Opponent's turn
    const newFen = makeFen(this.position.toSetup());
    const opponentResp = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(newFen)}`);
    if (!opponentResp.ok) {
      console.error("Failed to fetch opponent tablebase move");
      return;
    }

    const opponentData: TablebaseResponse = await opponentResp.json();
    if (opponentData.moves.length === 0) {
      this.puzzleState = "solved";
      return;
    }

    const bestOpponentMove = opponentData.moves[0];
    const oppOrig = bestOpponentMove.uci.substring(0, 2);
    const oppDest = bestOpponentMove.uci.substring(2, 4);
    const oppPromo = bestOpponentMove.uci.length > 4 ? bestOpponentMove.uci.substring(4, 5) : undefined;

    const oppMove: NormalMove = {
      from: parseSquare(oppOrig as Key)!,
      to: parseSquare(oppDest as Key)!,
    };

    if (oppPromo) {
      oppMove.promotion = oppPromo as any;
    }

    this.moveTimeout = setTimeout(async () => {
      this.playMove(oppMove);

      const nextUserFen = makeFen(this.position.toSetup());
      await this.fetchTablebase(nextUserFen);
      
      this.puzzleState = "findmove";
      this.updateGround(oppMove);
      setTimeout(() => {
        this.ground?.playPremove();
      }, 50);
    }, 500);
  }

  private handleWrongMove(revertPos: import("chessops/chess").Chess) {
    this.moveTimeout = setTimeout(() => {
      this.puzzleState = "findmove";
      this.position = revertPos;
      this.updateGround();
      this.fetchTablebase(makeFen(this.position.toSetup()));
    }, 500);
  }

  private isSolved(tbMove: TablebaseMove): boolean {
    if (tbMove.checkmate) {
      return true;
    }

    let opponentHasOtherPieces = false;
    let playerHasQueenOrRook = false;

    for (let i = 0; i < 64; i++) {
      const piece = this.position.board.get(i);
      if (piece) {
        if (piece.color !== this.playerSide && piece.role !== "king") {
          opponentHasOtherPieces = true;
        }
        if (piece.color === this.playerSide && (piece.role === "queen" || piece.role === "rook")) {
          playerHasQueenOrRook = true;
        }
      }
    }

    if (!opponentHasOtherPieces && playerHasQueenOrRook) {
      return true;
    }

    return false;
  }
}
