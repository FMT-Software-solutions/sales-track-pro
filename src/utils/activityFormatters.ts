import { format } from 'date-fns';

// Types for activity data
interface ActivityValue {
  [key: string]: any;
}

interface SaleLineItemSnapshot {
  id?: string;
  product_id?: string;
  product_name?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  description?: string;
}

interface SaleSnapshot {
  id?: string;
  amount?: number;
  sale_date?: string;
  customer_name?: string;
  notes?: string;
  branch_id?: string;
  branch_name?: string;
  sale_line_items?: SaleLineItemSnapshot[];
}



/**
 * Formats currency values with the organization's currency symbol
 */
export function formatCurrency(amount: number | string | null | undefined, currency = 'GH₵'): string {
  if (amount === null || amount === undefined) return 'N/A';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return 'N/A';
  return `${currency} ${numAmount.toFixed(2)}`;
}

/**
 * Formats date values in a user-friendly way
 */
export function formatActivityDate(dateValue: string | null | undefined): string {
  if (!dateValue) return 'N/A';
  try {
    return format(new Date(dateValue), 'MMM dd, yyyy HH:mm');
  } catch {
    return dateValue;
  }
}

/**
 * Formats sale line items for display
 */
export function formatSaleLineItems(items: SaleLineItemSnapshot[] | any[] | null | undefined): string {
  if (!items || items.length === 0) return 'No items';
  
  if (items.length === 1) {
    const item = items[0];
    // Handle both nested products structure and flattened product_name structure
    const productName = item.product_name || item.products?.name || 'Unknown Product';
    return `${productName} (Qty: ${item.quantity || 0}, ${formatCurrency(item.unit_price)})`;
  }
  
  return `${items.length} items: ${items.map(item => {
    // Handle both nested products structure and flattened product_name structure
    const productName = item.product_name || item.products?.name || 'Unknown Product';
    return `${productName} (${item.quantity || 0})`;
  }).join(', ')}`;
}

/**
 * Formats item changes object for activity display
 */
export function formatItemChanges(changes: any): string {
  if (!changes || typeof changes !== 'object') return 'No item changes';
  
  const changesSummary: string[] = [];
  
  // Handle created items
  if (changes.created && Array.isArray(changes.created)) {
    changes.created.forEach((item: any) => {
      changesSummary.push(`Added: ${item.product_name || 'Unknown Product'} (Qty: ${item.quantity || 0})`);
    });
  }
  
  // Handle updated items
  if (changes.updated && Array.isArray(changes.updated)) {
    changes.updated.forEach((change: any) => {
      const parts: string[] = [];
      if (change.old?.quantity !== change.new?.quantity) {
        parts.push(`Qty: ${change.old?.quantity || 0} → ${change.new?.quantity || 0}`);
      }
      if (change.old?.unit_price !== change.new?.unit_price) {
        parts.push(`Price: ${formatCurrency(change.old?.unit_price)} → ${formatCurrency(change.new?.unit_price)}`);
      }
      const productName = change.new?.product_name || change.old?.product_name || 'Unknown Product';
      changesSummary.push(`Updated ${productName}: ${parts.join(', ')}`);
    });
  }
  
  // Handle deleted items
  if (changes.deleted && Array.isArray(changes.deleted)) {
    changes.deleted.forEach((item: any) => {
      changesSummary.push(`Removed: ${item.product_name || 'Unknown Product'} (Qty: ${item.quantity || 0})`);
    });
  }
  
  return changesSummary.length > 0 ? changesSummary.join('; ') : 'No item changes';
}

/**
 * Formats sale data for activity display
 */
