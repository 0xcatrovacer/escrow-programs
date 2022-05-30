import * as anchor from "@project-serum/anchor";
import { Program, BN, IdlAccounts } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { assert } from "chai";
import { EscrowPrograms } from "../target/types/escrow_programs";

type EscrowAccount = IdlAccounts<EscrowPrograms>["escrowAccount"];

describe("escrow-programs", () => {
    const provider = anchor.Provider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.EscrowPrograms as Program<EscrowPrograms>;

    let mintA: Token = null;
    let mintB: Token = null;
    let initializerTokenAccountA = null;
    let initializerTokenAccountB = null;
    let takerTokenAccountA = null;
    let takerTokenAccountB = null;
    let pda = null;

    const takerAmount = 1000;
    const initializerAmount = 500;

    const escrowAccount = anchor.web3.Keypair.generate();
    const payer = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();

    it("initialize program state", async () => {
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
                payer.publicKey,
                10000000000
            ),
            "confirmed"
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
            provider.wallet.publicKey
        );
        takerTokenAccountA = await mintA.createAccount(
            provider.wallet.publicKey
        );

        initializerTokenAccountB = await mintB.createAccount(
            provider.wallet.publicKey
        );
        takerTokenAccountB = await mintB.createAccount(
            provider.wallet.publicKey
        );

        await mintA.mintTo(
            initializerTokenAccountA,
            mintAuthority.publicKey,
            [mintAuthority],
            initializerAmount
        );

        await mintA.mintTo(
            takerTokenAccountB,
            mintAuthority.publicKey,
            [mintAuthority],
            takerAmount
        );

        let _initializerTokenAccountA = await mintA.getAccountInfo(
            initializerTokenAccountA
        );
        let _takerTokenAccountB = await mintB.getAccountInfo(
            takerTokenAccountB
        );

        assert.strictEqual(_initializerTokenAccountA.amount, initializerAmount);
        assert.strictEqual(_takerTokenAccountB.amount, takerAmount);
    });

    it("Initialize escrow", async () => {
        await program.rpc.initializeEscrow(
            new BN(initializerAmount),
            new BN(takerAmount),
            {
                accounts: {
                    initializer: provider.wallet.publicKey,
                    initializerDepositTokenAccount: initializerTokenAccountA,
                    initializerReceiveTokenAccount: initializerTokenAccountB,
                    escrowAccount: escrowAccount.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                signers: [escrowAccount],
            }
        );

        const [_pda, _nonce] = await PublicKey.findProgramAddress(
            [Buffer.from(anchor.utils.bytes.utf8.encode("escrow"))],
            program.programId
        );

        pda = _pda;

        let _initializerTokenAccountA = await mintA.getAccountInfo(
            initializerTokenAccountA
        );

        let _escrowAccount: EscrowAccount =
            await program.account.escrowAccount.fetch(escrowAccount.publicKey);

        assert.isTrue(_initializerTokenAccountA.owner.equals(pda));

        assert.isTrue(
            _escrowAccount.initializerKey.equals(provider.wallet.publicKey)
        );
        assert.strictEqual(
            _escrowAccount.initializerAmount.toNumber(),
            initializerAmount
        );
        assert.strictEqual(_escrowAccount.takerAmount.toNumber(), takerAmount);
        assert.isTrue(
            _escrowAccount.initializerDepositTokenAccount.equals(
                initializerTokenAccountA
            )
        );
        assert.isTrue(
            _escrowAccount.initializerReceiveTokenAccount.equals(
                initializerTokenAccountB
            )
        );
    });

    it("Exchange escrow", async () => {
        await program.rpc.exchange({
            accounts: {
                taker: provider.wallet.publicKey,
                takerDepositTokenAccount: takerTokenAccountB,
                takerReceiveTokenAccount: takerTokenAccountA,
                pdaDepositTokenAccount: initializerTokenAccountA,
                initializerReceiveTokenAccount: initializerTokenAccountB,
                initializerMainAccount: provider.wallet.publicKey,
                escrowAccount: escrowAccount.publicKey,
                pdaAccount: pda,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        });

        let _takerTokenAccountA = await mintA.getAccountInfo(
            takerTokenAccountA
        );
        let _takerTokenAccountB = await mintB.getAccountInfo(
            takerTokenAccountB
        );
        let _initializerTokenAccountA = await mintA.getAccountInfo(
            initializerTokenAccountA
        );
        let _initializerTokenAccountB = await mintB.getAccountInfo(
            initializerTokenAccountB
        );

        assert.isTrue(
            _takerTokenAccountA.owner.equals(provider.wallet.publicKey)
        );

        assert.strictEqual(_takerTokenAccountA.amount, initializerAmount);
        assert.strictEqual(_initializerTokenAccountA.amount, 0);
        assert.strictEqual(_initializerTokenAccountB.amount, takerAmount);
        assert.strictEqual(_takerTokenAccountB.amount, 0);
    });

    let newEscrow = Keypair.generate();

    it("Initialize escrow and cancel escrow", async () => {
        await mintA.mintTo(
            initializerTokenAccountA,
            mintAuthority.publicKey,
            [mintAuthority],
            initializerAmount
        );

        await program.rpc.initializeEscrow(
            new BN(initializerAmount),
            new BN(takerAmount),
            {
                accounts: {
                    initializer: provider.wallet.publicKey,
                    initializerDepositTokenAccount: initializerTokenAccountA,
                    initializerReceiveTokenAccount: initializerTokenAccountB,
                    escrowAccount: newEscrow.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                signers: [newEscrow],
            }
        );

        let _initializerTokenAccountA = await mintA.getAccountInfo(
            initializerTokenAccountA
        );

        assert.isTrue(_initializerTokenAccountA.owner.equals(pda));

        await program.rpc.cancelEscrow({
            accounts: {
                initializer: provider.wallet.publicKey,
                pdaDepositTokenAccount: initializerTokenAccountA,
                pdaAccount: pda,
                escrowAccount: newEscrow.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        });

        _initializerTokenAccountA = await mintA.getAccountInfo(
            initializerTokenAccountA
        );
        assert.isTrue(
            _initializerTokenAccountA.owner.equals(provider.wallet.publicKey)
        );

        assert.strictEqual(_initializerTokenAccountA.amount, initializerAmount);
    });
});
