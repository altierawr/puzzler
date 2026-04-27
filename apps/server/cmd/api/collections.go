package main

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/altierawr/puzzler/internal/database"
	"github.com/altierawr/puzzler/internal/validator"
)

func validateCollectionName(name string) (string, *validator.Validator) {
	trimmedName := strings.TrimSpace(name)
	v := validator.New()
	nameLength := utf8.RuneCountInString(trimmedName)

	v.Check(nameLength >= 1, "name", "must contain at least 1 character")
	v.Check(nameLength <= 50, "name", "must not contain more than 50 characters")

	return trimmedName, v
}

func (app *application) createCollectionHandler(w http.ResponseWriter, r *http.Request) {
	userId := app.contextGetUserId(r)
	if userId == nil {
		app.invalidAuthenticationTokenResponse(w, r)
		return
	}

	var input struct {
		Name string `json:"name"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.handleReadJSONError(w, r, err)
		return
	}

	name, v := validateCollectionName(input.Name)
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	collection, err := app.db.CreateCollection(*userId, name)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, collection, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getCollectionHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDStringParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	collection, err := app.db.GetCollection(id)
	if err != nil {
		switch {
		case errors.Is(err, database.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}

		return
	}

	err = app.writeJSON(w, http.StatusOK, collection, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
