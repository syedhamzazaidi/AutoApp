/** Stub — enable via blocks:activate payments */
export async function createCheckoutSession(_priceId: string): Promise<{ url: string }> {
  throw new Error("Payments block is not enabled. Connect Stripe keys and activate the payments block.");
}

export function PricingTable() {
  return <div className="text-muted-foreground">Payments not configured</div>;
}
