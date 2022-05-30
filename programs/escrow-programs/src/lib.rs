use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, TokenAccount, SetAuthority};
use spl_token::instruction::AuthorityType;

declare_id!("2VdVJPpgQhdecDZsqVgJAeGUtrLiNjBGzgkjmowKqjmS");

#[program]
pub mod escrow_programs {
    use super::*;
    
    const ESCROW_PDA_SEED: &[u8] = b"escrow";

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
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

        token::set_authority(ctx.accounts.into(), AuthorityType::AccountOwner, Some(vault_authority))?;

        Ok(())
    }
    
    pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {

        let(_vault_auth, vault_auth_bump) =
            Pubkey::find_program_address(&[ESCROW_PDA_SEED], ctx.program_id);
        let authority_seeds = &[&ESCROW_PDA_SEED[..], &[vault_auth_bump]];

        token::set_authority(
            ctx.accounts.into_set_authority_context().
                with_signer(&[&authority_seeds[..]]),
            AuthorityType::AccountOwner, 
            Some(ctx.accounts.escrow_account.initializer_key),
        )?;

        Ok(())
    }

    pub fn exchange(ctx: Context<Exchange>) -> Result<()> {
        let (_vault_auth, vault_auth_bump) =
            Pubkey::find_program_address(&[ESCROW_PDA_SEED], ctx.program_id);
        let authority_seeds = &[&ESCROW_PDA_SEED[..], &[vault_auth_bump]];
        
        token::transfer(
            ctx.accounts.into_transfer_to_taker_context().with_signer(&[&authority_seeds[..]]),
            ctx.accounts.escrow_account.initializer_amount,
        )?;

        token::transfer(
            ctx.accounts.into_transfer_to_initializer_context(),
            ctx.accounts.escrow_account.taker_amount,
        )?;

        token::set_authority(
            ctx.accounts.into_set_authority_context().with_signer(&[&authority_seeds[..]]),
            AuthorityType::AccountOwner,
            Some(ctx.accounts.escrow_account.initializer_key),
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(initializer_amount: u64)]
pub struct InitializeEscrow<'info> {
    #[account(init, payer = initializer, space = 8 + EscrowAccount::LEN)]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(
        mut,
        constraint = initializer_deposit_token_account.amount >= initializer_amount
    )]
    pub initializer_deposit_token_account: Account<'info, TokenAccount>,

    pub initializer_receive_token_account: Account<'info, TokenAccount>,

    pub system_program: AccountInfo<'info>,

    pub token_program: AccountInfo<'info>,
}

impl<'info> From<&mut InitializeEscrow<'info>>
    for CpiContext<'_, '_, '_, 'info, SetAuthority<'info>>
{
    fn from(accounts: &mut InitializeEscrow<'info>) -> Self {
        let cpi_accounts = SetAuthority {
            account_or_mint: accounts.initializer_deposit_token_account.to_account_info().clone(),
            current_authority: accounts.initializer.to_account_info().clone(),
        };

        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(
        mut,
        constraint = escrow_account.initializer_key == *initializer.key,
        constraint = escrow_account.initializer_deposit_token_account == *pda_deposit_token_account.to_account_info().key,
        close = initializer,
    )]
    pub escrow_account: Box<Account<'info, EscrowAccount>>,

    pub pda_account: AccountInfo<'info>,

    pub initializer: AccountInfo<'info>,

    #[account(mut)]
    pub pda_deposit_token_account: Account<'info, TokenAccount>,

    pub token_program: AccountInfo<'info>,
}

impl<'info> CancelEscrow<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.pda_deposit_token_account.to_account_info().clone(),
            current_authority: self.pda_account.clone(),
        };

        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Exchange<'info> {
    #[account(
        mut,
        constraint = escrow_account.taker_amount <= taker_deposit_token_account.amount,
        constraint = 
            escrow_account.initializer_deposit_token_account == *pda_deposit_token_account.to_account_info().key,
        constraint =
            escrow_account.initializer_receive_token_account == *initializer_receive_token_account.to_account_info().key,
        constraint = escrow_account.initializer_key == *initializer_main_account.key,
        close = initializer_main_account
    )]
    pub escrow_account: Box<Account<'info, EscrowAccount>>,

    pub pda_account: AccountInfo<'info>,

    #[account(mut)]
    pub taker_deposit_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub taker_receive_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub pda_deposit_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub initializer_receive_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub initializer_main_account: AccountInfo<'info>,

    #[account(signer)]
    pub taker: AccountInfo<'info>,

    pub token_program: AccountInfo<'info>,
}

impl<'info> Exchange<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.pda_deposit_token_account.to_account_info().clone(),
            current_authority: self.pda_account.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_transfer_to_taker_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.pda_deposit_token_account.to_account_info().clone(),
            to: self.taker_receive_token_account.to_account_info().clone(),
            authority: self.pda_account.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_transfer_to_initializer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.taker_deposit_token_account.to_account_info().clone(),
            to: self.initializer_receive_token_account.to_account_info().clone(),
            authority: self.taker.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

#[account]
pub struct EscrowAccount {
    pub initializer_key: Pubkey,
    pub initializer_deposit_token_account: Pubkey,
    pub initializer_receive_token_account: Pubkey,
    pub initializer_amount: u64,
    pub taker_amount: u64,
}

impl EscrowAccount {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8;
}