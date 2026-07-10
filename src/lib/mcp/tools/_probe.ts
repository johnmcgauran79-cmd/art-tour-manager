import { assertFinancialAccess } from "./_financial";
export async function t(ctx: any) {
  const fin = await assertFinancialAccess(ctx);
  if (!fin.ok) return fin.error;
  return fin.value.roles;
}
