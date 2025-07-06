'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { resetAiNews, resetAllCompanies, resetAllUsers } from '@/lib/actions/admin';
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
import { useRouter } from 'next/navigation';


export default function AdminPage() {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const handleAction = async (action: () => Promise<{ success?: string; error?: string }>, actionName: string) => {
        setLoadingAction(actionName);
        const result = await action();
        
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
            if (actionName === 'users') {
                router.push('/signup');
            }
        }
        setLoadingAction(null);
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
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
                        <div>
                            <h3 className="font-semibold">Réinitialiser les Actualités de l'IA</h3>
                            <p className="text-sm text-muted-foreground">
                                Supprime toutes les actualités générées par l'IA.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={loadingAction !== null}>
                                {loadingAction === 'news' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Réinitialiser les Actualités
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Toutes les actualités générées par l'IA seront définitivement supprimées.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleAction(resetAiNews, 'news')} disabled={loadingAction !== null} className="bg-destructive hover:bg-destructive/90">
                                {loadingAction === 'news' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmer la suppression
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
                        <div>
                            <h3 className="font-semibold">Réinitialiser les Entreprises</h3>
                            <p className="text-sm text-muted-foreground">
                                Supprime toutes les entreprises, leurs membres, leurs actifs et leurs actions.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={loadingAction !== null}>
                                {loadingAction === 'companies' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Réinitialiser les Entreprises
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Toutes les entreprises et les investissements associés seront définitivement supprimés.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleAction(resetAllCompanies, 'companies')} disabled={loadingAction !== null} className="bg-destructive hover:bg-destructive/90">
                                {loadingAction === 'companies' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmer la suppression
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    
                    <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
                        <div>
                            <h3 className="font-semibold">Réinitialiser les Utilisateurs</h3>
                            <p className="text-sm text-muted-foreground">
                                Supprime tous les utilisateurs, portefeuilles et données associées. Nécessite une nouvelle inscription.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={loadingAction !== null}>
                                {loadingAction === 'users' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Réinitialiser les Utilisateurs
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                ACTION EXTRÊMEMENT DANGEREUSE. Ceci supprimera TOUS les utilisateurs, TOUTES les entreprises, et TOUTES les données de jeu. L'application sera réinitialisée à son état initial.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleAction(resetAllUsers, 'users')} disabled={loadingAction !== null} className="bg-destructive hover:bg-destructive/90">
                                {loadingAction === 'users' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                TOUT SUPPRIMER
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
