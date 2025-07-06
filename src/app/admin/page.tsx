'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { resetAiNews } from '@/lib/actions/admin';
import { Loader2, Trash2 } from 'lucide-react';
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


export default function AdminPage() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleResetNews = async () => {
        setIsLoading(true);
        const result = await resetAiNews();
        
        if (result.error) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: result.error,
            });
        } else {
            toast({
                title: 'Succès',
                description: result.success,
            });
        }
        setIsLoading(false);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Panneau d'Administration</CardTitle>
                    <CardDescription>
                        Actions dangereuses qui affectent l'ensemble de la simulation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
                        <div>
                            <h3 className="font-semibold">Réinitialiser les Actualités de l'IA</h3>
                            <p className="text-sm text-muted-foreground">
                                Supprime toutes les actualités générées par l'IA de la base de données. 
                                De nouvelles actualités seront générées lors de la prochaine visite d'une page d'actif.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Réinitialiser
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Toutes les actualités générées par l'IA seront définitivement supprimées.
                                Cela peut entraîner une augmentation des appels à l'API de l'IA car de nouvelles actualités devront être générées pour chaque actif.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={handleResetNews} disabled={isLoading} className="bg-destructive hover:bg-destructive/90">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmer la suppression
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
