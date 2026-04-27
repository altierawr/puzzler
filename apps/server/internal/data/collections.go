package data

import (
	"time"

	"github.com/gofrs/uuid"
)

type Collection struct {
	ID          string    `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Visibility  string    `db:"visibility" json:"visibility"`
	Puzzles     []Puzzle  `json:"puzzles"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	CreatedById uuid.UUID `db:"created_by" json:"-"`
	CreatedBy   User      `json:"createdBy"`
}
