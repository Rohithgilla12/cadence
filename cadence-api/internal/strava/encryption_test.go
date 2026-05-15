package strava

import (
	"strings"
	"testing"
)

const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func TestCipher_RoundTrip(t *testing.T) {
	c, err := NewCipher(testKey)
	if err != nil {
		t.Fatalf("NewCipher: %v", err)
	}
	cases := []string{
		"short",
		"06ed9e9d-b0c9-4f6c-b96e-20f42b8b1532",
		"super-long-token-" + strings.Repeat("x", 1024),
		"",
	}
	for _, plaintext := range cases {
		enc, err := c.Encrypt(plaintext)
		if err != nil {
			t.Fatalf("Encrypt(%q): %v", plaintext, err)
		}
		if enc == plaintext {
			t.Errorf("ciphertext equals plaintext for %q", plaintext)
		}
		dec, err := c.Decrypt(enc)
		if err != nil {
			t.Fatalf("Decrypt: %v", err)
		}
		if dec != plaintext {
			t.Errorf("round-trip mismatch: got %q want %q", dec, plaintext)
		}
	}
}

func TestCipher_NonceIsUniquePerCall(t *testing.T) {
	// AES-GCM is broken by nonce reuse. Verify that encrypting the same
	// plaintext twice produces different ciphertexts so a future refactor
	// to a deterministic nonce immediately breaks this test.
	c, err := NewCipher(testKey)
	if err != nil {
		t.Fatalf("NewCipher: %v", err)
	}
	a, err := c.Encrypt("same-input")
	if err != nil {
		t.Fatal(err)
	}
	b, err := c.Encrypt("same-input")
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("nonce appears reused — Encrypt produced identical ciphertexts for the same plaintext")
	}
}

func TestCipher_RejectsBadKey(t *testing.T) {
	cases := []string{
		"",          // empty
		"too-short", // not hex
		"abcdef",    // wrong length
		"zz23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", // non-hex
	}
	for _, k := range cases {
		if _, err := NewCipher(k); err == nil {
			t.Errorf("expected error for key %q", k)
		}
	}
}

func TestCipher_RejectsTamperedCiphertext(t *testing.T) {
	c, err := NewCipher(testKey)
	if err != nil {
		t.Fatalf("NewCipher: %v", err)
	}
	enc, err := c.Encrypt("real-token")
	if err != nil {
		t.Fatal(err)
	}
	// Flip the last byte. GCM auth tag should reject.
	tampered := enc[:len(enc)-2] + "AA"
	if _, err := c.Decrypt(tampered); err == nil {
		t.Fatal("expected decrypt to fail on tampered ciphertext")
	}
}
