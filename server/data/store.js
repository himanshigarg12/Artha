export const accounts = [
  { id: "acc-1", name: "Cash Wallet", type: "cash", balance: 5000, currency: "INR" },
  { id: "acc-2", name: "HDFC Credit Card", type: "credit", balance: 12000, currency: "INR" },
  { id: "acc-3", name: "Zerodha Portfolio", type: "investment", balance: 80000, currency: "INR" },
  { id: "acc-4", name: "Education Loan", type: "loan", balance: 150000, currency: "INR" },
];
export const transactions = [];

export const budgets = [
  { id: "bud-1", category: "Food & Dining", limit: 2000, period: "monthly" },
  { id: "bud-2", category: "Transportation", limit: 1500, period: "monthly" },
  { id: "bud-3", category: "Entertainment", limit: 1000, period: "monthly" },
];

export const alerts = [];

export const holdings = [
  { id: "inv-1", symbol: "RELIANCE", name: "Reliance Industries", assetType: "stock", quantity: 10, buyPrice: 2400, currentPrice: 2550, account: "acc-3" },
  { id: "inv-2", symbol: "NIFTYBEES", name: "Nifty 50 Index Fund", assetType: "mutual_fund", quantity: 100, buyPrice: 150, currentPrice: 165, account: "acc-3" },
  { id: "inv-3", symbol: "GOLDBEES", name: "Gold ETF", assetType: "gold", quantity: 200, buyPrice: 55, currentPrice: 53, account: "acc-3" },
];