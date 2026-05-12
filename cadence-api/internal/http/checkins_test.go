//go:build integration

package http_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestCheckIn_PutThenGet(t *testing.T) {
	srv, _ := newTestServer(t)
	status, body := doReq(t, srv, http.MethodPut, "/v1/check-ins/2026-05-13", map[string]any{
		"mood": 4, "sleepHours": 7.5,
	})
	if status != http.StatusOK {
		t.Fatalf("put status %d body %s", status, body)
	}

	status, body = doReq(t, srv, http.MethodGet, "/v1/check-ins/2026-05-13", nil)
	if status != http.StatusOK {
		t.Fatalf("get status %d body %s", status, body)
	}
	var got struct {
		CheckIn struct {
			Mood       *int     `json:"mood"`
			SleepHours *float64 `json:"sleepHours"`
		} `json:"checkIn"`
	}
	_ = json.Unmarshal(body, &got)
	if got.CheckIn.Mood == nil || *got.CheckIn.Mood != 4 {
		t.Fatalf("mood: %+v", got.CheckIn.Mood)
	}
	if got.CheckIn.SleepHours == nil || *got.CheckIn.SleepHours != 7.5 {
		t.Fatalf("sleep: %+v", got.CheckIn.SleepHours)
	}
}

func TestCheckIn_GetReturnsNullWhenAbsent(t *testing.T) {
	srv, _ := newTestServer(t)
	status, body := doReq(t, srv, http.MethodGet, "/v1/check-ins/2026-05-13", nil)
	if status != http.StatusOK {
		t.Fatalf("status %d body %s", status, body)
	}
	if string(body) != "{\"checkIn\":null}\n" {
		t.Fatalf("body: %s", body)
	}
}

func TestCheckIn_PutValidatesMoodRange(t *testing.T) {
	srv, _ := newTestServer(t)
	status, _ := doReq(t, srv, http.MethodPut, "/v1/check-ins/2026-05-13", map[string]any{"mood": 9})
	if status != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", status)
	}
}
