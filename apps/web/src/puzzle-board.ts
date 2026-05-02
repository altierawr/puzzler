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
  isInWinningUserVariation: boolean = false;
  private moveTimeout: number | null = null;
  private startPos!: Chess;
  private position!: Chess;
  private ground!: Api;
  private moveTreePos!: Move | RootMove;
  playerSide!: "black" | "white";
  onUpdate?: () => void;

  constructor(rootElement: HTMLDivElement, puzzle: Puzzle) {
    rootElement.addEventListener("mousedown", () => preloadSounds(), { once: true });
    rootElement.addEventListener("touchstart", () => preloadSounds(), { once: true, passive: true });
    setVolume(0.3);

    const OBSERVABLE_KEYS = new Set(["puzzleState", "isInVariation", "isInWinningUserVariation"]);
    const proxy = new Proxy(this, {
      set(target, key, value) {
        target[key as keyof typeof target] = value;
        if (OBSERVABLE_KEYS.has(key as string)) {
          target.onUpdate?.();
        }
        return true;
      },
    });

    proxy.loadPuzzle(puzzle, rootElement);

    return proxy;
  }

  loadPuzzle(puzzle: Puzzle, rootElement?: HTMLDivElement) {
    this.puzzleState = "findmove";
    this.isInVariation = false;
    this.isInWinningUserVariation = false;
    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
      this.moveTimeout = null;
    }

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

    const groundConfig: Config = {
      fen: puzzle.fen,
      orientation: setup.turn,
      turnColor: setup.turn,
      lastMove: undefined,
      movable: {
        free: false,
        color: setup.turn,
        dests: toDests(this.position),
        rookCastle: false,
      },
      premovable: {
        enabled: true,
      },
      animation: {
        enabled: false,
      },
    };

    if (rootElement) {
      this.ground = Chessground(rootElement, {
        ...groundConfig,
        disableContextMenu: true,
        events: {
          move: (orig, dest) => {
            this.handleBoardMove(orig, dest);
          },
        },
      });
    } else {
      this.ground.set(groundConfig);
    }

    this.onUpdate?.();
  }

  private updateGround(lastMove?: ChessopsMove, config?: Config) {
    const canMove = this.puzzleState === "findmove" || this.puzzleState === "correct";

    this.ground?.set({
      fen: makeFen(this.position.toSetup()),
      turnColor: this.position.turn,
      lastMove: lastMove && "from" in lastMove ? [makeSquare(lastMove.from), makeSquare(lastMove.to)] : [],
      movable: {
        color: canMove ? this.playerSide : undefined,
        dests: canMove && this.position.turn === this.playerSide ? toDests(this.position) : undefined,
      },
      premovable: {
        enabled: true,
      },
      animation: {
        enabled: true,
      },
      ...config,
    });
  }

  // private enableGroundMoves() {
  //   this.ground.set({
  //     movable: {
  //       color: this.position.turn,
  //       dests: toDests(this.position),
  //     },
  //   });
  // }

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

      this.puzzleState = "correct";
      this.updateGround();

      this.moveTimeout = setTimeout(() => {
        let isCapture = this.position.board.get(opponentMoveNormal.to) !== undefined;

        if (isCapture) {
          playCapture();
        } else {
          playMove();
        }

        this.position.play(opponentMoveNormal);

        this.moveTreePos = opponentMove!;

        this.isInVariation = opponentMove!.sidelineDepth > 0;

        this.updateGround(opponentMoveNormal);

        if (this.isCurrentPositionCheckmarked() || this.moveTreePos.children.length === 0) {
          this.puzzleState = "solved";
        } else {
          this.puzzleState = "findmove";
        }

        setTimeout(() => {
          this.ground?.playPremove();
        }, 50);
      }, 500);
      break;
    }
  }

  private handleBoardMove(orig: Key, dest: Key) {
    this.ground.cancelPremove();

    const move: NormalMove = {
      from: parseSquare(orig)!,
      to: parseSquare(dest)!,
    };

    if (isPromotion(this.position, move)) {
      move.promotion = "queen";
    }

    const san = makeSan(this.position, move);
    console.log(this.moveTreePos);
    console.log({ san });
    let isCorrectMove = false;
    let playedMove: Move | null = null;
    for (const childMove of this.moveTreePos.children) {
      const isPlayedMove = childMove.san === san;
      if (isPlayedMove) {
        playedMove = childMove;
      }

      if (isPlayedMove && this.doesLineHaveCheckmark(childMove)) {
        isCorrectMove = true;

        if (!this.isInWinningUserVariation) {
          this.isInWinningUserVariation =
            "sidelineDepth" in this.moveTreePos && this.moveTreePos.sidelineDepth !== childMove.sidelineDepth;
        }
        break;
      }
    }

    if (!isCorrectMove && this.moveTreePos.children.length > 0) {
      if (san === this.moveTreePos.children[0].san) {
        isCorrectMove = true;
      }
    }

    if (isCorrectMove && playedMove) {
      const wasSolved = "san" in this.moveTreePos && this.moveTreePos.isSolved;
      this.moveTreePos = playedMove;

      if ("san" in this.moveTreePos) {
        this.moveTreePos.isSolved = wasSolved;
      }
    }

    const isSolved = isCorrectMove && (this.isCurrentPositionCheckmarked() || this.moveTreePos.children.length === 0);

    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
      this.moveTimeout = null;
    }

    if (!isCorrectMove) {
      let moveType: PuzzleState | null = null;

      if (playedMove?.nags?.includes(98)) {
        moveType = "goodmove";
      } else if (playedMove?.nags?.includes(97) && playedMove?.children.length > 0) {
        moveType = "badmove";
      }

      if (playedMove && moveType) {
        this.puzzleState = moveType;
        this.moveTreePos = playedMove;
        this.playMove(move);

        if (moveType === "badmove") {
          const followupMove = playedMove.children[0];

          setTimeout(() => {
            const move = parseSan(this.position, followupMove.san);
            if (!move) {
              console.error("can't play move", playedMove.san);
              return;
            }

            this.moveTreePos = followupMove;
            this.playMove(move);
          }, 250);
        }

        return;
      }

      this.puzzleState = "wrong";
      this.playMove(move);

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

      this.moveTimeout = setTimeout(() => {
        this.puzzleState = "findmove";
        this.updateGround(lastMove);
      }, 500);
    } else if (isSolved) {
      this.puzzleState = "solved";
      this.playMove(move);
    } else {
      this.puzzleState = "correct";
      this.playMove(move);

      this.moveTimeout = setTimeout(() => {
        const opponentMoves = this.moveTreePos.children;
        let opponentMove = opponentMoves[0];

        for (let i = opponentMoves.length - 1; i >= 0; i--) {
          const variation = opponentMoves[i];

          if (!variation.isSolved) {
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

        const wasSolved = "san" in opponentMove && opponentMove.isSolved;
        this.moveTreePos = opponentMove;
        if ("san" in this.moveTreePos) {
          this.moveTreePos.isSolved = wasSolved;
        }

        this.updateGround(opponentMoveNormal);
        if (this.isCurrentPositionCheckmarked() || this.moveTreePos.children.length === 0) {
          this.puzzleState = "solved";
        } else {
          this.puzzleState = "findmove";
        }

        setTimeout(() => {
          this.ground?.playPremove();
        }, 50);
      }, 500);
    }
  }

  private isCurrentPositionCheckmarked() {
    return "nags" in this.moveTreePos && this.moveTreePos.nags?.includes(99);
  }

  private doesLineHaveCheckmark(pos: Move) {
    while (pos.children.length > 0 && pos.children[0].sidelineDepth === pos.sidelineDepth) {
      if (pos.nags?.includes(99)) {
        return true;
      }

      pos = pos.children[0];
    }

    return pos.nags?.includes(99);
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
