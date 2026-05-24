package main

import (
	"bufio"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/altierawr/puzzler/internal/data"
	"github.com/altierawr/puzzler/internal/database"
)

func (app *application) updatePuzzleSolveStatusHandler(w http.ResponseWriter, r *http.Request) {
	userId := app.contextGetUserId(r)
	if userId == nil {
		app.invalidAuthenticationTokenResponse(w, r)
		return
	}

	id, err := app.readIDStringParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	var input struct {
		Status string `json:"status"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.handleReadJSONError(w, r, err)
		return
	}

	if input.Status != "success" && input.Status != "partial" && input.Status != "fail" {
		app.badRequestResponse(w, r, errors.New("status is invalid"))
		return
	}

	err = app.db.SetPuzzleSolveStatus(id, *userId, input.Status)
	if err != nil {
		switch {
		case errors.Is(err, database.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}

		return
	}

	err = app.writeJSON(w, http.StatusOK, nil, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getPuzzleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDStringParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	puzzle, err := app.db.GetPuzzle(id)
	if err != nil {
		switch {
		case errors.Is(err, database.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}

		return
	}

	err = app.writeJSON(w, http.StatusOK, puzzle, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deletePuzzleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDStringParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	err = app.db.DeletePuzzle(id)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, nil, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) importPuzzlesHandler(w http.ResponseWriter, r *http.Request) {
	userID := app.contextGetUserId(r)
	if userID == nil {
		app.invalidAuthenticationTokenResponse(w, r)
		return
	}

	var input struct {
		Type           string   `json:"type"`
		Data           []string `json:"data"`
		CollectionName string   `json:"collectionName"`
		CollectionId   string   `json:"collectionId"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.handleReadJSONError(w, r, err)
		return
	}

	puzzles := []data.Puzzle{}

	if input.Type == "tablebase" {
		nameOffset := 0
		if input.CollectionId != "" {
			count, err := app.db.CountCollectionPuzzles(input.CollectionId)
			if err != nil {
				app.serverErrorResponse(w, r, err)
				return
			}
			nameOffset = count
		}

		for i, fen := range input.Data {
			puzzle := data.Puzzle{
				Name:        fmt.Sprintf("Tablebase Puzzle %d", nameOffset+i+1),
				Fen:         strings.TrimSpace(fen),
				Type:        "tablebase",
				CreatedById: *userID,
			}
			puzzles = append(puzzles, puzzle)
		}
	} else {
		for _, pgn := range input.Data {
			puzzle := data.Puzzle{}

			scanner := bufio.NewScanner(strings.NewReader(pgn))
			finishedWithMoves := false
			comments := ""
			moves := ""
			for scanner.Scan() {
				l := scanner.Text()
				line := strings.TrimSpace(l)

				if s, found := strings.CutPrefix(line, "[White"); found {
					split := strings.Split(s, "\"")
					if len(split) != 3 {
						app.badRequestResponse(w, r, errors.New("invalid puzzle name"))
						return
					}

					puzzle.Name = split[1]
				}

				if s, found := strings.CutPrefix(line, "[FEN"); found {
					split := strings.Split(s, "\"")
					if len(split) != 3 {
						app.badRequestResponse(w, r, errors.New("invalid puzzle fen"))
						return
					}

					puzzle.Fen = split[1]
				}

				// blank puzzle
				if line == "*" && len(moves) == 0 {
					app.logger.Warn("puzzle was empty", "puzzle", puzzle.Name)
					puzzle = data.Puzzle{}
					moves = ""
					break
				}

				// other tags that we don't care about
				if strings.HasPrefix(line, "[") {
					continue
				}

				if len(line) == 0 && len(moves) > 0 {
					finishedWithMoves = true
				}

				if len(line) == 0 {
					continue
				}

				if !finishedWithMoves {
					moves = moves + strings.ReplaceAll(line, "\n", "") + " "
				} else {
					comments = comments + line + "\n"
				}
			}

			if len(comments) > 0 {
				puzzle.Comments = &comments
			}

			if len(moves) > 0 {
				puzzle.Moves = &moves
				puzzle.CreatedById = *userID
				puzzle.Type = "pgn"
				puzzles = append(puzzles, puzzle)
			}

			if err := scanner.Err(); err != nil {
				app.logger.Error("scan error", "err", err.Error())
				app.serverErrorResponse(w, r, err)
				return
			}
		}
	}

	fmt.Println("found", len(puzzles), "puzzles")
	err = app.db.InsertPuzzles(puzzles)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		fmt.Println(err)
		return
	}

	if input.CollectionId != "" {
		puzzleIds := make([]string, len(puzzles))
		for i, puzzle := range puzzles {
			puzzleIds[i] = puzzle.ID
		}

		err = app.db.AddPuzzlesToCollection(input.CollectionId, puzzleIds)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}
	} else if input.CollectionName != "" {
		collectionName, v := validateCollectionName(input.CollectionName)
		if !v.Valid() {
			app.failedValidationResponse(w, r, v.Errors)
			return
		}

		collection, err := app.db.CreateCollection(*userID, collectionName)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}

		puzzleIds := make([]string, len(puzzles))
		for i, puzzle := range puzzles {
			puzzleIds[i] = puzzle.ID
		}

		err = app.db.AddPuzzlesToCollection(collection.ID, puzzleIds)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}
	}

	err = app.writeJSON(w, http.StatusOK, puzzles, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
