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
  email: z.string().email({ message: 'Invalid email address.' }),
  ticker: z.string().min(1, 'Ticker required.').transform(v => v.toUpperCase()),
  quantity: z.coerce.number().positive('Quantity must be positive.'),
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
                title: 'Error',
                description: result.error,
            });
        } else {
            toast({
                title: 'Success',
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
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        } else {
            toast({ title: 'Success', description: result.success });
            cryptoForm.reset();
        }
        setLoadingAction(null);
    }

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Grant Crypto</CardTitle>
                    <CardDescription>Directly add crypto assets to a user's portfolio.</CardDescription>
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
                                            <FormLabel>User Email</FormLabel>
                                            <FormControl><Input placeholder="user@example.com" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={cryptoForm.control}
                                    name="ticker"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Crypto Ticker</FormLabel>
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
                                            <FormLabel>Quantity</FormLabel>
                                            <FormControl><Input type="number" step="any" placeholder="0.5" {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <Button type="submit" disabled={loadingAction !== null}>
                                {loadingAction === 'grantCrypto' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                                Grant Crypto
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Administration Panel</CardTitle>
                    <CardDescription>
                        Dangerous actions that affect the entire simulation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
                        <div>
                            <h3 className="font-semibold">Reset AI News</h3>
                            <p className="text-sm text-muted-foreground">
                                Deletes all AI-generated news articles.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={loadingAction !== null}>
                                {loadingAction === 'news' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Reset News
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action is irreversible. All AI-generated news will be permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleAction(resetAiNews, 'news')} disabled={loadingAction !== null} className="bg-destructive hover:bg-destructive/90">
                                {loadingAction === 'news' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Deletion
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
                        <div>
                            <h3 className="font-semibold">Reset Companies</h3>
                            <p className="text-sm text-muted-foreground">
                                Deletes all companies, their members, assets, and shares.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={loadingAction !== null}>
                                {loadingAction === 'companies' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Reset Companies
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action is irreversible. All companies and associated investments will be permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleAction(resetAllCompanies, 'companies')} disabled={loadingAction !== null} className="bg-destructive hover:bg-destructive/90">
                                {loadingAction === 'companies' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Deletion
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    
                    <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
                        <div>
                            <h3 className="font-semibold">Reset Users</h3>
                            <p className="text-sm text-muted-foreground">
                                Deletes all users, portfolios, and associated data. Requires new signup.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={loadingAction !== null}>
                                {loadingAction === 'users' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Reset Users
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                EXTREMELY DANGEROUS ACTION. This will delete ALL users, ALL companies, and ALL game data. The application will be reset to its initial state.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleAction(resetAllUsers, 'users')} disabled={loadingAction !== null} className="bg-destructive hover:bg-destructive/90">
                                {loadingAction === 'users' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                DELETE EVERYTHING
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
