'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { claimCompanyBtc } from '@/lib/actions/companies';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';

export function ClaimBtcButton({ companyId }: { companyId: number }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();
    const { refreshPortfolio } = usePortfolio();

    const handleClaim = () => {
        startTransition(async () => {
            const result = await claimCompanyBtc(companyId);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erreur', description: result.error });
            } else {
                toast({ title: 'Succès !', description: result.success });
                await refreshPortfolio(); // Refresh client-side portfolio
                router.refresh(); // Refresh server components
            }
        });
    };

    return (
        <Button size="sm" className="mt-4 w-full" onClick={handleClaim} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Réclamer les BTC
        </Button>
    );
}
