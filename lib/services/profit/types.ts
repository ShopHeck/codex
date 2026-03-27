export type ProfitLineItem = {
  id: string;
  quantity: number;
  quantityFulfilled: number;
  quantityRefunded: number;
  unitPrice: number;
  cogsPerUnit: number;
  totalRevenue: number;
  productId?: string | null;
  variantId?: string | null;
};

export type ProfitRefund = {
  orderItemId: string | null;
  amount: number;
  shippingRefund: number;
  taxRefund: number;
  refundedQuantity: number;
};

export type ProfitShippingCost = {
  amount: number;
  isEstimated: boolean;
};

export type ProfitFee = {
  amount: number;
};

export type ProfitVariableCostRule = {
  costType: string;
  amount: number;
  isActive: boolean;
  productId?: string | null;
  variantId?: string | null;
};

export type ProfitAdEntry = {
  amount: number;
  channel: string;
};

export type ProfitInputs = {
  revenue: number;
  discounts: number;
  refunds: number;
  items: ProfitLineItem[];
  refundRecords: ProfitRefund[];
  shippingCosts: ProfitShippingCost[];
  fees: ProfitFee[];
  variableCostRules: ProfitVariableCostRule[];
  adEntriesForDay: ProfitAdEntry[];
  totalStoreRevenueForDay: number;
  defaultCogsPercent: number;
  paymentFeePercent: number;
  shopifyFeePercent: number;
  defaultShippingCost: number;
  averageShippingCost30d: number;
  attributionMode: string | null;
  attributionChannel: string | null;
  attributionAdSpendAmount: number;
};

export type LineItemAllocation = {
  itemId: string;
  grossRevenue: number;
  discountAllocated: number;
  refundAllocated: number;
  cogsAllocated: number;
  shippingAllocated: number;
  feeAllocated: number;
  adSpendAllocated: number;
  variableCostAllocated: number;
  netProfit: number;
  marginPercent: number;
};

export type ConfidenceInputs = {
  missingUnitCost: boolean;
  estimatedShippingUsed: boolean;
  noAdDataWhenExpected: boolean;
  missingFeeRule: boolean;
  incompleteRefundMapping: boolean;
};

export type ProfitComputation = {
  allocations: LineItemAllocation[];
  shippingCost: number;
  shippingSource: "exact" | "rules" | "average";
  paymentFees: number;
  shopifyFees: number;
  adSpendAllocation: number;
  variableCostTotal: number;
  cogs: number;
  contributionProfit: number;
  margin: number;
  totalCosts: number;
  confidenceScore: number;
  confidenceInputs: ConfidenceInputs;
};
