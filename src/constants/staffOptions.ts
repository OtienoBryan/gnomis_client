// Fixed choices used when adding or editing staff
export const STAFF_DEPARTMENTS = [
  'Dispatch',
  'Production',
  'Transport',
  'Administration',
  'Sales and Marketing',
];

export const STAFF_DESIGNATIONS = [
  'Supervisor',
  'Production Assistant',
  'Machine Operator',
  'Dispatch Clerk',
  'Dispatch Manager',
  'Merchandising Supervisor',
  'Operations Manager',
  'HR',
  'Invoicing',
  'Stores Incharge',
  'Stock Inventory',
];

/** Options list that also keeps a staff member's existing value if it is no longer in the fixed list. */
export const withCurrent = (options: string[], current?: string | null) =>
  current && !options.includes(current) ? [...options, current] : options;
