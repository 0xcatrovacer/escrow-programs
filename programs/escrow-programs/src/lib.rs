use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Transfer, TokenAccount, SetAuthority};
use spl_token::instruction::AuthorityType;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod escrow_programs {
    use super::*;
    
    const ESCROW_PDA_SEED: &[u8] = b"escrow";

    pub fn initialize(
        ctx: Context<Initialize>,
        initializer_amount: u64,
        taker_amount: u64,
    ) -> Result<()> {

        let escrow_account = &mut ctx.accounts.escrow_account;
        let initializer = &mut ctx.accounts.initializer;
        let initializer_deposit = &mut ctx.accounts.initializer_deposit_token_account;
        let initializer_receive = &mut ctx.accounts.initializer_receive_token_account;

        escrow_account.initializer_key = *initializer.key;
        escrow_account.initializer_deposit_token_account = *initializer_deposit.to_account_info().key;
        escrow_account.initializer_receive_token_account = *initializer_receive.to_account_info().key;
        escrow_account.initializer_amount = initializer_amount;
        escrow_account.taker_amount = taker_amount;

        let (vault_authority, _vault_auth_bump) = 
            Pubkey::find_program_address(&[ESCROW_PDA_SEED], ctx.program_id);

        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(vault_authority),
        )?;

        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            ctx.accounts.escrow_account.initializer_amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(initializer_amount: u64)]
pub struct Initialize<'info> {
    #[account(zero)]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(
        init,
        seeds = [b"token-seeds".as_ref()],
        bump,
        payer = initializer,
        token::mint = mint,
        token::authority = initializer
    )]
    pub vault_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,

    #[account(
        mut,
        constraint = initializer_deposit_token_account.amount >= initializer_amount
    )]
    pub initializer_deposit_token_account: Account<'info, TokenAccount>,

    pub initializer_receive_token_account: Account<'info, TokenAccount>,

    pub system_program: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,

    pub token_program: AccountInfo<'info>,
}

impl<'info> Initialize<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.vault_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.initializer_deposit_token_account.to_account_info().clone(),
            to: self.vault_account.to_account_info().clone(),
            authority: self.initializer.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        mut,
        constraint = escrow_account.initializer_key == *initializer.key,
        constraint = escrow_account.initializer_deposit_token_account == *initializer_deposit_token_account.to_account_info().key,
        close = initializer,
    )]
    pub escrow_account: Box<Account<'info, EscrowAccount>>,

    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,

    pub vault_authority: AccountInfo<'info>,

    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,

    #[account(mut)]
    pub initializer_deposit_token_account: Account<'info, TokenAccount>,

    pub token_program: AccountInfo<'info>,
}

#[account]
pub struct EscrowAccount {
    pub initializer_key: Pubkey,
    pub initializer_deposit_token_account: Pubkey,
    pub initializer_receive_token_account: Pubkey,
    pub initializer_amount: u64,
    pub taker_amount: u64,
}