'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { resetAiNews, resetAllCompanies, resetAllUsers, addCryptoToUserByEmail } from '@/lib/actions/admin';
import { Loader2, Trash2, Coins } from 'lucide-react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const addCryptoSchema = z.object({
  email: z.string().email({ message: 'Adresse e-mail invalide.' }),
  ticker: z.string().min(1, 'Ticker requis.').transform(v => v.toUpperCase()),
  quantity: z.coerce.number().positive('La quantité doit être positive.'),
});


export default function AdminPage() {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const cryptoForm = useForm<z.infer<typeof addCryptoSchema>>({
        resolver: zodResolver(addCryptoSchema),
        defaultValues: { email: '', ticker: '', quantity: undefined },
    });

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

    async function handleGrantCrypto(values: z.infer<typeof addCryptoSchema>) {
        setLoadingAction('grantCrypto');
        const result = await addCryptoToUserByEmail(values);
        if (result.error) {
            toast({ variant: 'destructive', title: 'Erreur', description: result.error });
        } else {
            toast({ title: 'Succès', description: result.success });
            cryptoForm.reset();
        }
        setLoadingAction(null);
    }

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Accorder des Cryptos</CardTitle>
                    <CardDescription>Ajouter directement des actifs crypto au portefeuille d'un utilisateur.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...cryptoForm}>
                        <form onSubmit={cryptoForm.handleSubmit(handleGrantCrypto)} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <FormField
                                    control={cryptoForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email de l'utilisateur</FormLabel>
                                            <FormControl><Input placeholder="utilisateur@exemple.com" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={cryptoForm.control}
                                    name="ticker"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ticker Crypto</FormLabel>
                                            <FormControl><Input placeholder="BTC, ETH, etc." {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={cryptoForm.control}
                                    name="quantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Quantité</FormLabel>
                                            <FormControl><Input type="number" step="any" placeholder="0.5" {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <Button type="submit" disabled={loadingAction !== null}>
                                {loadingAction === 'grantCrypto' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                                Accorder la Crypto
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

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
