import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import type { Key } from "@lichess-org/chessground/types";
import { Chess } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import { ChildNode, Node, parsePgn, startingPosition, type PgnNodeData } from "chessops/pgn";
import { parseSan, makeSan } from "chessops/san";
import type { Move as ChessopsMove } from "chessops/types";
import type { NormalMove } from "chessops/types";
import { makeSquare, parseSquare } from "chessops/util";

import { isPromotion, toDests } from "@/utils/chess";

import type { Puzzle } from "./types";
import { playCapture, playMove, preloadSounds, setVolume } from "./utils/sounds";

export type PuzzleState = "findmove" | "correct" | "wrong" | "variation" | "solved" | "goodmove" | "badmove";

export type RootMove = {
  children: Move[];
};

export type Move = {
  san: string;
  isSolved?: boolean;
  nags?: number[];
  children: Move[];
  sidelineDepth: number;
  previousMove?: Move | RootMove;
};

export class PuzzleBoard {
  puzzleState: PuzzleState = "findmove";
  isInVariation: boolean = false;
  private moveTimeout: number | null = null;
  private startPos: Chess;
  private position: Chess;
  private ground: Api;
  private moveTreePos: Move | RootMove;
  playerSide: "black" | "white";
  onUpdate?: () => void;

  constructor(rootElement: HTMLDivElement, puzzle: Puzzle) {
    rootElement.addEventListener("mousedown", () => preloadSounds(), { once: true });
    setVolume(0.3);

    const OBSERVABLE_KEYS = new Set(["puzzleState", "isInVariation"]);
    const proxy = new Proxy(this, {
      set(target, key, value) {
        target[key as keyof typeof target] = value;
        if (OBSERVABLE_KEYS.has(key as string)) {
          target.onUpdate?.();
        }
        return true;
      },
    });

    const pgnStr = `
      [FEN "${puzzle.fen}"]

      ${puzzle.moves}
    `;

    console.log("puzzle", puzzle.fen);

    const setup = parseFen(puzzle.fen).unwrap();
    const game = parsePgn(pgnStr)[0];
    const pgn = startingPosition(game.headers).unwrap();

    this.startPos = Chess.fromSetup(setup).unwrap();
    this.position = this.startPos.clone();
    this.moveTreePos = this.movesToTree(game.moves);
    this.playerSide = setup.turn;

    for (const node of game.moves.mainline()) {
      const move = parseSan(pgn, node.san);
      if (!move) {
        console.log("illegal move", node.san);
        break;
      }

      pgn.play(move);
    }

    this.ground = Chessground(rootElement, {
      fen: puzzle.fen,
      orientation: setup.turn,
      turnColor: setup.turn,
      disableContextMenu: true,
      movable: {
        free: false,
        color: setup.turn,
        dests: toDests(this.position),
        rookCastle: false,
      },
      events: {
        move: (orig, dest) => {
          proxy.handleBoardMove(orig, dest);
        },
      },
    });

    return proxy;
  }

  private updateGround(lastMove?: ChessopsMove, config?: Config) {
    this.ground?.set({
      fen: makeFen(this.position.toSetup()),
      turnColor: this.position.turn,
      lastMove: lastMove && "from" in lastMove ? [makeSquare(lastMove.from), makeSquare(lastMove.to)] : [],
      movable: {
        color: this.position.turn,
        dests: toDests(this.position),
      },
      ...config,
    });
  }

  private disableGroundMoves() {
    this.ground.set({
      movable: {
        color: undefined,
      },
    });
  }

  private enableGroundMoves() {
    this.ground.set({
      movable: {
        color: this.position.turn,
        dests: toDests(this.position),
      },
    });
  }

  returnFromGoodOrBadMove() {
    if (!("san" in this.moveTreePos)) {
      console.error("san not found in the tree position");
      return;
    }

    let targetMove = this.moveTreePos.previousMove;
    console.log(this.moveTreePos);

    if (this.puzzleState === "badmove" && targetMove && "san" in targetMove) {
      targetMove = targetMove.previousMove;
    }

    if (!targetMove) {
      console.error("target move not found when returning from good or bad move");
      return;
    }

    const moveHistory = this.getSanMoveHistoryForPos(targetMove);
    this.position = this.startPos.clone();

    for (const san of moveHistory) {
      const sanMove = parseSan(this.position, san);
      if (!sanMove) {
        console.error("invalid san move", sanMove);
        break;
      }

      this.position.play(sanMove);
    }

    this.moveTreePos = targetMove;
    this.updateGround();
    this.puzzleState = "findmove";
  }

