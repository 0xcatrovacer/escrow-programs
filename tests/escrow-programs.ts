import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { EscrowPrograms } from "../target/types/escrow_programs";
import {
    PublicKey,
    SystemProgram,
    Transaction,
    Connection,
    Commitment,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import * as assert from "assert";

describe("escrow-programs", () => {
    const program = anchor.workspace.EscrowPrograms as Program<EscrowPrograms>;

    const commitment: Commitment = "processed";

    const connection = new Connection("https://api.devnet.solana.com", {
        commitment,
    });
    const options = anchor.Provider.defaultOptions();
    const provider = new anchor.Provider(
        connection,
        program.provider.wallet,
        options
    );

    anchor.setProvider(provider);

    let mintA = null as Token;
    let mintB = null as Token;
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

    it("Initialize program state", async () => {
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
                payer.publicKey,
                1000000000
            ),
            "processed"
        );

        await provider.send(
            (() => {
                const tx = new Transaction();
                tx.add(
                    SystemProgram.transfer({
                        fromPubkey: payer.publicKey,
                        toPubkey: initializerMainAccount.publicKey,
                        lamports: 100000000,
                    }),
                    SystemProgram.transfer({
                        fromPubkey: payer.publicKey,
                        toPubkey: takerMainAccount.publicKey,
                        lamports: 100000000,
                    })
                );
                return tx;
            })(),
            [payer]
        );

        mintA = await Token.createMint(
            provider.connection,
            payer,
            mintAuthority.publicKey,
            null,
            0,
            TOKEN_PROGRAM_ID
        );

        mintB = await Token.createMint(
            provider.connection,
            payer,
            mintAuthority.publicKey,
            null,
            0,
            TOKEN_PROGRAM_ID
        );

        initializerTokenAccountA = await mintA.createAccount(
            initializerMainAccount.publicKey
        );
        takerTokenAccountA = await mintA.createAccount(
            takerMainAccount.publicKey
        );

        initializerTokenAccountB = await mintB.createAccount(
            initializerMainAccount.publicKey
        );
        takerTokenAccountB = await mintB.createAccount(
            takerMainAccount.publicKey
        );

        await mintA.mintTo(
            initializerTokenAccountA,
            mintAuthority.publicKey,
            [mintAuthority],
            initializerAmount
        );

        await mintB.mintTo(
            takerTokenAccountB,
            mintAuthority.publicKey,
            [mintAuthority],
            takerAmount
        );

        let initializerA = await mintA.getAccountInfo(initializerTokenAccountA);
        let takerB = await mintB.getAccountInfo(takerTokenAccountB);

        assert.equal(initializerA.amount, initializerAmount);
        assert.equal(takerB.amount, takerAmount);
    });
});
