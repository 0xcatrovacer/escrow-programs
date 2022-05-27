import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { EscrowPrograms } from '../target/types/escrow_programs';

describe('escrow-programs', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.EscrowPrograms as Program<EscrowPrograms>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
