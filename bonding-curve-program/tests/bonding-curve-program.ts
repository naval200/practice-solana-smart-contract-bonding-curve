import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BondingCurveProgram } from "../target/types/bonding_curve_program";
import { Keypair } from "@solana/web3.js";

describe("bonding-curve-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.BondingCurveProgram as Program<BondingCurveProgram>;
  const tokenMint = Keypair.generate();

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .initializeBondingCurve(
        new anchor.BN(100), // initial price
        new anchor.BN(1),   // slope
        "TestCoin",        // name
        "TEST"            // symbol
      )
      .accounts({
        creator: program.provider.publicKey,
        tokenMint: tokenMint.publicKey,
        bondingCurve: (await anchor.web3.PublicKey.findProgramAddress(
          [Buffer.from("bonding_curve"), tokenMint.publicKey.toBuffer()],
          program.programId
        ))[0],
        solVault: (await anchor.web3.PublicKey.findProgramAddress(
          [Buffer.from("sol_vault"), tokenMint.publicKey.toBuffer()],
          program.programId
        ))[0],
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([tokenMint])
      .rpc();

    console.log("Your transaction signature", tx);
  });
});
