import type { Key } from "@lichess-org/chessground/types";
import type { Chess } from "chessops/chess";
import type { NormalMove } from "chessops/types";
import { makeSquare } from "chessops/util";

export const toDests = (pos: Chess): Map<Key, Key[]> => {
  const dests = new Map<Key, Key[]>();

  for (const [from, toSet] of pos.allDests()) {
    const tos = Array.from(toSet, makeSquare);
    if (tos.length > 0) {
      dests.set(makeSquare(from), tos);
    }
  }

  return dests;
};

export const isPromotion = (pos: Chess, move: NormalMove): boolean => {
  const piece = pos.board.get(move.from);
  return (
    piece?.role === "pawn" && (move.to >= 56 || move.to <= 7) // rank 8 or rank 1
  );
};
