package data

import "github.com/gofrs/uuid"

type Puzzle struct {
	ID          string    `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Fen         string    `db:"fen" json:"fen"`
	Moves       string    `db:"moves" json:"moves"`
	CreatedById uuid.UUID `db:"created_by" json:"-"`
	CreatedBy   User      `json:"createdBy"`
}
