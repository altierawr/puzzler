export type Puzzle = {
  id: string;
  name: string;
  fen: string;
  moves: string;
  comments?: string;
  solveStatus?: string;
  previousPuzzleId?: string;
  nextPuzzleId?: string;
};

export type Collection = {
  id: string;
  name: string;
  puzzles: Puzzle[];
};
