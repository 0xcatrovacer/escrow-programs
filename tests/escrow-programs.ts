import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { EscrowPrograms } from "../target/types/escrow_programs";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import * as assert from "assert";
import {
    TOKEN_PROGRAM_ID,
    getTokenAccount,
    createMint,
    createTokenAccount,
    mintToAccount,
} from "./utils";

describe("escrow-programs", () => {
    const provider = anchor.Provider.local();

    anchor.setProvider(provider);

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

    const takerAmount = new anchor.BN(1000);
    const initializerAmount = new anchor.BN(500);

    const escrowAccount = anchor.web3.Keypair.generate();
    const initializerMainAccount = anchor.web3.Keypair.generate();
    const takerMainAccount = anchor.web3.Keypair.generate();

    it("Initialize program state", async () => {
        const signatureI = await program.provider.connection.requestAirdrop(
            initializerMainAccount.publicKey,
            1000000000
        );
        await program.provider.connection.confirmTransaction(signatureI);

        const signatureT = await program.provider.connection.requestAirdrop(
            initializerMainAccount.publicKey,
            1000000000
        );
        await program.provider.connection.confirmTransaction(signatureT);

        mintA = await createMint(provider, undefined);
        mintB = await createMint(provider, undefined);

        initializerTokenAccountA = await createTokenAccount(
            provider,
            mintA,
            initializerMainAccount.publicKey
        );
        takerTokenAccountA = await createTokenAccount(
            provider,
            mintA,
            takerMainAccount.publicKey
        );

        initializerTokenAccountB = await createTokenAccount(
            provider,
            mintB,
            initializerMainAccount.publicKey
        );
        takerTokenAccountB = await createTokenAccount(
            provider,
            mintB,
            takerMainAccount.publicKey
        );

        await mintToAccount(
            provider,
            mintA,
            initializerTokenAccountA,
            initializerAmount,
            provider.wallet.publicKey
        );

        await mintToAccount(
            provider,
            mintB,
            takerTokenAccountB,
            takerAmount,
            provider.wallet.publicKey
        );

        let initializerA = await getTokenAccount(
            provider,
            initializerTokenAccountA
        );

        let takerB = await getTokenAccount(provider, takerTokenAccountB);

        console.log("initializerA: ", initializerA);
        console.log("takerB: ", takerB);
    });
});
