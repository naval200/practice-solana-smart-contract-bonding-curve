#!/bin/bash

# Check if program ID is provided
if [ -z "$1" ]; then
  echo "Usage: ./set-program-id.sh <program-id>"
  exit 1
fi

PROGRAM_ID=$1

# Create or update .env file
echo "# Solana Program ID" > .env
echo "PROGRAM_ID=$PROGRAM_ID" >> .env

# Update Rust program
sed -i.bak "s/declare_id!(\"[^\"]*\")/declare_id!(\"$PROGRAM_ID\")/" programs/bonding-curve-program/src/lib.rs
rm -f programs/bonding-curve-program/src/lib.rs.bak

# Update Anchor.toml for both localnet and devnet
sed -i.bak "s/bonding_curve_program = \"[^\"]*\"/bonding_curve_program = \"$PROGRAM_ID\"/" Anchor.toml
rm -f Anchor.toml.bak

echo "Program ID updated to $PROGRAM_ID in all files"
echo "Now run: anchor build && anchor deploy" 