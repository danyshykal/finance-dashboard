// Colors come from a colorblind-safe palette, assigned in a fixed order
// within each type (the client swaps in matching dark-mode shades).
export const DEFAULT_CATEGORIES = [
  { name: 'Salary', type: 'income', color: '#2a78d6' },
  { name: 'Freelance', type: 'income', color: '#eb6834' },
  { name: 'Food', type: 'expense', color: '#2a78d6' },
  { name: 'Rent', type: 'expense', color: '#eb6834' },
  { name: 'Transport', type: 'expense', color: '#1baf7a' },
  { name: 'Shopping', type: 'expense', color: '#eda100' },
  { name: 'Bills', type: 'expense', color: '#e87ba4' },
  { name: 'Entertainment', type: 'expense', color: '#008300' },
];

// Gives a new user a starter set of categories.
export async function createDefaultCategories(client, userId) {
  const rows = [];
  const params = [userId];
  for (const c of DEFAULT_CATEGORIES) {
    params.push(c.name, c.type, c.color);
    const n = params.length;
    rows.push(`($1, $${n - 2}, $${n - 1}, $${n})`);
  }
  await client.query(
    `INSERT INTO categories (user_id, name, type, color) VALUES ${rows.join(', ')}`,
    params,
  );
}