export function formatSaleActivity(values: ActivityValue | null | undefined): string {
  if (!values) return 'N/A';
  
  const parts: string[] = [];
  
  if (values.amount !== undefined) {
    parts.push(`Amount: ${formatCurrency(values.amount)}`);
  }
  
  if (values.customer_name !== undefined) {
    parts.push(`Customer: ${values.customer_name || 'Unknown'}`);
  }
  
  if (values.notes !== undefined) {
    parts.push(`Notes: ${values.notes || 'None'}`);
  }
  
  if (values.sale_date !== undefined) {
    parts.push(`Date: ${formatActivityDate(values.sale_date)}`);
  }
  
  if (values.branch_name !== undefined) {
    parts.push(`Branch: ${values.branch_name}`);
  }
  
  if (values.sale_line_items !== undefined) {
    parts.push(`Items: ${formatSaleLineItems(values.sale_line_items)}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

/**
 * Formats product data for activity display
 */
export function formatProductActivity(values: ActivityValue | null | undefined): string {
  if (!values) return 'N/A';
  
  const parts: string[] = [];
  
  if (values.name !== undefined) {
    parts.push(`Name: ${values.name}`);
  }
  
  if (values.price !== undefined) {
    parts.push(`Price: ${formatCurrency(values.price)}`);
  }
  
  if (values.description !== undefined) {
    parts.push(`Description: ${values.description || 'No description'}`);
  }
  
  if (values.category !== undefined) {
    parts.push(`Category: ${values.category || 'No category'}`);
  }
  
  if (values.is_active !== undefined) {
    parts.push(`Status: ${values.is_active ? 'Active' : 'Inactive'}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

/**
 * Formats branch data for activity display
 */
export function formatBranchActivity(values: ActivityValue | null | undefined): string {
  if (!values) return 'N/A';
  
  const parts: string[] = [];
  
  if (values.name !== undefined) {
    parts.push(`Name: ${values.name}`);
  }
  
  if (values.location !== undefined) {
    parts.push(`Location: ${values.location}`);
  }
  
  if (values.is_active !== undefined) {
    parts.push(`Status: ${values.is_active ? 'Active' : 'Inactive'}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

/**
 * Formats user data for activity display
 */
export function formatUserActivity(values: ActivityValue | null | undefined): string {
  if (!values) return 'N/A';
  
  const parts: string[] = [];
  
  if (values.full_name !== undefined) {
    parts.push(`Name: ${values.full_name}`);
  }
  
  if (values.email !== undefined) {
    parts.push(`Email: ${values.email}`);
  }
  
  if (values.role !== undefined) {
    parts.push(`Role: ${values.role}`);
  }
  
  if (values.branch_id !== undefined) {
    if (values.branch_id === null) {
      parts.push(`Branch: No branch assigned`);
    } else {
      // If branch name is available (from joined data), use it
      if (values.branch_name) {
        parts.push(`Branch: ${values.branch_name}`);
      } else {
        parts.push(`Branch ID: ${values.branch_id}`);
      }
    }
  }
  
  if (values.is_active !== undefined) {
    parts.push(`Status: ${values.is_active ? 'Active' : 'Inactive'}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

/**
 * Main formatter function that routes to appropriate formatter based on entity type
 */
/**
 * Converts underscore keys to friendly labels
 */
function formatKeyToLabel(key: string): string {
  const keyMappings: { [key: string]: string } = {
    'item_changes': 'Item Changes',
    'changes_detected': 'Changes Detected',
    'correction_reason': 'Correction Reason',
    'total_items_after': 'Total Items After',
    'total_items_before': 'Total Items Before',
    'customer_name': 'Customer Name',
    'sale_date': 'Sale Date',
    'branch_id': 'Branch ID',
    'branch_name': 'Branch Name',
    'user_id': 'User ID',
    'created_at': 'Created At',
    'updated_at': 'Updated At'
  };
  
  // Return mapped label if exists, otherwise convert underscore to title case
  if (keyMappings[key]) {
    return keyMappings[key];
  }
  
  // Convert snake_case to Title Case
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatActivityValues(values: ActivityValue | null | undefined, entityType?: string): string {
  if (!values) return 'N/A';

  delete values.id;
  delete values.branch_id;
  delete values.created_by;
  delete values.expense_category_id;
  delete values.organization_id;
  delete values.sale_id;
  delete values.user_id;
  delete values.last_updated_by;
  delete values.category_id;
  delete values.is_active;
  
  switch (entityType?.toLowerCase()) {
    case 'sale':
    case 'sales':
      return formatSaleActivity(values);
    case 'product':
    case 'products':
      return formatProductActivity(values);
    case 'branch':
    case 'branches':
      return formatBranchActivity(values);
    case 'user':
    case 'users':
    case 'user_profile':
    case 'user_profiles':
      return formatUserActivity(values);
    default:
      // Generic formatter for unknown entity types
      const parts: string[] = [];
      
      Object.entries(values).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          const friendlyLabel = formatKeyToLabel(key);
          
          // Format common field types
          if (key.includes('date') || key.includes('time')) {
            parts.push(`${friendlyLabel}: ${formatActivityDate(value)}`);
          } else if (key.includes('amount') || key.includes('price') || key.includes('cost')) {
            parts.push(`${friendlyLabel}: ${formatCurrency(value)}`);
          } else if (typeof value === 'boolean') {
            parts.push(`${friendlyLabel}: ${value ? 'Yes' : 'No'}`);
          } else if (key === 'item_changes' && typeof value === 'object') {
            // Special handling for item_changes object
            parts.push(`${friendlyLabel}: ${formatItemChanges(value)}`);
          } else if (key === 'changes_detected' && typeof value === 'object') {
            // Special handling for changes_detected object
            const changesList = Object.entries(value)
              .filter(([_, changed]) => changed === true)
              .map(([field, _]) => field)
              .join(', ');
            parts.push(`${friendlyLabel}: ${changesList || 'None'}`);
          } else if (key === 'items' && Array.isArray(value)) {
            // Special handling for items array
            parts.push(`${friendlyLabel}: ${formatSaleLineItems(value)}`);
          } else if (typeof value === 'object') {
            // Skip other complex objects to avoid JSON display
            parts.push(`${friendlyLabel}: [Object]`);
          } else {
            parts.push(`${friendlyLabel}: ${value}`);
          }
        }
      });
      
      return parts.length > 0 ? parts.join(', ') : 'No changes';
  }
}

/**
 * Creates a detailed snapshot of sale line items for activity logging
 */
export function createSaleLineItemSnapshot(items: any[]): SaleLineItemSnapshot[] {
  return items.map(item => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.products?.name || item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    description: item.description
  }));
}

/**
 * Creates a detailed snapshot of sale data for activity logging
 */
export function createSaleSnapshot(sale: any): SaleSnapshot {
  return {
    id: sale.id,
    amount: sale.amount,
    sale_date: sale.sale_date,
    customer_name: sale.customer_name,
    notes: sale.notes,
    branch_id: sale.branch_id,
    branch_name: sale.branches?.name || sale.branch_name,
    sale_line_items: sale.sale_line_items ? createSaleLineItemSnapshot(sale.sale_line_items) : undefined
  };
}

/**
 * Detects what fields have changed between old and new sale data
 */
export function detectSaleChanges(oldSale: any, newSale: any, itemChanges: any) {
  // Helper function to normalize values for comparison
  const normalizeValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    // Trim string values to handle whitespace
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  };
  
  const changes = {
    amount: oldSale.amount !== newSale.amount,
    customer: normalizeValue(oldSale.customer_name) !== normalizeValue(newSale.customer_name),
    notes: normalizeValue(oldSale.notes) !== normalizeValue(newSale.notes),
    date: normalizeValue(oldSale.sale_date) !== normalizeValue(newSale.sale_date),
    branch: normalizeValue(oldSale.branch_id) !== normalizeValue(newSale.branch_id),
    items: itemChanges.created.length > 0 || itemChanges.updated.length > 0 || itemChanges.deleted.length > 0
  };
  
  return changes;
}

/**
 * Checks if any actual changes were made to the sale
 */
export function hasAnyChanges(changes: any): boolean {
  return Object.values(changes).some(changed => changed === true);
}

/**
 * Generates a dynamic activity title based on what was changed
 */
export function generateSaleActivityTitle(changes: any, oldSale: any, newSale: any, currency: string = 'GH₵'): string {
  const changedFields = [];
  
  if (changes.amount) {
    changedFields.push(`amount from ${currency}${oldSale.amount?.toFixed(2)} to ${currency}${newSale.amount?.toFixed(2)}`);
  }
  
  if (changes.customer) {
    const oldCustomer = oldSale.customer_name || null;
    const newCustomer = newSale.customer_name || null;
    
    if (oldCustomer === null && newCustomer) {
      changedFields.push(`customer added: "${newCustomer}"`);
    } else if (oldCustomer && newCustomer === null) {
      changedFields.push(`customer removed: "${oldCustomer}"`);
    } else {
      changedFields.push(`customer from "${oldCustomer || 'Unknown'}" to "${newCustomer || 'Unknown'}"`);
    }
  }
  
  if (changes.notes) {
    const oldNotes = oldSale.notes || null;
    const newNotes = newSale.notes || null;
    
    if (oldNotes === null && newNotes) {
      changedFields.push(`notes added: "${newNotes}"`);
    } else if (oldNotes && newNotes === null) {
      changedFields.push(`notes removed: "${oldNotes}"`);
    } else {
      changedFields.push(`notes from "${oldNotes || 'None'}" to "${newNotes || 'None'}"`);
    }
  }
  
  if (changes.date) {
    changedFields.push(`date from ${formatActivityDate(oldSale.sale_date)} to ${formatActivityDate(newSale.sale_date)}`);
  }
  
  if (changes.branch) {
    const oldBranch = oldSale.branch_name || 'Unknown branch';
    const newBranch = newSale.branch_name || 'Unknown branch';
    changedFields.push(`branch from "${oldBranch}" to "${newBranch}"`);
  }
  
  if (changes.items) {
    changedFields.push('sale items modified');
  }
  
  if (changedFields.length === 0) {
    return 'Sale updated with no changes';
  }
  
  if (changedFields.length === 1) {
    return `Sale updated - ${changedFields[0]}`;
  }
  
  if (changedFields.length === 2) {
    return `Sale updated - ${changedFields[0]} and ${changedFields[1]}`;
  }
  
  // For 3 or more changes, use a more concise format
  return `Sale updated - ${changedFields.slice(0, -1).join(', ')}, and ${changedFields[changedFields.length - 1]}`;
}