  returnFromVariation() {
    for (;;) {
      if (!("san" in this.moveTreePos)) {
        break;
      }

      if (!this.moveTreePos.previousMove) {
        break;
      }

      this.moveTreePos = this.moveTreePos.previousMove;
      if (!("san" in this.moveTreePos)) {
        break;
      }

      const moveHistory = this.getSanMoveHistoryForPos(this.moveTreePos);
      this.position = this.startPos.clone();

      for (const san of moveHistory) {
        const sanMove = parseSan(this.position, san);
        if (!sanMove) {
          console.error("invalid san move", sanMove);
          break;
        }

        this.position.play(sanMove);
      }

      // we only do variations of opponent moves
      if (this.position.turn === this.playerSide) {
        continue;
      }

      let opponentMove: Move | null = null;
      for (let i = this.moveTreePos.children.length - 1; i >= 0; i--) {
        const variation = this.moveTreePos.children[i];

        if (!variation.isSolved) {
          this.moveTreePos.children[i].isSolved = true;
          opponentMove = variation;
          break;
        }
      }

      if (!opponentMove) {
        continue;
      }

      const opponentMoveNormal = parseSan(this.position, opponentMove.san);
      if (!opponentMoveNormal) {
        console.error("Opponent move is invalid");
        return;
      }

      this.disableGroundMoves();
      this.updateGround();

      this.moveTimeout = setTimeout(() => {
        let isCapture = this.position.board.get(opponentMoveNormal.to) !== undefined;

        if (isCapture) {
          playCapture();
        } else {
          playMove();
        }

        this.position.play(opponentMoveNormal);
        this.updateGround(opponentMoveNormal);

        this.moveTreePos = opponentMove;

        this.isInVariation = opponentMove.sidelineDepth > 0;

        if (this.moveTreePos.children.length === 0) {
          this.puzzleState = "solved";
          this.disableGroundMoves();
        } else {
          this.puzzleState = "findmove";
        }
      }, 500);
      break;
    }
  }

  private handleBoardMove(orig: Key, dest: Key) {
    const move: NormalMove = {
      from: parseSquare(orig)!,
      to: parseSquare(dest)!,
    };

    if (isPromotion(this.position, move)) {
      move.promotion = "queen";
    }

    const san = makeSan(this.position, move);
    let isCorrectMove = false;
    if (this.moveTreePos.children.length > 0) {
      if (san === this.moveTreePos.children[0].san) {
        isCorrectMove = true;
      }
    }

    if (isCorrectMove) {
      const wasSolved = "san" in this.moveTreePos && this.moveTreePos.isSolved;
      this.moveTreePos = this.moveTreePos.children[0];

      if ("san" in this.moveTreePos) {
        this.moveTreePos.isSolved = wasSolved;
      }
    }

    const isSolved = isCorrectMove && this.moveTreePos.children.length === 0;

    this.playMove(move);
    this.disableGroundMoves();

    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
    }

