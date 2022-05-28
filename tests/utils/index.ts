import * as anchor from "@project-serum/anchor";
import serumCmn from "@project-serum/common";
import { TokenInstructions } from "@project-serum/serum";

const TOKEN_PROGRAM_ID = new anchor.web3.PublicKey(
    TokenInstructions.TOKEN_PROGRAM_ID.toString()
);

async function getTokenAccount(provider, addr) {
    return await serumCmn.getTokenAccount(provider, addr);
}

async function createMint(provider, authority) {
    if (authority === undefined) {
        authority = provider.wallet.publicKey;
    }
    const mint = anchor.web3.Keypair.generate();
    const instructions = await createMintInstructions(
        provider,
        authority,
        mint.publicKey
    );

    const tx = new anchor.web3.Transaction();
    tx.add(...instructions);

    await provider.send(tx, [mint]);

    return mint.publicKey;
}

async function createMintInstructions(provider, authority, mint) {
    let instructions = [
        anchor.web3.SystemProgram.createAccount({
            fromPubkey: provider.wallet.publicKey,
            newAccountPubkey: mint,
            space: 82,
            lamports:
                await provider.connection.getMinimumBalanceForRentExemption(82),
            programId: TOKEN_PROGRAM_ID,
        }),
        TokenInstructions.initializeMint({
            mint,
            decimals: 6,
            mintAuthority: authority,
        }),
    ];
    return instructions;
}

async function createTokenAccount(provider, mint, owner) {
    const vault = anchor.web3.Keypair.generate();
    const tx = new anchor.web3.Transaction();
    tx.add(
        ...(await createTokenAccountInstrs(
            provider,
            vault.publicKey,
            mint,
            owner,
            undefined
        ))
    );
    await provider.send(tx, [vault]);
    return vault.publicKey;
}

async function createTokenAccountInstrs(
    provider,
    newAccountPubkey,
    mint,
    owner,
    lamports
) {
    if (lamports === undefined) {
        lamports = await provider.connection.getMinimumBalanceForRentExemption(
            165
        );
    }
    return [
        anchor.web3.SystemProgram.createAccount({
            fromPubkey: provider.wallet.publicKey,
            newAccountPubkey,
            space: 165,
            lamports,
            programId: TOKEN_PROGRAM_ID,
        }),
        TokenInstructions.initializeAccount({
            account: newAccountPubkey,
            mint,
            owner,
        }),
    ];
}

async function mintToAccount(
    provider,
    mint,
    destination,
    amount,
    mintAuthority
) {
    // mint authority is the provider
    const tx = new anchor.web3.Transaction();
    tx.add(
        ...(await createMintToAccountInstrs(
            mint,
            destination,
            amount,
            mintAuthority
        ))
    );
    await provider.send(tx, []);
    return;
}

async function createMintToAccountInstrs(
    mint,
    destination,
    amount,
    mintAuthority
) {
    return [
        TokenInstructions.mintTo({
            mint,
            destination: destination,
            amount: amount,
            mintAuthority: mintAuthority,
        }),
    ];
}

export {
    TOKEN_PROGRAM_ID,
    getTokenAccount,
    createMint,
    createTokenAccount,
    mintToAccount,
};
