import { Storefront } from '@/components/storefront';

export const dynamic = 'force-dynamic';

export default async function ShopStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Storefront slug={slug} />;
}
