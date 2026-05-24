CREATE TYPE puzzle_type as enum (
  'pgn',
  'tablebase'
);

ALTER TABLE puzzles ADD type puzzle_type;
