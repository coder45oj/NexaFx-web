"use client";

import { useState, useEffect, useRef } from "react";
import { Transaction, getTransactions } from "@/lib/api/transactions";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionList } from "@/components/transactions/transaction-list";
import { TransactionPagination } from "@/components/transactions/pagination";
import { TransactionEmptyState } from "@/components/transactions/empty-state";
import { TransactionDetails } from "@/components/transactions/transaction-details";
import { exportTransactionsToCSV, generateCSVFilename } from "@/app/lib/utils/csv-export";

const ITEMS_PER_PAGE = 10;

export default function TransactionsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");

    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryTrigger, setRetryTrigger] = useState(0);

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = (q: string) => {
        setSearchQuery(q);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setDebouncedSearch(q);
            setCurrentPage(1);
        }, 400);
    };

    const handleFilterChange = (f: string) => {
        setActiveFilter(f);
        setCurrentPage(1);
    };

    const handleDateFromChange = (date: string) => {
        setDateFrom(date);
        setCurrentPage(1);
    };

    const handleDateToChange = (date: string) => {
        setDateTo(date);
        setCurrentPage(1);
    };

    const handleClearDateRange = () => {
        setDateFrom("");
        setDateTo("");
        setCurrentPage(1);
    };

    useEffect(() => {
        let cancelled = false;

        const fetchTransactions = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getTransactions();
                if (!cancelled) {
                    setAllTransactions(data);
                }
            } catch {
                if (!cancelled) {
                    setError("Failed to load transactions");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        fetchTransactions();

        return () => {
            cancelled = true;
        };
    }, [retryTrigger]);

    // Client-side filtering logic
    const filteredTransactions = allTransactions.filter((tx) => {
        if (debouncedSearch) {
            const query = debouncedSearch.toLowerCase();
            const matchesType = tx.type.toLowerCase().includes(query);
            const matchesCurrency = tx.currency.toLowerCase().includes(query);
            const matchesToCurrency = tx.toCurrency?.toLowerCase().includes(query);
            const matchesAmount = tx.amount.toString().includes(query);
            const matchesStatus = tx.status.toLowerCase().includes(query);
            if (!matchesType && !matchesCurrency && !matchesToCurrency && !matchesAmount && !matchesStatus) {
                return false;
            }
        }

        if (activeFilter !== "All") {
            const typeParam = activeFilter === "Withdrawal" ? "Withdraw" : activeFilter;
            if (tx.type !== typeParam) return false;
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            const txDate = new Date(tx.createdAt);
            if (txDate < fromDate) return false;
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            const txDate = new Date(tx.createdAt);
            if (txDate > toDate) return false;
        }

        return true;
    });

    const totalItems = filteredTransactions.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const displayedTransactions = filteredTransactions.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleExportCSV = () => {
        if (filteredTransactions.length > 0) {
            const filename = generateCSVFilename(dateFrom, dateTo);
            exportTransactionsToCSV(filteredTransactions, filename);
        }
    };

    const handleTransactionClick = (tx: Transaction) => {
        setSelectedTransaction(tx);
        setDetailsOpen(true);
    };

    return (
        <div className="flex flex-col h-full space-y-4 md:space-y-6 max-w-7xl mx-auto w-full">
            <div className="bg-card rounded-xl p-4 md:p-6 shadow-sm border border-border/50">
                <TransactionFilters
                    searchQuery={searchQuery}
                    onSearchChange={handleSearchChange}
                    activeFilter={activeFilter}
                    onFilterChange={handleFilterChange}
                    totalCount={totalItems}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateFromChange={handleDateFromChange}
                    onDateToChange={handleDateToChange}
                    onClearDateRange={handleClearDateRange}
                    onExportCSV={handleExportCSV}
                />

                {isLoading ? (
                    <div className="space-y-4 animate-pulse pt-6">
                        <div className="hidden md:block rounded-md border bg-card overflow-hidden">
                            <div className="h-12 bg-muted/30 border-b border-border" />
                            <div className="divide-y divide-border">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex justify-between items-center px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-muted" />
                                            <div className="h-4 w-20 bg-muted rounded" />
                                        </div>
                                        <div className="h-4 w-12 bg-muted rounded" />
                                        <div className="h-4 w-24 bg-muted rounded" />
                                        <div className="h-6 w-16 bg-muted rounded-full" />
                                        <div className="h-4 w-20 bg-muted rounded ml-auto" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="md:hidden space-y-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-muted" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-24 bg-muted rounded" />
                                            <div className="h-3 w-16 bg-muted rounded" />
                                        </div>
                                    </div>
                                    <div className="h-6 w-16 bg-muted rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <button
                            onClick={() => {
                                setError(null);
                                setRetryTrigger((prev) => prev + 1);
                            }}
                            className="text-sm font-medium text-primary hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                ) : allTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 space-y-4 min-h-100 border rounded-lg bg-card">
                        <p className="text-lg font-medium text-muted-foreground">No transactions yet</p>
                    </div>
                ) : displayedTransactions.length > 0 ? (
                    <>
                        <TransactionTable
                            transactions={displayedTransactions}
                            onSelectTransaction={handleTransactionClick}
                        />
                        <TransactionList
                            transactions={displayedTransactions}
                            onSelectTransaction={handleTransactionClick}
                        />
                        <TransactionPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={totalItems}
                            itemsPerPage={ITEMS_PER_PAGE}
                        />
                    </>
                ) : (
                    <TransactionEmptyState />
                )}
            </div>

            <TransactionDetails
                transaction={selectedTransaction}
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
            />
        </div>
    );
}