    if (!isCorrectMove) {
      let moveInTree: Move | null = null;
      let moveType: PuzzleState | null = null;
      for (const move of this.moveTreePos.children) {
        if (move.san === san) {
          moveInTree = move;

          if (move.nags?.includes(98)) {
            moveType = "goodmove";
          } else if (move.nags?.includes(97) && move.children.length > 0) {
            moveType = "badmove";
          }

          break;
        }
      }

      if (moveInTree && moveType) {
        this.puzzleState = moveType;
        this.moveTreePos = moveInTree;

        if (moveType === "badmove") {
          const followupMove = this.moveTreePos.children[0];

          setTimeout(() => {
            const move = parseSan(this.position, followupMove.san);
            if (!move) {
              console.error("can't play move", moveInTree.san);
              return;
            }

            this.moveTreePos = followupMove;
            this.playMove(move);
            this.disableGroundMoves();
          }, 250);
        }

        return;
      }

      const moveHistory = this.getSanMoveHistoryForPos(this.moveTreePos);
      this.position = this.startPos.clone();

      let lastMove: ChessopsMove | undefined;

      for (const san of moveHistory) {
        const sanMove = parseSan(this.position, san);
        if (!sanMove) {
          console.error("invalid san move", sanMove);
          break;
        }

        lastMove = sanMove;
        this.position.play(sanMove);
      }

      this.puzzleState = "wrong";
      this.moveTimeout = setTimeout(() => {
        this.puzzleState = "findmove";
        this.updateGround(lastMove);
      }, 500);
    } else if (isSolved) {
      this.puzzleState = "solved";
    } else {
      this.puzzleState = "correct";

      this.moveTimeout = setTimeout(() => {
        const opponentMoves = this.moveTreePos.children;
        let opponentMove = opponentMoves[0];

        for (let i = opponentMoves.length - 1; i >= 0; i--) {
          const variation = opponentMoves[i];

          if (
            !variation.isSolved &&
            (variation.sidelineDepth === 0 || this.doesVariationEndWithUserMove(variation, false))
          ) {
            opponentMove = variation;
            this.moveTreePos.children[i].isSolved = true;

            this.isInVariation = opponentMove.sidelineDepth > 0;
            break;
          }
        }

        const opponentMoveNormal = parseSan(this.position, opponentMove.san);
        if (!opponentMoveNormal) {
          console.error("Opponent move is invalid");
          return;
        }

        let isCapture = this.position.board.get(opponentMoveNormal.to) !== undefined;

        if (isCapture) {
          playCapture();
        } else {
          playMove();
        }

        this.position.play(opponentMoveNormal);
        this.updateGround(opponentMoveNormal);

        const wasSolved = "san" in opponentMove && opponentMove.isSolved;
        this.moveTreePos = opponentMove;
        if ("san" in this.moveTreePos) {
          this.moveTreePos.isSolved = wasSolved;
        }

        if (this.moveTreePos.children.length === 0) {
          this.puzzleState = "solved";
          this.disableGroundMoves();
        } else {
          this.puzzleState = "findmove";
        }
      }, 500);
    }
  }

  private doesVariationEndWithUserMove(variation: Move, isFirstMoveUserMove: boolean): boolean {
    let depth = variation.sidelineDepth;
    let currentVariation = variation;
    let n = 1;
    while (currentVariation.children.length > 0 && currentVariation.children[0].sidelineDepth === depth) {
      currentVariation = currentVariation.children[0];
      n++;
    }

    return isFirstMoveUserMove ? n % 2 === 1 : n % 2 === 0;
  }

  private playMove(move: ChessopsMove) {
    let isCapture = this.position.board.get(move.to) !== undefined;

    if (isCapture) {
      playCapture();
    } else {
      playMove();
    }

    this.position.play(move);
    this.updateGround(move);
  }

  private getSanMoveHistoryForPos(move: RootMove | Move): string[] {
    return this.getSanMoveHistoryForPosImpl(move).reverse();
  }

  private getSanMoveHistoryForPosImpl(move: RootMove | Move): string[] {
    if (!("previousMove" in move)) {
      if ("san" in move) {
        return [move.san];
      }

      return [];
    }

    if (!move.previousMove) {
      return [move.san];
    } else {
      return [move.san, ...this.getSanMoveHistoryForPosImpl(move.previousMove)];
    }
  }

  private movesToTree(node: Node<PgnNodeData>): RootMove {
    let rootMove: RootMove = {
      children: [],
    };

    for (let i = 0; i < node.children.length; i++) {
      rootMove.children.push(this.childMoveToTree(node.children[i], i > 0 ? 1 : 0));
      rootMove.children[i].previousMove = rootMove;
    }

    return rootMove;
  }

  private childMoveToTree(node: ChildNode<PgnNodeData>, sidelineDepth: number = 0): Move {
    const move: Move = {
      san: node.data.san,
      nags: node.data.nags,
      children: [],
      sidelineDepth,
      isSolved: false,
    };

    for (let i = 0; i < node.children.length; i++) {
      const childMove = this.childMoveToTree(node.children[i], sidelineDepth + (i > 0 ? 1 : 0));
      childMove.previousMove = move;
      move.children.push(childMove);
    }

    return move;
  }
}
