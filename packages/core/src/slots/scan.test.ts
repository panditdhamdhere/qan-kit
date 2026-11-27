import { describe, expect, it } from 'vitest';
import { scanSlots } from './scan.js';

const GO = `
package main

import (
    "fmt"
    "os"
    "strconv"
)

func main() {
    if len(os.Args) == 2 && os.Args[1] == "construct" {
        os.Stdout.WriteString(fmt.Sprintf("DBW=QVM_INIT_MAXUSER=%s\\n", "100"))
        os.Exit(0)
    }
    if os.Getenv("DB_QVM_INITIALIZED") != "true" {
        panic("contract is not initialized")
    }
    maxUser, _ := strconv.Atoi(os.Getenv("DB_QVM_INIT_MAXUSER"))
    previousName := os.Getenv("DB_USER_CURRENT")
    totalUserCount, _ := strconv.Atoi(os.Getenv("DB_TOTALUSERS"))
    if totalUserCount+1 > maxUser {
        panic("exceeded max user")
    }
    os.Stdout.WriteString(fmt.Sprintf("OUT=prevname: %s\\n", previousName))
    os.Stdout.WriteString(fmt.Sprintf("DBW=USER_CURRENT=%s\\n", os.Args[2]))
    os.Stdout.WriteString(fmt.Sprintf("DBW=USER_%d=%s\\n", totalUserCount, os.Args[2]))
    os.Stdout.WriteString(fmt.Sprintf("DBW=TOTALUSERS=%d\\n", totalUserCount+1))
}
`;

const PYTHON = `
import os
previous = os.getenv("DB_USER_CURRENT") or "unknown"
total = os.environ.get("DB_TOTALUSERS")
os.environ["DB_NOTE"]
`;

const TS = `
const previous = process.env.DB_USER_CURRENT || "unknown";
const total = process.env["DB_TOTALUSERS"];
process.stdout.write("DBW=TOTALUSERS=" + total + "\\n");
process.stdout.write("DBP=OLD_NOTE\\n");
`;

describe('scanSlots', () => {
  it('lists go reads and skips the runtime initialized flag', () => {
    const report = scanSlots(GO, 'go', ['USER_CURRENT']);
    expect(report.requiredReads).toEqual(['QVM_INIT_MAXUSER', 'USER_CURRENT', 'TOTALUSERS']);
    expect(report.reads).toContain('QVM_INITIALIZED');
    expect(report.requiredReads).not.toContain('QVM_INITIALIZED');
    expect(report.writes).toEqual(
      expect.arrayContaining(['QVM_INIT_MAXUSER', 'USER_CURRENT', 'TOTALUSERS']),
    );
    expect(report.undeclaredReads).toEqual(['QVM_INIT_MAXUSER', 'TOTALUSERS']);
    expect(report.readFlag).toBe('QVM_INIT_MAXUSER,USER_CURRENT,TOTALUSERS');
    expect(report.dynamic.some((item) => item.includes('%'))).toBe(true);
  });

  it('reads python getenv and environ', () => {
    const report = scanSlots(PYTHON, 'python');
    expect(report.requiredReads).toEqual(['USER_CURRENT', 'TOTALUSERS', 'NOTE']);
    expect(report.undeclaredReads).toEqual(report.requiredReads);
  });

  it('reads typescript env and db writes', () => {
    const report = scanSlots(TS, 'ts', ['TOTALUSERS']);
    expect(report.requiredReads).toEqual(['USER_CURRENT', 'TOTALUSERS']);
    expect(report.writes).toContain('TOTALUSERS');
    expect(report.deletes).toContain('OLD_NOTE');
    expect(report.undeclaredReads).toEqual(['USER_CURRENT']);
  });
});
