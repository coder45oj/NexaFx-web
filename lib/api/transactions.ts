import { apiClient } from '../api-client';

export type TransactionType = 'Deposit' | 'Withdraw' | 'Convert';
export type TransactionStatus = 'Success' | 'Failed' | 'Pending';

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  toAmount?: number;       // only present for Convert transactions
  toCurrency?: string;     // only present for Convert transactions
  createdAt: string;

  // Compatibility fields
  date?: string;
  amountString?: string;
  reference?: string;
  description?: string;
  fee?: number;
  exchangeRate?: number;
}

export interface TransactionQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    from?: string;
    to?: string;
}

export interface PaginatedTransactions {
    data: Transaction[];
    total: number;
    page: number;
    limit: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransaction(dto: Record<string, any>): Transaction {
    const typeMap: Record<string, TransactionType> = {
        deposit: 'Deposit',
        withdrawal: 'Withdraw',
        withdraw: 'Withdraw',
        convert: 'Convert',
        conversion: 'Convert',
        exchange: 'Convert',
    };
    const statusMap: Record<string, TransactionStatus> = {
        success: 'Success',
        pending: 'Pending',
        failed: 'Failed',
    };

    const type =
        typeMap[(dto.type as string)?.toLowerCase()] ?? (dto.type as TransactionType);
    const status =
        statusMap[(dto.status as string)?.toLowerCase()] ?? (dto.status as TransactionStatus);

    const amount = Number(dto.amount) || 0;
    const currency = (dto.currency as string) ?? '';

    let amountString = `${amount.toLocaleString()} ${currency}`;
    if (type === 'Deposit') amountString = `+ ${amountString}`;
    else if (type === 'Withdraw') amountString = `- ${amountString}`;

    const rawDate = (dto.createdAt ?? dto.date ?? dto.created_at) as string;
    const date = rawDate
        ? new Date(rawDate).toLocaleString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';

    return {
        id: (dto.id ?? dto._id) as string,
        type,
        currency,
        toCurrency: (dto.toCurrency ?? dto.to_currency) as string | undefined,
        amount,
        amountString,
        date,
        status,
        reference: (dto.reference ?? dto.transactionRef ?? dto.transaction_ref ?? '') as string,
        description: dto.description as string | undefined,
        fee: dto.fee as number | undefined,
        exchangeRate: (dto.exchangeRate ?? dto.exchange_rate) as number | undefined,
        toAmount: (dto.toAmount ?? dto.to_amount) as number | undefined,
        createdAt: rawDate || new Date().toISOString(),
    };
}

export const getTransactions = async (): Promise<Transaction[]> => {
    const json = await apiClient<unknown>('/transactions');

    let rawData: unknown[] = [];
    if (Array.isArray(json)) {
        rawData = json;
    } else if (json && typeof json === 'object' && json !== null) {
        const obj = json as Record<string, unknown>;
        rawData = (obj.data ?? obj.transactions ?? obj.items ?? []) as unknown[];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rawData.map((dto) => mapTransaction(dto as Record<string, any>));
};

export async function getTransactionById(id: string): Promise<Transaction> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await apiClient<any>(`/transactions/${id}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dto = (json.data ?? json) as Record<string, any>;
    return mapTransaction(dto);
}

// ==================== Withdrawal ====================

// Confirmed against backend src/transactions/dtos/transaction.dto.ts:
// - field is `destinationAddress` (not `walletAddress`)
// - `amount` must be a number, not a string
// - `beneficiaryId` and `walletId` are optional alternative targeting fields
export interface CreateWithdrawalDto {
    currency: string;
    amount: number;
    destinationAddress?: string;
    beneficiaryId?: string;
    walletId?: string;
}

export interface WithdrawalResponse {
    transactionId: string;
    status: 'pending' | 'success' | 'failed';
    message?: string;
}

export async function createWithdrawal(
    data: CreateWithdrawalDto
): Promise<WithdrawalResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await apiClient<any>('/transactions/withdraw', {
        method: 'POST',
        body: JSON.stringify(data),
    });

    // Normalize response - backend may use different field names
    const transactionId = (json.transactionId ??
        json.transaction_id ??
        json.id ??
        json.data?.id ??
        json.data?.transactionId) as string;

    const status = (json.status ?? json.data?.status ?? 'pending') as
        | 'pending'
        | 'success'
        | 'failed';

    return {
        transactionId,
        status,
        message: json.message as string | undefined,
    };
}

// ==================== Deposit ====================

export interface CreateDepositDto {
    amount: string;
    currency: string;
}

export interface DepositResponse {
    transactionId: string;
    status: 'pending' | 'success' | 'failed';
    walletAddress?: string;
    message?: string;
}

export async function createDeposit(
    data: CreateDepositDto
): Promise<DepositResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await apiClient<any>('/transactions/deposit', {
        method: 'POST',
        body: JSON.stringify(data),
    });

    // Normalize response - backend may use different field names
    const transactionId = (json.transactionId ??
        json.transaction_id ??
        json.id ??
        json.data?.id ??
        json.data?.transactionId) as string;

    const status = (json.status ?? json.data?.status ?? 'pending') as
        | 'pending'
        | 'success'
        | 'failed';

    return {
        transactionId,
        status,
        walletAddress: (json.walletAddress ?? json.wallet_address ?? json.address) as string | undefined,
        message: json.message as string | undefined,
    };
}

// ==================== Swap ====================

export interface CreateSwapDto {
    fromCurrency: string;
    toCurrency: string;
    amount: string;
}

export interface SwapResponse {
    transactionId: string;
    status: 'pending' | 'success' | 'failed';
    toAmount?: number;
    exchangeRate?: number;
    message?: string;
}

export async function createSwap(data: CreateSwapDto): Promise<SwapResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await apiClient<any>('/transactions/swap', {
        method: 'POST',
        body: JSON.stringify(data),
    });

    const transactionId = (json.transactionId ??
        json.transaction_id ??
        json.id ??
        json.data?.id ??
        json.data?.transactionId) as string;

    const status = (json.status ?? json.data?.status ?? 'pending') as
        | 'pending'
        | 'success'
        | 'failed';

    return {
        transactionId,
        status,
        toAmount: json.toAmount ?? json.to_amount,
        exchangeRate: json.exchangeRate ?? json.exchange_rate,
        message: json.message as string | undefined,
    };
}