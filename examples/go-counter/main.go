package main

import (
	"fmt"
	"os"
	"strconv"
)

// QVM reads come in as DB_<SLOT>. Writes go to stdout as DBW=<SLOT>=<VALUE>.
// qan send scans this file and adds -r COUNTER.
func main() {
	if len(os.Args) == 2 && os.Args[1] == "construct" {
		os.Stdout.WriteString("DBW=COUNTER=0\n")
		os.Exit(0)
	}

	current, _ := strconv.Atoi(os.Getenv("DB_COUNTER"))
	next := current + 1
	os.Stdout.WriteString(fmt.Sprintf("OUT=count: %d\n", next))
	os.Stdout.WriteString(fmt.Sprintf("DBW=COUNTER=%d\n", next))
}
