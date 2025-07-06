'use client';
import { Button } from './ui/button';
import { listCompanyOnMarket } from '@/lib/actions/companies';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"
import { useMarketData } from '@/context/market-data-context';

export function ListCompanyButton({ companyId }: { companyId: number }) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { refreshData } = useMarketData();

    const handleList = async () => {
        setIsLoading(true);
        const result = await listCompanyOnMarket(companyId);
        if (result.error) {
            toast({ variant: 'destructive', title: 'Erreur', description: result.error });
        } else {
            toast({ title: 'Succès !', description: result.success });
            await refreshData();
            router.refresh();
        }
        setIsLoading(false);
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Mettre en Bourse
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Mettre l'entreprise en bourse ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible. Une fois cotée, les actions de votre entreprise apparaîtront dans la Salle des Marchés et pourront être échangées par tous les joueurs. Le prix de l'action sera déterminé par la valeur totale de l'entreprise (trésorerie + actifs).
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleList} disabled={isLoading}>
                         {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmer la Cotation
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
