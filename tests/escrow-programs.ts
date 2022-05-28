import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { EscrowPrograms } from "../target/types/escrow_programs";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("escrow-programs", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.Provider.env());

    const program = anchor.workspace.EscrowPrograms as Program<EscrowPrograms>;

    let mintA = null;
    let mintB = null;
    let initializerTokenAccountA = null;
    let initializerTokenAccountB = null;
    let takerTokenAccountA = null;
    let takerTokenAccountB = null;
    let vault_account_pda = null;
    let vault_account_bump = null;
    let vault_auth_pda = null;

    const takerAmount = 1000;
    const initializerAmount = 500;

    const escrowAccount = anchor.web3.Keypair.generate();
    const payer = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();
    const initializerMainAccount = anchor.web3.Keypair.generate();
    const takerMainAccount = anchor.web3.Keypair.generate();

    it("Is initialized!", async () => {
        // Add your test here.
        const tx = await program.rpc.initialize({});
        console.log("Your transaction signature", tx);
    });
});
