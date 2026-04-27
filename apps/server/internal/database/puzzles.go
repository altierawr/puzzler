package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/altierawr/puzzler/internal/data"
	"github.com/altierawr/puzzler/utils"
	"github.com/jmoiron/sqlx"
)

func (db *DB) InsertPuzzles(puzzles []data.Puzzle) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	baseTime := time.Now()

	for i, puzzle := range puzzles {
		puzzle.CreatedAt = baseTime.Add(time.Duration(i) * time.Microsecond)
		err := db.InsertPuzzle(&puzzle, tx)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (db *DB) InsertPuzzle(puzzle *data.Puzzle, tx *sqlx.Tx) error {
	if puzzle == nil {
		return errors.New("puzzle is nil")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO puzzles (id, name, fen, moves, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		`

	id, err := utils.GenerateAlphabeticId(8)
	if err != nil {
		return err
	}

	args := []any{id, puzzle.Name, puzzle.Fen, puzzle.Moves, puzzle.CreatedById, puzzle.CreatedAt}

	if tx != nil {
		_, err = tx.ExecContext(ctx, query, args...)
	} else {
		_, err = db.ExecContext(ctx, query, args...)
	}

	return err
}

func (db *DB) GetPuzzle(id string) (*data.Puzzle, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	query := `
		SELECT * FROM puzzles
		WHERE id = $1
	`

	puzzle := data.Puzzle{}
	err := db.GetContext(ctx, &puzzle, query, id)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	return &puzzle, nil
}
