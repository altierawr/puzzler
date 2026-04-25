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

export type PuzzleState = "findmove" | "correct" | "wrong" | "variation" | "solved";

export type RootMove = {
  children: Move[];
};

export type Move = {
  san: string;
  nags?: number[];
  children: Move[];
  sidelineDepth: number;
  previousMove?: Move;
};

export class PuzzleBoard {
  puzzleState: PuzzleState = "findmove";
  private moveTimeout: number | null = null;
  private startPos: Chess;
  private position: Chess;
  private ground: Api;
  private moveTreePos: Move | RootMove;
  onUpdate?: () => void;

  constructor(rootElement: HTMLDivElement, puzzle: Puzzle) {
    const OBSERVABLE_KEYS = new Set(["puzzleState"]);
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

    const setup = parseFen(puzzle.fen).unwrap();
    const game = parsePgn(pgnStr)[0];
    const pgn = startingPosition(game.headers).unwrap();

    this.startPos = Chess.fromSetup(setup).unwrap();
    this.position = this.startPos.clone();
    this.moveTreePos = this.movesToTree(game.moves);

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

  private updateGround(pos: Chess, lastMove?: ChessopsMove, config?: Config) {
    this.ground?.set({
      fen: makeFen(pos.toSetup()),
      turnColor: pos.turn,
      lastMove: lastMove && "from" in lastMove ? [makeSquare(lastMove.from), makeSquare(lastMove.to)] : [],
      movable: {
        color: pos.turn,
        dests: toDests(pos),
      },
      ...config,
    });
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
      this.moveTreePos = this.moveTreePos.children[0];
    }

    const isSolved = isCorrectMove && this.moveTreePos.children.length === 0;

    this.position.play(move);
    this.updateGround(
      this.position,
      move,
      isSolved || !isCorrectMove
        ? {
            movable: {
              color: undefined,
              dests: new Map<Key, Key[]>(),
            },
          }
        : undefined,
    );

    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
    }

    if (!isCorrectMove) {
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
        this.updateGround(this.position, lastMove);
      }, 500);
    } else if (isSolved) {
      this.puzzleState = "solved";
    } else {
      this.puzzleState = "correct";

      this.moveTimeout = setTimeout(() => {
        this.puzzleState = "findmove";
      }, 500);
    }
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
    const moves: Move[] = [];

    for (let i = 0; i < node.children.length; i++) {
      moves.push(this.childMoveToTree(node.children[i], i > 0 ? 1 : 0));
    }

    return {
      children: moves,
    };
  }

  private childMoveToTree(node: ChildNode<PgnNodeData>, sidelineDepth: number = 0): Move {
    const move: Move = {
      san: node.data.san,
      nags: node.data.nags,
      children: [],
      sidelineDepth,
    };

    for (let i = 0; i < node.children.length; i++) {
      const childMove = this.childMoveToTree(node.children[i], sidelineDepth + (i > 0 ? 1 : 0));
      childMove.previousMove = move;
      move.children.push(childMove);
    }

    return move;
  }
}
