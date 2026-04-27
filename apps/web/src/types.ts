export type Puzzle = {
  id: string;
  name: string;
  fen: string;
  moves: string;
};

export type Collection = {
  id: string;
  name: string;
  puzzles: Puzzle[];
};
