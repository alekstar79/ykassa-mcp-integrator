import type {ClientConfig} from './config.js';
import type {ClientDefaults} from '@alekstar79/ykassa-contracts';
import {HttpError, isRecord} from './http.js';

type EnrichmentConfig = Pick<ClientConfig, 'defaults'> & {
  overrides?: Partial<ClientDefaults>;
};

export interface EnrichToolCallResult {
  args: Record<string, unknown>;
  appliedDefaults: string[];
}

export function enrichToolCall(
  toolName: string,
  args: Record<string, unknown>,
  config: EnrichmentConfig,
): EnrichToolCallResult {
  const enrichedArgs = { ...args };
  const appliedDefaults: string[] = [];
  const effectiveConfig: EnrichmentConfig = {
    defaults: { ...config.defaults, ...config.overrides },
    overrides: config.overrides,
  };

  if (toolName === 'create_payment') {
    enrichPayment(enrichedArgs, effectiveConfig, appliedDefaults);
  } else if (toolName === 'create_invoice') {
    enrichInvoice(enrichedArgs, effectiveConfig, appliedDefaults);
  } else if (toolName === 'get_payments' || toolName === 'get_refunds') {
    enrichDateFilter(enrichedArgs, appliedDefaults);
  }

  return { args: enrichedArgs, appliedDefaults };
}

function enrichPayment(
  args: Record<string, unknown>,
  config: EnrichmentConfig,
  appliedDefaults: string[],
): void {
  if (isRecord(args.amount)) {
    const amount = { ...args.amount };
    const formattedValue = formatAmountValue(amount.value);
    if (formattedValue !== undefined) amount.value = formattedValue;

    if (
      config.overrides?.currency !== undefined ||
      amount.currency === undefined
    ) {
      amount.currency = config.overrides?.currency ?? config.defaults.currency;
      appliedDefaults.push('amount.currency');
    }
    args.amount = amount;
  }

  if (config.overrides?.capture !== undefined || args.capture === undefined) {
    args.capture = config.overrides?.capture ?? config.defaults.capture;
    appliedDefaults.push('capture');
  }
}

function enrichInvoice(
  args: Record<string, unknown>,
  config: EnrichmentConfig,
  appliedDefaults: string[],
): void {
  let cart = args.cart;
  if (typeof cart === 'string') {
    try {
      cart = JSON.parse(cart);
    } catch {
      throw new HttpError(400, 'invalid cart format');
    }
  }

  if (cart !== undefined) {
    if (!Array.isArray(cart)) {
      throw new HttpError(400, 'invalid cart format');
    }
    args.cart = cart.map((item, index) => {
      if (!isRecord(item)) {
        throw new HttpError(400, 'invalid cart format');
      }
      return enrichCartItem(item, index, config, appliedDefaults);
    });
  } else {
    const description = args.description;
    const totalAmount = args.total_amount ?? args.amount;
    if (
      typeof description === 'string' &&
      description.trim() !== '' &&
      totalAmount !== undefined
    ) {
      const item: Record<string, unknown> = {
        description,
        amount: totalAmount,
      };
      args.cart = [enrichCartItem(item, 0, config, appliedDefaults)];
      appliedDefaults.push('cart');
      if (args.total_amount !== undefined) {
        args.amount = totalAmount;
        delete args.total_amount;
      }
    }
  }

  if (args.expires_at === undefined) {
    const expiryMilliseconds =
      config.defaults.invoice_expiry_days * 24 * 60 * 60 * 1000;
    args.expires_at = new Date(Date.now() + expiryMilliseconds).toISOString();
    appliedDefaults.push('expires_at');
  }
}

function enrichCartItem(
  item: Record<string, unknown>,
  index: number,
  config: EnrichmentConfig,
  appliedDefaults: string[],
): Record<string, unknown> {
  const enrichedItem = { ...item };
  if (enrichedItem.quantity === undefined) {
    enrichedItem.quantity = 1;
    appliedDefaults.push(`cart[${index}].quantity`);
  }
  if (
    config.overrides?.vat_code !== undefined ||
    enrichedItem.vat_code === undefined
  ) {
    enrichedItem.vat_code =
      config.overrides?.vat_code ?? config.defaults.vat_code;
    appliedDefaults.push(`cart[${index}].vat_code`);
  }
  if (
    config.overrides?.currency !== undefined ||
    enrichedItem.currency === undefined
  ) {
    enrichedItem.currency =
      config.overrides?.currency ?? config.defaults.currency;
    appliedDefaults.push(`cart[${index}].currency`);
  }
  return enrichedItem;
}

function enrichDateFilter(
  args: Record<string, unknown>,
  appliedDefaults: string[],
): void {
  if (typeof args.period !== 'string') return;

  const now = new Date();
  let createdAt: Date | undefined;
  if (args.period === 'today') {
    createdAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  } else if (args.period === 'week') {
    createdAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (args.period === 'month') {
    createdAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (createdAt !== undefined) {
    if (args.created_at_gte === undefined) {
      args.created_at_gte = createdAt.toISOString();
      appliedDefaults.push('created_at_gte');
    }
    if (args.created_at_lte === undefined) {
      args.created_at_lte = now.toISOString();
      appliedDefaults.push('created_at_lte');
    }
    delete args.period;
  }
}

function formatAmountValue(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toFixed(2) : undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : undefined;
}
