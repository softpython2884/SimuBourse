'use client';

import { useMemo, useEffect } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePortfolio } from "@/context/portfolio-context";
import { useMarketData } from "@/context/market-data-context";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";

const profileFormSchema = z.object({
  displayName: z.string().min(3, { message: "Le nom d'utilisateur doit comporter au moins 3 caractères." }),
  phoneNumber: z.string().optional(),
});


export default function ProfileClientPage() {
    const { user } = useAuth();
    const { userProfile, updateUserProfile, transactions, cash, holdings, initialCash } = usePortfolio();
    const { getAssetByTicker } = useMarketData();

    const form = useForm<z.infer<typeof profileFormSchema>>({
      resolver: zodResolver(profileFormSchema),
      values: { 
        displayName: userProfile?.displayName || '',
        phoneNumber: userProfile?.phoneNumber || '',
      },
    });

    const getInitials = (displayName: string | undefined) => {
        if (!displayName) return 'U';
        return displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    // La logique de calcul sera rétablie avec les données de PostgreSQL.
    const allAssetsPerformance = []; 
    const portfolioValue = initialCash;
    const totalGains = 0;
    const totalGainsPercentage = 0;

    async function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
      await updateUserProfile(values);
    }

    if (!user && !userProfile) {
        return (
            <div className="text-center">
                <p>Veuillez vous connecter pour voir votre profil.</p>
            </div>
        )
    }

  return (
    <Tabs defaultValue="overview">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="overview">Aperçu</TabsTrigger>
        <TabsTrigger value="settings">Paramètres & Sécurité</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                      Profil
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarFallback>{getInitials(userProfile?.displayName)}</AvatarFallback>
                  </Avatar>
                  <h2 className="text-2xl font-bold">{userProfile?.displayName}</h2>
                  <p className="text-muted-foreground">{userProfile?.email}</p>
                  <p className="text-muted-foreground">{userProfile?.phoneNumber}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Statistiques</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valeur Totale du Portefeuille</span>
                    <span className="font-bold">${portfolioValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gains Totaux</span>
                    <span className={`font-bold ${totalGains >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {totalGains >= 0 ? '+' : '-'}${Math.abs(totalGains).toFixed(2)} ({totalGainsPercentage.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taux de Victoire (Paris)</span>
                    <span className="font-bold">N/A</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Historique des Transactions</CardTitle>
                  <CardDescription>Un journal de toutes vos activités de trading récentes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Actif/Détails</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Prix</TableHead>
                        <TableHead>Valeur</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                            Aucune transaction pour le moment.
                          </TableCell>
                        </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

               <Card>
                <CardHeader>
                  <CardTitle>Gains & Pertes par Actif</CardTitle>
                  <CardDescription>Performance de vos actifs actuels et passés.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Actif</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Valeur Actuelle</TableHead>
                        <TableHead>Gains/Pertes</TableHead>
                      </TableRow>
                    </TableHeader>
                     <TableBody>
                        <TableRow>
                          <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                             Aucun historique d'actifs.
                          </TableCell>
                        </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

            </div>
          </div>
      </TabsContent>

      <TabsContent value="settings">
          <Card>
              <CardHeader>
                  <CardTitle>Modifier le Profil</CardTitle>
              </CardHeader>
              <CardContent>
                  <Form {...form}>
                      <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-4 max-w-lg">
                          <FormField
                              control={form.control}
                              name="displayName"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Nom d'utilisateur</FormLabel>
                                      <FormControl>
                                          <Input placeholder="Votre nom" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={form.control}
                              name="phoneNumber"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Numéro de téléphone</FormLabel>
                                      <FormControl>
                                          <Input placeholder="+33 6 12 34 56 78" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <Button type="submit" disabled={form.formState.isSubmitting}>
                              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Enregistrer les modifications
                          </Button>
                      </form>
                  </Form>
              </CardContent>
          </Card>
      </TabsContent>
    </Tabs>
  );
}
