import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import type { Key } from "@lichess-org/chessground/types";
import { Chess } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import type { Move as ChessopsMove } from "chessops/types";
import { makeSquare } from "chessops/util";

import { toDests } from "@/utils/chess";
import type { Puzzle } from "@/types";
import { playCapture, playMove, preloadSounds, setVolume } from "@/utils/sounds";

export type PuzzleState = "findmove" | "correct" | "wrong" | "variation" | "solved" | "goodmove" | "badmove";

export abstract class BasePuzzleBoard {
  puzzleState: PuzzleState = "findmove";
  isInVariation: boolean = false;
  isInWinningUserVariation: boolean = false;
  protected moveTimeout: number | ReturnType<typeof setTimeout> | null = null;
  protected startPos!: Chess;
  protected position!: Chess;
  protected ground!: Api;
  playerSide!: "black" | "white";
  onUpdate?: () => void;

  constructor(rootElement: HTMLDivElement) {
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

    return proxy;
  }

  abstract loadPuzzle(puzzle: Puzzle, rootElement?: HTMLDivElement): void;
  abstract handleBoardMove(orig: Key, dest: Key): void;
  abstract showHint(): void;
  abstract returnFromVariation(): void;
  abstract returnFromGoodOrBadMove(): void;

  protected initGround(rootElement: HTMLDivElement | undefined, puzzleFen: string) {
    const setup = parseFen(puzzleFen).unwrap();
    this.startPos = Chess.fromSetup(setup).unwrap();
    this.position = this.startPos.clone();
    this.playerSide = setup.turn;

    const groundConfig: Config = {
      fen: puzzleFen,
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

  protected updateGround(lastMove?: ChessopsMove, config?: Config) {
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

  protected playMove(move: ChessopsMove) {
    let isCapture = this.position.board.get(move.to) !== undefined;

    if (isCapture) {
      playCapture();
    } else {
      playMove();
    }

    this.position.play(move);
    this.updateGround(move);
  }
}
