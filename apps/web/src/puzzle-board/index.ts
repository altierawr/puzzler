import { PgnPuzzleBoard } from "./pgn";
import { TablebasePuzzleBoard } from "./tablebase";
import type { Puzzle } from "@/types";
import { BasePuzzleBoard, type PuzzleState } from "./base";

export type PuzzleBoardType = BasePuzzleBoard;

export function createPuzzleBoard(rootElement: HTMLDivElement, puzzle: Puzzle): PuzzleBoardType {
  if (puzzle.type === "tablebase") {
    return new TablebasePuzzleBoard(rootElement) as unknown as PuzzleBoardType;
  }
  return new PgnPuzzleBoard(rootElement) as unknown as PuzzleBoardType;
}

export type { PuzzleState };
